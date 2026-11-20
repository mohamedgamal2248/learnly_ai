-- Learnly AI schema. Every table is prefixed ln_ because the DalilPi project is shared with other apps.
-- Tables have RLS on and no policies: the browser never talks to them.
-- The server calls SECURITY DEFINER functions with a secret whose sha256 lives in ln_config('server_secret_sha256').

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ln_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ln_users (
  id uuid primary key default gen_random_uuid(),
  pi_uid text not null unique,
  username text not null,
  role text not null default 'user' check (role in ('user','teacher','admin')),
  credits integer not null default 0 check (credits >= 0),
  earned integer not null default 0,
  paid boolean not null default false,
  welcome_given boolean not null default false,
  banned boolean not null default false,
  day date not null default current_date,
  day_msgs integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ln_ledger (
  id bigserial primary key,
  user_id uuid not null references public.ln_users(id) on delete cascade,
  delta integer not null,
  kind text not null,
  ref text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ln_ledger_user_idx on public.ln_ledger(user_id, created_at desc);

create table if not exists public.ln_payments (
  pi_payment_id text primary key,
  user_id uuid not null references public.ln_users(id) on delete cascade,
  pi_amount numeric not null,
  usd numeric not null,
  credits integer not null,
  status text not null default 'approved',
  txid text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ln_usage_daily (
  day date primary key,
  cost_usd numeric not null default 0,
  credits integer not null default 0,
  msgs integer not null default 0
);

create table if not exists public.ln_teacher_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ln_users(id) on delete cascade,
  display_name text not null,
  subjects text not null,
  bio text not null,
  years integer not null default 0,
  doc_name text,
  doc_type text,
  doc bytea,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists ln_apps_status_idx on public.ln_teacher_apps(status, created_at);

create table if not exists public.ln_bots (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.ln_users(id) on delete cascade,
  teacher_name text,
  name text not null,
  subject text not null,
  track text not null default 'school' check (track in ('school','uni','job','code','lang','academy')),
  description text not null default '',
  instructions text not null default '',
  knowledge text not null default '',
  fee integer not null default 0 check (fee between 0 and 20),
  status text not null default 'review' check (status in ('draft','review','live','rejected','paused')),
  official boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ln_bots_status_idx on public.ln_bots(status, track);

create table if not exists public.ln_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ln_users(id) on delete cascade,
  format text not null check (format in ('pdf','docx','pptx','xlsx')),
  title text not null,
  spec jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists ln_files_user_idx on public.ln_files(user_id, created_at);

create table if not exists public.ln_posts (
  id bigserial primary key,
  user_id uuid not null references public.ln_users(id) on delete cascade,
  username text not null,
  group_key text not null default 'general',
  body text not null check (char_length(body) between 1 and 2000),
  parent_id bigint references public.ln_posts(id) on delete cascade,
  replies integer not null default 0,
  reports integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ln_posts_feed_idx on public.ln_posts(group_key, id desc) where parent_id is null and not hidden;
create index if not exists ln_posts_parent_idx on public.ln_posts(parent_id, id);

create table if not exists public.ln_post_reports (
  post_id bigint not null references public.ln_posts(id) on delete cascade,
  user_id uuid not null references public.ln_users(id) on delete cascade,
  primary key (post_id, user_id)
);

alter table public.ln_config enable row level security;
alter table public.ln_users enable row level security;
alter table public.ln_ledger enable row level security;
alter table public.ln_payments enable row level security;
alter table public.ln_usage_daily enable row level security;
alter table public.ln_teacher_apps enable row level security;
alter table public.ln_bots enable row level security;
alter table public.ln_files enable row level security;
alter table public.ln_posts enable row level security;
alter table public.ln_post_reports enable row level security;

insert into public.ln_config(key, value) values
  ('limits', '{"markup":4,"credit_usd":0.001,"welcome_credits":100,"free_daily_msgs":30,"daily_budget_usd":5,"max_reserve":400,"file_fee":15,"kill_free":false}'::jsonb)
on conflict (key) do nothing;

-- Official general tutor so the site is usable on day one.
insert into public.ln_bots(name, subject, track, description, instructions, status, official, teacher_name)
select 'مدرّس Learnly', 'كل المواد', 'school',
  'مدرّس عام بيساعدك تذاكر أي مادة، ويعملك ملخصات وملفات PDF وWord وPowerPoint وExcel.',
  'You are Learnly, a patient general tutor. Default to the Socratic method: ask one guiding question before giving the full answer, unless the student asks for a direct explanation or a file.',
  'live', true, 'Learnly AI'
where not exists (select 1 from public.ln_bots where official);

-- ---------- helpers ----------
create or replace function public.ln_check(p_secret text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_secret is null or encode(extensions.digest(p_secret, 'sha256'), 'hex')
     is distinct from (select value->>0 from public.ln_config where key = 'server_secret_sha256') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function public.ln_user_json(u public.ln_users) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('id', u.id, 'pi_uid', u.pi_uid, 'username', u.username, 'role', u.role,
    'credits', u.credits, 'earned', u.earned, 'paid', u.paid, 'banned', u.banned)
$$;

-- ---------- users ----------
create or replace function public.ln_upsert_user(p_secret text, p_uid text, p_username text, p_admin boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; w integer;
begin
  perform public.ln_check(p_secret);
  w := coalesce((select (value->>'welcome_credits')::int from public.ln_config where key='limits'), 0);
  insert into public.ln_users(pi_uid, username) values (p_uid, p_username)
  on conflict (pi_uid) do update set username = excluded.username
  returning * into u;
  if p_admin and u.role <> 'admin' then
    update public.ln_users set role = 'admin' where id = u.id returning * into u;
  end if;
  if not u.welcome_given and w > 0 then
    update public.ln_users set credits = credits + w, welcome_given = true where id = u.id returning * into u;
    insert into public.ln_ledger(user_id, delta, kind) values (u.id, w, 'welcome');
  end if;
  return public.ln_user_json(u);
end $$;

create or replace function public.ln_get_user(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  if not found then return null; end if;
  return public.ln_user_json(u);
end $$;

-- ---------- config ----------
create or replace function public.ln_get_config(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select value from public.ln_config where key = 'limits');
end $$;

create or replace function public.ln_set_config(p_secret text, p_value jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_config set value = value || p_value, updated_at = now() where key = 'limits';
  return (select value from public.ln_config where key = 'limits');
end $$;

-- ---------- AI credit reservation ----------
-- Deducts p_amount up front. Refuses when: banned, not enough credits, free daily cap, kill switch or budget hit for free users.
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
    update public.ln_users set day = current_date, day_msgs = 0 where id = u.id returning * into u;
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
  if u.credits < p_amount then
    return jsonb_build_object('ok', false, 'reason', 'no_credits', 'credits', u.credits, 'need', p_amount);
  end if;
  update public.ln_users set credits = credits - p_amount, day_msgs = day_msgs + 1 where id = u.id returning * into u;
  return jsonb_build_object('ok', true, 'credits', u.credits);
end $$;

-- Refunds the unused part of a reservation, logs the charge, pays the teacher fee share and counts platform usage.
create or replace function public.ln_settle(p_secret text, p_user uuid, p_reserved integer, p_actual integer,
  p_cost_usd numeric, p_bot uuid, p_teacher_share integer, p_meta jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare actual integer; u public.ln_users; t uuid;
begin
  perform public.ln_check(p_secret);
  actual := least(greatest(p_actual, 0), p_reserved);
  update public.ln_users set credits = credits + (p_reserved - actual) where id = p_user returning * into u;
  if actual > 0 then
    insert into public.ln_ledger(user_id, delta, kind, ref, meta) values (p_user, -actual, 'ai', p_bot::text, p_meta);
  end if;
  if p_teacher_share > 0 and p_bot is not null then
    select teacher_id into t from public.ln_bots where id = p_bot;
    if t is not null and t <> p_user then
      update public.ln_users set earned = earned + p_teacher_share where id = t;
      insert into public.ln_ledger(user_id, delta, kind, ref) values (t, p_teacher_share, 'teacher_fee', p_bot::text);
    end if;
  end if;
  insert into public.ln_usage_daily(day, cost_usd, credits, msgs) values (current_date, p_cost_usd, actual, 1)
  on conflict (day) do update set cost_usd = ln_usage_daily.cost_usd + excluded.cost_usd,
    credits = ln_usage_daily.credits + excluded.credits, msgs = ln_usage_daily.msgs + 1;
  return jsonb_build_object('credits', u.credits, 'charged', actual);
end $$;

-- ---------- Pi payments ----------
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
  delete from public.ln_files where user_id = p_user and created_at < now() - interval '30 days';
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
  else update public.ln_posts set reports = 0 where id = p_post; delete from public.ln_post_reports where post_id = p_post; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Only the API roles may call these; the secret check inside each one does the real gating.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'ln\_%' loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('grant execute on function %s to anon, authenticated, service_role', f.sig);
  end loop;
end $$;
