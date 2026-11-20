-- Part 2 of the Learnly setup: payments, bots, teachers, files, community and admin functions.
-- Safe to run more than once. Only touches ln_ tables.

create or replace function public.ln_payment_start(p_secret text, p_payment text, p_user uuid, p_pi numeric, p_usd numeric, p_credits integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  insert into public.ln_payments(pi_payment_id, user_id, pi_amount, usd, credits)
  values (p_payment, p_user, p_pi, p_usd, p_credits) on conflict (pi_payment_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_payment_complete(p_secret text, p_payment text, p_txid text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p public.ln_payments; u public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into p from public.ln_payments where pi_payment_id = p_payment for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_payment'); end if;
  if p.status = 'completed' then
    select * into u from public.ln_users where id = p.user_id;
    return jsonb_build_object('ok', true, 'already', true, 'credits', u.credits);
  end if;
  update public.ln_payments set status = 'completed', txid = p_txid, completed_at = now() where pi_payment_id = p_payment;
  update public.ln_users set credits = credits + p.credits, paid = true where id = p.user_id returning * into u;
  insert into public.ln_ledger(user_id, delta, kind, ref) values (p.user_id, p.credits, 'purchase', p_payment);
  return jsonb_build_object('ok', true, 'credits', u.credits, 'added', p.credits);
end $$;

create or replace function public.ln_payment_get(p_secret text, p_payment text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select to_jsonb(p) from public.ln_payments p where pi_payment_id = p_payment);
end $$;

-- ---------- bots ----------
create or replace function public.ln_list_bots(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'subject', subject, 'track', track,
    'description', description, 'fee', fee, 'official', official, 'teacher_name', teacher_name,
    'has_knowledge', knowledge <> '') order by official desc, updated_at desc)
    from public.ln_bots where status = 'live'), '[]'::jsonb);
end $$;

create or replace function public.ln_get_bot(p_secret text, p_bot uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select to_jsonb(b) from public.ln_bots b where id = p_bot);
end $$;

create or replace function public.ln_my_bots(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(to_jsonb(b) - 'knowledge' || jsonb_build_object('knowledge_chars', char_length(b.knowledge)) order by updated_at desc)
    from public.ln_bots b where teacher_id = p_user), '[]'::jsonb);
end $$;

create or replace function public.ln_save_bot(p_secret text, p_user uuid, p_bot jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; app_name text; bid uuid;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  if u.role not in ('teacher','admin') then raise exception 'not a teacher'; end if;
  select display_name into app_name from public.ln_teacher_apps where user_id = p_user and status = 'approved' order by decided_at desc limit 1;
  if (p_bot->>'id') is null then
    if (select count(*) from public.ln_bots where teacher_id = p_user) >= 10 then raise exception 'too many bots'; end if;
    insert into public.ln_bots(teacher_id, teacher_name, name, subject, track, description, instructions, knowledge, fee, status)
    values (p_user, coalesce(app_name, u.username), left(p_bot->>'name', 80), left(p_bot->>'subject', 80),
      coalesce(p_bot->>'track', 'school'), left(coalesce(p_bot->>'description',''), 400),
      left(coalesce(p_bot->>'instructions',''), 4000), left(coalesce(p_bot->>'knowledge',''), 300000),
      least(greatest(coalesce((p_bot->>'fee')::int, 0), 0), 20), 'review')
    returning id into bid;
  else
    update public.ln_bots set name = left(p_bot->>'name', 80), subject = left(p_bot->>'subject', 80),
      track = coalesce(p_bot->>'track', track), description = left(coalesce(p_bot->>'description',''), 400),
      instructions = left(coalesce(p_bot->>'instructions',''), 4000),
      knowledge = case when p_bot ? 'knowledge' then left(coalesce(p_bot->>'knowledge',''), 300000) else knowledge end,
      fee = least(greatest(coalesce((p_bot->>'fee')::int, 0), 0), 20), status = 'review', updated_at = now()
    where id = (p_bot->>'id')::uuid and teacher_id = p_user returning id into bid;
    if bid is null then raise exception 'not your bot'; end if;
  end if;
  return jsonb_build_object('id', bid, 'status', 'review');
end $$;

-- ---------- teacher applications ----------
create or replace function public.ln_teacher_apply(p_secret text, p_user uuid, p_name text, p_subjects text, p_bio text,
  p_years integer, p_doc_name text, p_doc_type text, p_doc_b64 text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare aid uuid;
begin
  perform public.ln_check(p_secret);
  if exists (select 1 from public.ln_teacher_apps where user_id = p_user and status = 'pending') then
    raise exception 'already pending';
  end if;
  insert into public.ln_teacher_apps(user_id, display_name, subjects, bio, years, doc_name, doc_type, doc)
  values (p_user, left(p_name, 80), left(p_subjects, 300), left(p_bio, 1500), least(greatest(p_years, 0), 60),
    p_doc_name, p_doc_type, case when p_doc_b64 is null then null else decode(p_doc_b64, 'base64') end)
  returning id into aid;
  return jsonb_build_object('id', aid);
end $$;

create or replace function public.ln_my_app(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select jsonb_build_object('id', id, 'status', status, 'reason', reason, 'display_name', display_name, 'created_at', created_at)
    from public.ln_teacher_apps where user_id = p_user order by created_at desc limit 1);
end $$;

-- ---------- files made by the AI ----------
create or replace function public.ln_file_save(p_secret text, p_user uuid, p_format text, p_title text, p_spec jsonb)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare fid uuid;
begin
  perform public.ln_check(p_secret);
  insert into public.ln_files(user_id, format, title, spec) values (p_user, p_format, left(p_title, 120), p_spec) returning id into fid;
  return fid;
end $$;

create or replace function public.ln_file_get(p_secret text, p_file uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select to_jsonb(f) from public.ln_files f where id = p_file and user_id = p_user);
end $$;

-- ---------- community ----------
create or replace function public.ln_posts_list(p_secret text, p_group text, p_parent bigint, p_before bigint)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if p_parent is not null then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select id, username, body, created_at from public.ln_posts
      where parent_id = p_parent and not hidden order by id limit 100) x), '[]'::jsonb);
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.id desc) from (
    select id, username, group_key, body, replies, created_at from public.ln_posts
    where parent_id is null and not hidden and (p_group is null or group_key = p_group)
      and (p_before is null or id < p_before)
    order by id desc limit 20) x), '[]'::jsonb);
