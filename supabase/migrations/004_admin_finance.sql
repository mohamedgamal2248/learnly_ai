-- Learnly v3: teacher earnings become spendable credits automatically, per-charge cost tracking,
-- and admin finance / users / bots reports. Additive only, safe to run more than once.

-- Settle a chat: refund the unused reservation, pay the teacher in credits, log cost, store the exchange.
create or replace function public.ln_chat_finish(p_secret text, p_user uuid, p_bot uuid, p_chat uuid,
  p_user_msg text, p_reply text, p_files jsonb, p_reserved integer, p_actual integer, p_cost_usd numeric,
  p_teacher_share integer, p_meta jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare actual integer; u public.ln_users; t uuid; cid uuid; share integer := 0;
begin
  perform public.ln_check(p_secret);
  actual := least(greatest(p_actual, 0), p_reserved);
  if p_teacher_share > 0 and p_bot is not null then
    select teacher_id into t from public.ln_bots where id = p_bot;
    if t is not null and t <> p_user then share := least(p_teacher_share, actual); end if;
  end if;
  update public.ln_users set credits = credits + (p_reserved - actual) where id = p_user returning * into u;
  if actual > 0 then
    insert into public.ln_ledger(user_id, delta, kind, ref, meta)
    values (p_user, -actual, 'ai', p_bot::text, coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('cost', p_cost_usd, 'teacher', share));
  end if;
  if share > 0 then
    -- Teacher earnings land in their balance right away (spendable) and in the lifetime "earned" counter.
    update public.ln_users set credits = credits + share, earned = earned + share where id = t;
    insert into public.ln_ledger(user_id, delta, kind, ref) values (t, share, 'teacher_fee', p_bot::text);
  end if;
  insert into public.ln_usage_daily(day, cost_usd, credits, msgs) values (current_date, p_cost_usd, actual, 1)
  on conflict (day) do update set cost_usd = ln_usage_daily.cost_usd + excluded.cost_usd,
    credits = ln_usage_daily.credits + excluded.credits, msgs = ln_usage_daily.msgs + 1;

  if p_user_msg is not null and (coalesce(p_reply, '') <> '' or p_files is not null) then
    select id into cid from public.ln_chats where id = p_chat and user_id = p_user and bot_id = p_bot;
    if cid is null then
      insert into public.ln_chats(user_id, bot_id, title) values (p_user, p_bot, left(p_user_msg, 60)) returning id into cid;
    end if;
    insert into public.ln_messages(chat_id, role, content) values (cid, 'user', left(p_user_msg, 4000));
    insert into public.ln_messages(chat_id, role, content, files, credits) values (cid, 'assistant', left(coalesce(p_reply, ''), 20000), p_files, actual);
    update public.ln_chats set msgs = msgs + 2, updated_at = now() where id = cid;
  end if;
  return jsonb_build_object('credits', u.credits, 'charged', actual, 'chat_id', cid);
end $$;

-- Same as before, but the ledger row keeps the AI cost (used by the bot architect).
create or replace function public.ln_settle(p_secret text, p_user uuid, p_reserved integer, p_actual integer,
  p_cost_usd numeric, p_bot uuid, p_teacher_share integer, p_meta jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare actual integer; u public.ln_users;
begin
  perform public.ln_check(p_secret);
  actual := least(greatest(p_actual, 0), p_reserved);
  update public.ln_users set credits = credits + (p_reserved - actual) where id = p_user returning * into u;
  if actual > 0 then
    insert into public.ln_ledger(user_id, delta, kind, ref, meta)
    values (p_user, -actual, 'ai', p_bot::text, coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('cost', p_cost_usd, 'teacher', 0));
  end if;
  insert into public.ln_usage_daily(day, cost_usd, credits, msgs) values (current_date, p_cost_usd, actual, 1)
  on conflict (day) do update set cost_usd = ln_usage_daily.cost_usd + excluded.cost_usd,
    credits = ln_usage_daily.credits + excluded.credits, msgs = ln_usage_daily.msgs + 1;
  return jsonb_build_object('credits', u.credits, 'charged', actual);
end $$;

-- Money overview: what came in (Pi), what the AI cost, what teachers earned, what users still hold.
create or replace function public.ln_admin_finance(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return jsonb_build_object(
    'revenue_pi', coalesce((select sum(pi_amount) from public.ln_payments where status = 'completed'), 0),
    'revenue_usd', coalesce((select sum(usd) from public.ln_payments where status = 'completed'), 0),
    'payments', (select count(*) from public.ln_payments where status = 'completed'),
    'credits_sold', coalesce((select sum(credits) from public.ln_payments where status = 'completed'), 0),
    'credits_welcome', coalesce((select sum(delta) from public.ln_ledger where kind = 'welcome'), 0),
    'credits_spent', coalesce((select -sum(delta) from public.ln_ledger where kind = 'ai'), 0),
    'credits_teachers', coalesce((select sum(delta) from public.ln_ledger where kind = 'teacher_fee'), 0),
    'credits_outstanding', coalesce((select sum(credits) from public.ln_users), 0),
    'ai_cost_usd', coalesce((select sum(cost_usd) from public.ln_usage_daily), 0),
    'ai_cost_30d', coalesce((select sum(cost_usd) from public.ln_usage_daily where day > current_date - 30), 0),
    'ai_cost_7d', coalesce((select sum(cost_usd) from public.ln_usage_daily where day > current_date - 7), 0),
    'msgs_total', coalesce((select sum(msgs) from public.ln_usage_daily), 0),
    'days', coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from (
      select * from public.ln_usage_daily where day > current_date - 30) d), '[]'::jsonb),
    'revenue_days', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'pi', pi, 'usd', usd) order by d) from (
      select completed_at::date d, sum(pi_amount) pi, sum(usd) usd from public.ln_payments
      where status = 'completed' and completed_at > now() - interval '30 days' group by 1) r), '[]'::jsonb)
  );
