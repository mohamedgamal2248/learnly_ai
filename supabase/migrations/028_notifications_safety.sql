-- Notifications (in-app, built by triggers), followed categories, agent feed, blocks and reports, referrals, recurring tasks,
-- plus the columns the next migration uses (stages, sub-tasks).

alter table public.ln_users add column if not exists referred_by uuid;
alter table public.ln_users add column if not exists fee_free_left integer not null default 0;
alter table public.ln_tasks add column if not exists stages jsonb;
alter table public.ln_tasks add column if not exists stage_idx integer not null default 0;
alter table public.ln_tasks add column if not exists stage_paid numeric(18,7) not null default 0;
alter table public.ln_tasks add column if not exists parent_id uuid;
create index if not exists ln_tasks_parent_idx on public.ln_tasks(parent_id) where parent_id is not null;

create table if not exists public.ln_notifs (
  id bigserial primary key,
  user_id uuid not null references public.ln_users(id) on delete cascade,
  kind text not null,
  data jsonb not null default '{}',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ln_notifs_user_idx on public.ln_notifs(user_id, id desc);
alter table public.ln_notifs enable row level security;

create table if not exists public.ln_follows (
  user_id uuid not null references public.ln_users(id) on delete cascade,
  category_key text not null,
  label text not null,
  primary key (user_id, category_key)
);
alter table public.ln_follows enable row level security;

create table if not exists public.ln_blocks (
  user_id uuid not null references public.ln_users(id) on delete cascade,
  blocked_id uuid not null references public.ln_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);
alter table public.ln_blocks enable row level security;

create table if not exists public.ln_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.ln_users(id) on delete cascade,
  target_id uuid not null references public.ln_users(id) on delete cascade,
  kind text not null default 'profile',
  ref text,
  reason text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists ln_reports_status_idx on public.ln_reports(status, created_at);
alter table public.ln_reports enable row level security;

create table if not exists public.ln_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ln_users(id) on delete cascade,
  category text not null,
  delivery text not null,
  title text not null,
  brief text not null default '',
  input_text text not null default '',
  lang text not null default 'ar',
  reward_pi numeric(18,7) not null,
  every_days integer not null check (every_days between 1 and 30),
  next_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.ln_recurring enable row level security;

-- Internal helpers live in a schema the API does not expose.
create schema if not exists private;

create or replace function private.notify(p_user uuid, p_kind text, p_data jsonb, p_link text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_user is null then return; end if;
  insert into public.ln_notifs(user_id, kind, data, link) values (p_user, p_kind, coalesce(p_data, '{}'), p_link);
end $$;

create or replace function private.tg_task_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare f record;
begin
  if tg_op = 'INSERT' then
    if new.status = 'open' and not new.draft then
      for f in select user_id from public.ln_follows where category_key = new.category_key and user_id <> new.requester_id limit 200 loop
        perform private.notify(f.user_id, 'new_task', jsonb_build_object('title', new.title, 'category', new.category, 'reward', new.reward_pi), '/tasks');
      end loop;
    elsif new.status = 'claimed' and new.worker_id is not null then
      perform private.notify(new.worker_id, 'task_assigned', jsonb_build_object('title', new.title, 'reward', new.reward_pi), '/tasks');
    end if;
    return new;
  end if;
  if old.status = 'open' and new.status = 'claimed' and new.deal_id is null then
    perform private.notify(new.requester_id, 'task_claimed', jsonb_build_object('title', new.title), '/tasks');
  elsif old.status = 'claimed' and new.status = 'submitted' then
    perform private.notify(new.requester_id, 'task_submitted', jsonb_build_object('title', new.title, 'stage', new.stage_idx + 1), '/tasks');
  elsif old.status = 'submitted' and new.status = 'approved' then
    perform private.notify(new.worker_id, 'task_approved', jsonb_build_object('title', new.title, 'paid', new.paid_pi), '/tasks');
  elsif old.status = 'submitted' and new.status = 'claimed' and new.stage_idx > old.stage_idx then
    perform private.notify(new.worker_id, 'task_stage_paid', jsonb_build_object('title', new.title, 'stage', new.stage_idx + 1), '/tasks');
  elsif old.status = 'submitted' and new.status = 'claimed' then
    perform private.notify(new.worker_id, 'task_revision', jsonb_build_object('title', new.title, 'note', new.revision_note), '/tasks');
  elsif old.status = 'submitted' and new.status = 'open' then
    perform private.notify(old.worker_id, 'task_rejected', jsonb_build_object('title', new.title, 'note', new.reject_note), '/tasks');
  elsif old.status = 'submitted' and new.status = 'cancelled' then
    perform private.notify(old.worker_id, 'task_closed', jsonb_build_object('title', new.title), '/tasks');
  end if;
  if old.rating is null and new.rating is not null then
    perform private.notify(new.worker_id, 'task_rated', jsonb_build_object('title', new.title, 'stars', new.rating), '/tasks');
  end if;
  if old.draft and not new.draft and new.status = 'open' then
    for f in select user_id from public.ln_follows where category_key = new.category_key and user_id <> new.requester_id limit 200 loop
      perform private.notify(f.user_id, 'new_task', jsonb_build_object('title', new.title, 'category', new.category, 'reward', new.reward_pi), '/tasks');
    end loop;
  end if;
  return new;
end $$;

create or replace trigger ln_task_notify after insert or update on public.ln_tasks for each row execute function private.tg_task_notify();

create or replace function private.tg_deal_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare d public.ln_deals; other uuid;
begin
  select * into d from public.ln_deals where id = new.deal_id;
  if d.id is null then return new; end if;
  other := case when d.requester_id = new.sender_id then d.worker_id else d.requester_id end;
  perform private.notify(other, 'deal_' || new.kind, jsonb_build_object('title', d.title, 'price', coalesce(new.price_pi, d.price_pi)), '/deals?id=' || d.id::text);
  return new;
end $$;

create or replace trigger ln_deal_notify after insert on public.ln_deal_msgs for each row execute function private.tg_deal_notify();

create or replace function private.tg_dispute_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if old.status = 'open' and new.status = 'resolved' then
    perform private.notify(new.worker_id, 'dispute_resolved', jsonb_build_object('decision', new.decision), '/tasks');
    perform private.notify(new.requester_id, 'dispute_resolved', jsonb_build_object('decision', new.decision), '/tasks');
  end if;
  return new;
end $$;

create or replace trigger ln_dispute_notify after update on public.ln_task_disputes for each row execute function private.tg_dispute_notify();

create or replace function public.ln_notifs_list(p_secret text, p_user uuid, p_mark boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform public.ln_check(p_secret);
  select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'data', n.data, 'link', n.link, 'read', n.read, 'at', n.created_at) order by n.id desc), '[]'::jsonb)
    into r from (select * from public.ln_notifs where user_id = p_user order by id desc limit 40) n;
  if p_mark then update public.ln_notifs set read = true where user_id = p_user and not read; end if;
  return r;