end $$;

create or replace function public.ln_post_create(p_secret text, p_user uuid, p_group text, p_body text, p_parent bigint)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; n integer; pid bigint;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  if u.banned then raise exception 'banned'; end if;
  select count(*) into n from public.ln_posts where user_id = p_user and created_at > now() - interval '1 day';
  if n >= 30 then return jsonb_build_object('ok', false, 'reason', 'post_limit'); end if;
  insert into public.ln_posts(user_id, username, group_key, body, parent_id)
  values (p_user, u.username, coalesce(p_group, 'general'), left(trim(p_body), 2000), p_parent) returning id into pid;
  if p_parent is not null then update public.ln_posts set replies = replies + 1 where id = p_parent; end if;
  return jsonb_build_object('ok', true, 'id', pid);
end $$;

create or replace function public.ln_post_report(p_secret text, p_user uuid, p_post bigint)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  insert into public.ln_post_reports(post_id, user_id) values (p_post, p_user) on conflict do nothing;
  if found then update public.ln_posts set reports = reports + 1 where id = p_post; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- admin ----------
create or replace function public.ln_admin_overview(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_teacher_apps set doc = null where doc is not null and decided_at < now() - interval '30 days';
  return jsonb_build_object(
    'config', (select value from public.ln_config where key = 'limits'),
    'today', coalesce((select to_jsonb(d) from public.ln_usage_daily d where day = current_date), '{}'::jsonb),
    'users', (select count(*) from public.ln_users),
    'paid_users', (select count(*) from public.ln_users where paid),
    'revenue_pi', coalesce((select sum(pi_amount) from public.ln_payments where status = 'completed'), 0),
    'apps', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'username', u.username, 'display_name', a.display_name,
        'subjects', a.subjects, 'bio', a.bio, 'years', a.years, 'doc_name', a.doc_name, 'has_doc', a.doc is not null,
        'created_at', a.created_at) order by a.created_at)
      from public.ln_teacher_apps a join public.ln_users u on u.id = a.user_id where a.status = 'pending'), '[]'::jsonb),
    'bots', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'subject', b.subject, 'teacher_name', b.teacher_name,
        'description', b.description, 'instructions', left(b.instructions, 600), 'knowledge_chars', char_length(b.knowledge), 'fee', b.fee)
        order by b.updated_at)
      from public.ln_bots b where b.status = 'review'), '[]'::jsonb),
    'reported', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'body', p.body, 'reports', p.reports) order by p.reports desc)
      from (select * from public.ln_posts where reports > 0 and not hidden order by reports desc limit 50) p), '[]'::jsonb)
  );
end $$;

create or replace function public.ln_admin_doc(p_secret text, p_app uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select jsonb_build_object('name', doc_name, 'type', doc_type, 'b64', encode(doc, 'base64'))
    from public.ln_teacher_apps where id = p_app and doc is not null);
end $$;

create or replace function public.ln_admin_decide_app(p_secret text, p_app uuid, p_approve boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  perform public.ln_check(p_secret);
  update public.ln_teacher_apps set status = case when p_approve then 'approved' else 'rejected' end,
    reason = p_reason, decided_at = now() where id = p_app and status = 'pending' returning user_id into uid;
  if uid is null then return jsonb_build_object('ok', false); end if;
  if p_approve then update public.ln_users set role = 'teacher' where id = uid and role = 'user'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_admin_decide_bot(p_secret text, p_bot uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_bots set status = case when p_approve then 'live' else 'rejected' end, updated_at = now() where id = p_bot;
  return jsonb_build_object('ok', found);
end $$;

create or replace function public.ln_admin_post(p_secret text, p_post bigint, p_hide boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if p_hide then update public.ln_posts set hidden = true where id = p_post;
  else update public.ln_posts set reports = 0 where id = p_post; end if;
  return jsonb_build_object('ok', true);
end $$;