end $$;

-- Per-user report: what each person bought, spent, cost us, and earned (teachers).
create or replace function public.ln_admin_users(p_secret text, p_search text, p_limit integer, p_offset integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return jsonb_build_object(
    'total', (select count(*) from public.ln_users where p_search is null or username ilike '%' || p_search || '%'),
    'rows', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select u.id, u.username, u.role, u.credits, u.earned, u.paid, u.banned, u.created_at,
        coalesce(p.pi, 0) as pi_paid, coalesce(p.usd, 0) as usd_paid, coalesce(p.credits, 0) as credits_bought,
        coalesce(l.spent, 0) as credits_spent, coalesce(l.cost, 0) as ai_cost, coalesce(l.teacher, 0) as teacher_cut,
        coalesce(l.n, 0) as charges, (select count(*) from public.ln_bots b where b.teacher_id = u.id) as bots
      from public.ln_users u
      left join (select user_id, sum(pi_amount) pi, sum(usd) usd, sum(credits) credits
                 from public.ln_payments where status = 'completed' group by user_id) p on p.user_id = u.id
      left join (select user_id, -sum(delta) spent, sum(coalesce((meta->>'cost')::numeric, 0)) cost,
                   sum(coalesce((meta->>'teacher')::int, 0)) teacher, count(*) n
                 from public.ln_ledger where kind = 'ai' group by user_id) l on l.user_id = u.id
      where p_search is null or u.username ilike '%' || p_search || '%'
      order by coalesce(l.spent, 0) desc, u.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb)
  );
end $$;

-- Every bot with usage and earnings, plus the materials list for review.
create or replace function public.ln_admin_bots(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.status = 'review' desc, x.credits_charged desc) from (
    select b.id, b.name, b.name_en, b.subject, b.subject_en, b.track, b.status, b.official, b.fee, b.teacher_name,
      b.description, b.description_en, left(b.instructions, 1200) as instructions, char_length(b.knowledge) as knowledge_chars,
      b.updated_at,
      coalesce((select jsonb_agg(jsonb_build_object('name', f.name, 'chars', f.chars) order by f.created_at)
        from public.ln_bot_files f where f.bot_id = b.id and f.active), '[]'::jsonb) as files,
      (select count(*) from public.ln_chats c where c.bot_id = b.id) as chats,
      coalesce((select sum(c.msgs) / 2 from public.ln_chats c where c.bot_id = b.id), 0) as messages,
      coalesce((select -sum(l.delta) from public.ln_ledger l where l.kind = 'ai' and l.ref = b.id::text), 0) as credits_charged,
      coalesce((select sum(coalesce((l.meta->>'cost')::numeric, 0)) from public.ln_ledger l where l.kind = 'ai' and l.ref = b.id::text), 0) as ai_cost,
      coalesce((select sum(l.delta) from public.ln_ledger l where l.kind = 'teacher_fee' and l.ref = b.id::text), 0) as teacher_credits
    from public.ln_bots b) x), '[]'::jsonb);
end $$;

-- Admin can publish, pause or reject any bot.
create or replace function public.ln_admin_bot_status(p_secret text, p_bot uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if p_status not in ('live', 'paused', 'rejected', 'review') then raise exception 'bad status'; end if;
  update public.ln_bots set status = p_status, updated_at = now() where id = p_bot;
  return jsonb_build_object('ok', found);
end $$;

-- Ban or unban a user.
create or replace function public.ln_admin_ban(p_secret text, p_user uuid, p_banned boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_users set banned = p_banned where id = p_user and role <> 'admin';
  return jsonb_build_object('ok', found);
end $$;