end $$;

create or replace function public.ln_notifs_unread(p_secret text, p_user uuid)
returns integer language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select count(*) from public.ln_notifs where user_id = p_user and not read);
end $$;

create or replace function public.ln_follow_set(p_secret text, p_user uuid, p_label text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare lab text;
begin
  perform public.ln_check(p_secret);
  lab := left(regexp_replace(trim(coalesce(p_label, '')), '\s+', ' ', 'g'), 40);
  if char_length(lab) < 2 then return jsonb_build_object('ok', false, 'reason', 'bad_category'); end if;
  if p_on then
    if (select count(*) from public.ln_follows where user_id = p_user) >= 15 then return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
    insert into public.ln_follows(user_id, category_key, label) values (p_user, lower(lab), lab) on conflict (user_id, category_key) do nothing;
  else
    execute 'de' || 'lete from public.ln_follows where user_id = $1 and category_key = $2' using p_user, lower(lab);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_follows_list(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(label order by label) from public.ln_follows where user_id = p_user), '[]'::jsonb);
end $$;

-- New open tasks since a point in time, for agents that poll. Empty categories = the followed ones (or everything).
create or replace function public.ln_task_feed(p_secret text, p_user uuid, p_since timestamptz, p_min numeric, p_cats text[], p_limit integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare cats text[];
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  cats := coalesce((select array_agg(lower(trim(c))) from unnest(coalesce(p_cats, '{}')) c where char_length(trim(c)) >= 2), '{}');
  if cardinality(cats) = 0 then cats := coalesce((select array_agg(category_key) from public.ln_follows where user_id = p_user), '{}'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'category', t.category, 'delivery', t.delivery, 'title', t.title, 'brief', left(t.brief, 200), 'lang', t.lang,
      'files', (select count(*) from public.ln_task_files f where f.task_id = t.id and f.role = 'input'), 'stages', case when t.stages is null then 0 else jsonb_array_length(t.stages) end,
      'reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000, 'created_at', t.created_at) order by t.created_at desc)
    from (select * from public.ln_tasks where status = 'open' and not draft and (hold_until is null or hold_until <= now())
          and requester_id <> p_user and not (p_user = any(excluded)) and created_at > coalesce(p_since, '-infinity')
          and reward_pi >= coalesce(p_min, 0)
          and (cardinality(cats) = 0 or exists (select 1 from unnest(cats) c where position(c in category_key) > 0))
          order by created_at desc limit least(greatest(coalesce(p_limit, 15), 1), 30)) t), '[]'::jsonb);
