-- Learnly v5 (phase 1): server-side limits that can't be bypassed by running many server instances.
-- Additive only, safe to run more than once.

alter table public.ln_users add column if not exists day_credits integer not null default 0;
alter table public.ln_users add column if not exists rl_at timestamptz;
alter table public.ln_users add column if not exists rl_count integer not null default 0;

update public.ln_config set value = value
  || jsonb_build_object('max_per_minute', coalesce(value->'max_per_minute', '8'::jsonb))
  || jsonb_build_object('daily_credit_cap', coalesce(value->'daily_credit_cap', '5000'::jsonb))
where key = 'limits';

-- Reserve credits for one AI request. Checks, in order: ban, per-minute rate, free-user rules,
-- per-user daily cap (counts reservations too, so parallel requests can't slip past), balance.
create or replace function public.ln_reserve(p_secret text, p_user uuid, p_amount integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; cfg jsonb; spent numeric;
begin
  perform public.ln_check(p_secret);
  if p_amount < 1 then raise exception 'bad amount'; end if;
  select value into cfg from public.ln_config where key = 'limits';
  select * into u from public.ln_users where id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_user'); end if;
  if u.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;

  if u.day <> current_date then
    update public.ln_users set day = current_date, day_msgs = 0, day_credits = 0 where id = u.id returning * into u;
  end if;
  if u.rl_at is null or now() - u.rl_at > interval '60 seconds' then
    update public.ln_users set rl_at = now(), rl_count = 0 where id = u.id returning * into u;
  end if;
  if u.rl_count >= coalesce((cfg->>'max_per_minute')::int, 8) then
    return jsonb_build_object('ok', false, 'reason', 'slow_down');
  end if;

  if not u.paid then
    if coalesce((cfg->>'kill_free')::boolean, false) then
      return jsonb_build_object('ok', false, 'reason', 'paused');
    end if;
    select cost_usd into spent from public.ln_usage_daily where day = current_date;
    if coalesce(spent, 0) >= coalesce((cfg->>'daily_budget_usd')::numeric, 5) then
      return jsonb_build_object('ok', false, 'reason', 'paused');
    end if;
    if u.day_msgs >= coalesce((cfg->>'free_daily_msgs')::int, 30) then
      return jsonb_build_object('ok', false, 'reason', 'daily_limit');
    end if;
  end if;

  if u.day_credits + p_amount > coalesce((cfg->>'daily_credit_cap')::int, 5000) then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap');
  end if;
  if u.credits < p_amount then
    return jsonb_build_object('ok', false, 'reason', 'no_credits', 'credits', u.credits, 'need', p_amount);
  end if;
  update public.ln_users set credits = credits - p_amount, day_msgs = day_msgs + 1,
    day_credits = day_credits + p_amount, rl_count = rl_count + 1
  where id = u.id returning * into u;
  return jsonb_build_object('ok', true, 'credits', u.credits);
end $$;

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
  update public.ln_users set credits = credits + (p_reserved - actual),
    day_credits = greatest(0, day_credits - (p_reserved - actual))
  where id = p_user returning * into u;
  if actual > 0 then
    insert into public.ln_ledger(user_id, delta, kind, ref, meta)
    values (p_user, -actual, 'ai', p_bot::text, coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('cost', p_cost_usd, 'teacher', share));
  end if;
  if share > 0 then
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

create or replace function public.ln_settle(p_secret text, p_user uuid, p_reserved integer, p_actual integer,
  p_cost_usd numeric, p_bot uuid, p_teacher_share integer, p_meta jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare actual integer; u public.ln_users;
begin
  perform public.ln_check(p_secret);
  actual := least(greatest(p_actual, 0), p_reserved);
  update public.ln_users set credits = credits + (p_reserved - actual),
    day_credits = greatest(0, day_credits - (p_reserved - actual))
  where id = p_user returning * into u;
  if actual > 0 then
    insert into public.ln_ledger(user_id, delta, kind, ref, meta)
    values (p_user, -actual, 'ai', p_bot::text, coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('cost', p_cost_usd, 'teacher', 0));
  end if;
  insert into public.ln_usage_daily(day, cost_usd, credits, msgs) values (current_date, p_cost_usd, actual, 1)
  on conflict (day) do update set cost_usd = ln_usage_daily.cost_usd + excluded.cost_usd,
    credits = ln_usage_daily.credits + excluded.credits, msgs = ln_usage_daily.msgs + 1;
  return jsonb_build_object('credits', u.credits, 'charged', actual);
end $$;