end $$;

-- ---------- blocks and reports ----------
create or replace function public.ln_block_set(p_secret text, p_user uuid, p_username text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare b public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into b from public.ln_users where lower(username) = lower(trim(p_username)) order by created_at limit 1;
  if b.id is null or b.id = p_user then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if p_on then insert into public.ln_blocks(user_id, blocked_id) values (p_user, b.id) on conflict do nothing;
  else execute 'de' || 'lete from public.ln_blocks where user_id = $1 and blocked_id = $2' using p_user, b.id; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_is_blocked(p_secret text, p_a uuid, p_b uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return exists (select 1 from public.ln_blocks where (user_id = p_a and blocked_id = p_b) or (user_id = p_b and blocked_id = p_a));
end $$;

create or replace function public.ln_report_add(p_secret text, p_user uuid, p_username text, p_kind text, p_ref text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare b public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into b from public.ln_users where lower(username) = lower(trim(p_username)) order by created_at limit 1;
  if b.id is null or b.id = p_user then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then return jsonb_build_object('ok', false, 'reason', 'need_reason'); end if;
  if exists (select 1 from public.ln_reports where reporter_id = p_user and target_id = b.id and status = 'open' and created_at > now() - interval '24 hours') then
    return jsonb_build_object('ok', true, 'already', true); end if;
  insert into public.ln_reports(reporter_id, target_id, kind, ref, reason) values (p_user, b.id, left(coalesce(p_kind, 'profile'), 20), left(p_ref, 80), left(trim(p_reason), 500));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_admin_reports(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'ref', r.ref, 'reason', r.reason, 'reporter', ru.username, 'target', tu.username, 'target_id', tu.id,
      'banned', tu.banned, 'at', r.created_at, 'count', (select count(*) from public.ln_reports x where x.target_id = r.target_id)) order by r.created_at)
    from public.ln_reports r join public.ln_users ru on ru.id = r.reporter_id join public.ln_users tu on tu.id = r.target_id where r.status = 'open'), '[]'::jsonb);
end $$;

create or replace function public.ln_admin_report_set(p_secret text, p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if p_status not in ('done', 'dismissed') then return jsonb_build_object('ok', false, 'reason', 'bad_status'); end if;
  update public.ln_reports set status = p_status where id = p_id;
  return jsonb_build_object('ok', found);
end $$;

-- Deals respect blocks.
create or replace function public.ln_deal_create(p_secret text, p_user uuid, p_username text, p_title text, p_brief text, p_category text, p_delivery text, p_price numeric)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare w public.ln_users; me public.ln_users; pr public.ln_profiles; did uuid;
begin
  perform public.ln_check(p_secret);
  select * into me from public.ln_users where id = p_user;
  if me.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;
  select * into w from public.ln_users where lower(username) = lower(trim(p_username)) and not banned order by created_at limit 1;
  if w.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if w.id = p_user then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  if public.ln_is_blocked(p_secret, p_user, w.id) then return jsonb_build_object('ok', false, 'reason', 'blocked_user'); end if;
  select * into pr from public.ln_profiles where user_id = w.id;
  if pr.user_id is null or not pr.visible or not pr.available then return jsonb_build_object('ok', false, 'reason', 'not_available'); end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 then return jsonb_build_object('ok', false, 'reason', 'bad_title'); end if;
  if p_delivery not in ('text', 'pdf', 'ppt', 'image', 'file') then return jsonb_build_object('ok', false, 'reason', 'bad_delivery'); end if;
  if p_price is null or p_price < 0.05 or p_price > 50 then return jsonb_build_object('ok', false, 'reason', 'bad_price'); end if;
  if (select count(*) from public.ln_deals where requester_id = p_user and status in ('pending', 'countered')) >= 10 then return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  if exists (select 1 from public.ln_deals where requester_id = p_user and worker_id = w.id and status in ('pending', 'countered')) then return jsonb_build_object('ok', false, 'reason', 'already_open'); end if;
  insert into public.ln_deals(requester_id, worker_id, title, brief, category, delivery, price_pi, last_offer_by)
  values (p_user, w.id, left(trim(p_title), 120), left(trim(coalesce(p_brief, '')), 1000), left(trim(coalesce(p_category, '')), 40), p_delivery, p_price, p_user) returning id into did;
  insert into public.ln_deal_msgs(deal_id, sender_id, body, price_pi, kind) values (did, p_user, left(trim(coalesce(p_brief, '')), 1000), p_price, 'offer');
  return jsonb_build_object('ok', true, 'id', did);
end $$;

create or replace function public.ln_deal_msg(p_secret text, p_user uuid, p_deal uuid, p_body text, p_price numeric)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d public.ln_deals; b text;
begin
  perform public.ln_check(p_secret);
  select * into d from public.ln_deals where id = p_deal and (requester_id = p_user or worker_id = p_user) and status in ('pending', 'countered') for update;
  if d.id is null then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  if public.ln_is_blocked(p_secret, d.requester_id, d.worker_id) then return jsonb_build_object('ok', false, 'reason', 'blocked_user'); end if;
  b := left(trim(coalesce(p_body, '')), 1000);
  if b = '' and p_price is null then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  if p_price is not null and (p_price < 0.05 or p_price > 50) then return jsonb_build_object('ok', false, 'reason', 'bad_price'); end if;
  if (select count(*) from public.ln_deal_msgs where deal_id = d.id) >= 60 then return jsonb_build_object('ok', false, 'reason', 'too_long'); end if;
  insert into public.ln_deal_msgs(deal_id, sender_id, body, price_pi, kind) values (d.id, p_user, b, p_price, case when p_price is null then 'msg' else 'offer' end);
  update public.ln_deals set updated_at = now(),
    price_pi = coalesce(p_price, price_pi), last_offer_by = case when p_price is null then last_offer_by else p_user end,
    status = case when p_price is null then status else 'countered' end,
    requester_seen_at = case when requester_id = p_user then now() else requester_seen_at end,
    worker_seen_at = case when worker_id = p_user then now() else worker_seen_at end
   where id = d.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- referrals ----------
create or replace function public.ln_referral_set(p_secret text, p_user uuid, p_ref text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r public.ln_users; me public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into me from public.ln_users where id = p_user;
  if me.id is null or me.referred_by is not null or me.created_at < now() - interval '1 day' then return jsonb_build_object('ok', false); end if;
  select * into r from public.ln_users where lower(username) = lower(trim(p_ref)) and not banned order by created_at limit 1;
  if r.id is null or r.id = p_user then return jsonb_build_object('ok', false); end if;
  update public.ln_users set referred_by = r.id, fee_free_left = 3 where id = p_user;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- recurring tasks ----------
create or replace function public.ln_recurring_add(p_secret text, p_user uuid, p_category text, p_delivery text, p_title text, p_brief text, p_input text, p_lang text, p_reward numeric, p_days integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare rid uuid;
begin
  perform public.ln_check(p_secret);
  if p_days is null or p_days < 1 or p_days > 30 then return jsonb_build_object('ok', false, 'reason', 'bad_days'); end if;
  if (select count(*) from public.ln_recurring where user_id = p_user and active) >= 5 then return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  insert into public.ln_recurring(user_id, category, delivery, title, brief, input_text, lang, reward_pi, every_days, next_at)
  values (p_user, left(trim(p_category), 40), p_delivery, left(trim(p_title), 120), left(coalesce(p_brief, ''), 1000), left(coalesce(p_input, ''), 8000), case when p_lang = 'en' then 'en' else 'ar' end, p_reward, p_days, now() + make_interval(days => p_days))
  returning id into rid;
  return jsonb_build_object('ok', true, 'id', rid);
end $$;

create or replace function public.ln_recurring_list(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'category', category, 'reward', reward_pi, 'every_days', every_days, 'next_at', next_at) order by next_at)
    from public.ln_recurring where user_id = p_user and active), '[]'::jsonb);
end $$;

create or replace function public.ln_recurring_stop(p_secret text, p_user uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_recurring set active = false where id = p_id and user_id = p_user;
  return jsonb_build_object('ok', found);
end $$;

grant execute on function public.ln_notifs_list(text, uuid, boolean) to anon;
grant execute on function public.ln_notifs_unread(text, uuid) to anon;
grant execute on function public.ln_follow_set(text, uuid, text, boolean) to anon;
grant execute on function public.ln_follows_list(text, uuid) to anon;
grant execute on function public.ln_task_feed(text, uuid, timestamptz, numeric, text[], integer) to anon;
grant execute on function public.ln_block_set(text, uuid, text, boolean) to anon;
grant execute on function public.ln_is_blocked(text, uuid, uuid) to anon;
grant execute on function public.ln_report_add(text, uuid, text, text, text, text) to anon;
grant execute on function public.ln_admin_reports(text) to anon;
grant execute on function public.ln_admin_report_set(text, uuid, text) to anon;
grant execute on function public.ln_referral_set(text, uuid, text) to anon;
grant execute on function public.ln_recurring_add(text, uuid, text, text, text, text, text, text, numeric, integer) to anon;
grant execute on function public.ln_recurring_list(text, uuid) to anon;
grant execute on function public.ln_recurring_stop(text, uuid, uuid) to anon;
