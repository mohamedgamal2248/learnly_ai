-- Learnly AI (English learning): profile, progress, vocabulary review, subscriptions, AI credit spending, admin helpers.
-- All access goes through SECURITY DEFINER functions that check the server secret (same pattern as the other ln_* tables).

create table if not exists public.ln_en_profile (
  user_id uuid primary key references public.ln_users(id),
  native text not null default 'ar' check (native in ('ar','id','vi','ko')),
  level text not null default 'A1' check (level in ('A1','A2','B1','B2')),
  xp integer not null default 0,
  goal integer not null default 1,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.ln_en_progress (
  user_id uuid not null references public.ln_users(id),
  lesson_id text not null,
  best integer not null default 0,
  attempts integer not null default 0,
  done_at timestamptz,
  primary key (user_id, lesson_id)
);
create table if not exists public.ln_en_vocab (
  user_id uuid not null references public.ln_users(id),
  word text not null,
  box integer not null default 0,
  due date not null default current_date,
  seen integer not null default 0,
  primary key (user_id, word)
);
create table if not exists public.ln_en_activity (
  user_id uuid not null references public.ln_users(id),
  day date not null,
  xp integer not null default 0,
  lessons integer not null default 0,
  primary key (user_id, day)
);
create table if not exists public.ln_en_subs (
  user_id uuid primary key references public.ln_users(id),
  plan text not null check (plan in ('plus','pro')),
  until timestamptz not null,
  started_at timestamptz not null default now(),
  payment_id text
);
alter table public.ln_payments add column if not exists item text;
create index if not exists ln_en_vocab_due_idx on public.ln_en_vocab (user_id, due);

alter table public.ln_en_profile enable row level security;
alter table public.ln_en_progress enable row level security;
alter table public.ln_en_vocab enable row level security;
alter table public.ln_en_activity enable row level security;
alter table public.ln_en_subs enable row level security;

-- Prices (USD), credits and AI costs. Editable from the admin page; the numbers here are placeholders.
insert into public.ln_config(key, value) values ('en_catalog', jsonb_build_object(
  'plans', jsonb_build_object(
    'plus', jsonb_build_object('name','Plus','usd',5,'days',30,'credits',150),
    'pro',  jsonb_build_object('name','Pro','usd',10,'days',30,'credits',400)),
  'packs', jsonb_build_array(
    jsonb_build_object('id','c1','usd',2,'credits',60),
    jsonb_build_object('id','c2','usd',5,'credits',170),
    jsonb_build_object('id','c3','usd',10,'credits',380)),
  'costs', jsonb_build_object('explain',1,'chat',1,'correct',2,'write',3),
  'ai_daily_cap', 150))
on conflict (key) do nothing;

create or replace function public.ln_en_catalog(p_secret text) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  return (select value from public.ln_config where key = 'en_catalog');
end $$;

create or replace function public.ln_en_catalog_set(p_secret text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  if jsonb_typeof(p_value->'plans') <> 'object' or jsonb_typeof(p_value->'packs') <> 'array' or jsonb_typeof(p_value->'costs') <> 'object' then
    raise exception 'bad catalog';
  end if;
  insert into public.ln_config(key, value) values ('en_catalog', p_value)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return p_value;
end $$;

create or replace function public.ln_en_state(p_secret text, p_user uuid) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare pr public.ln_en_profile; u public.ln_users; s public.ln_en_subs; act boolean;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  if not found then return null; end if;
  insert into public.ln_en_profile(user_id) values (p_user) on conflict do nothing;
  select * into pr from public.ln_en_profile where user_id = p_user;
  select * into s from public.ln_en_subs where user_id = p_user;
  act := s.user_id is not null and s.until > now();
  return jsonb_build_object(
    'profile', to_jsonb(pr) - 'user_id' - 'created_at',
    'sub', jsonb_build_object('plan', case when act then s.plan end, 'until', s.until, 'active', act),
    'credits', u.credits,
    'streak', case when u.streak_day is not null and u.streak_day >= current_date - 1 then u.streak else 0 end,
    'best', u.best_streak,
    'today_done', (u.streak_day = current_date),
    'progress', coalesce((select jsonb_agg(jsonb_build_object('id', lesson_id, 'best', best, 'done', done_at is not null)) from public.ln_en_progress where user_id = p_user), '[]'::jsonb),
    'week', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'xp', xp)) from public.ln_en_activity where user_id = p_user and day >= current_date - 6), '[]'::jsonb),
    'due', (select count(*) from public.ln_en_vocab where user_id = p_user and due <= current_date));
end $$;

create or replace function public.ln_en_sub_plan(p_secret text, p_user uuid) returns text
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  return (select plan from public.ln_en_subs where user_id = p_user and until > now());
end $$;

create or replace function public.ln_en_profile_set(p_secret text, p_user uuid, p_native text, p_level text, p_goal integer, p_onboarded boolean) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  insert into public.ln_en_profile(user_id) values (p_user) on conflict do nothing;
  update public.ln_en_profile set
    native = coalesce(p_native, native), level = coalesce(p_level, level),
    goal = least(greatest(coalesce(p_goal, goal), 1), 5), onboarded = coalesce(p_onboarded, onboarded)
  where user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

-- A lesson was finished with p_score correct answers out of p_total. XP is full the first time, small after that.
create or replace function public.ln_en_complete(p_secret text, p_user uuid, p_lesson text, p_score integer, p_total integer, p_words text[]) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare first_time boolean; gain integer; u public.ln_users; w text; sc integer;
begin
  perform public.ln_check(p_secret);
  sc := least(greatest(p_score, 0), greatest(p_total, 0));
  insert into public.ln_en_profile(user_id) values (p_user) on conflict do nothing;
  select (done_at is null) into first_time from public.ln_en_progress where user_id = p_user and lesson_id = p_lesson;
  first_time := coalesce(first_time, true);
  gain := case when first_time then 10 + sc * 2 else 2 end;
  insert into public.ln_en_progress(user_id, lesson_id, best, attempts, done_at) values (p_user, p_lesson, sc, 1, now())
  on conflict (user_id, lesson_id) do update set best = greatest(public.ln_en_progress.best, sc),
    attempts = public.ln_en_progress.attempts + 1, done_at = coalesce(public.ln_en_progress.done_at, now());
  update public.ln_en_profile set xp = xp + gain where user_id = p_user;
  insert into public.ln_en_activity(user_id, day, xp, lessons) values (p_user, current_date, gain, 1)
  on conflict (user_id, day) do update set xp = public.ln_en_activity.xp + gain, lessons = public.ln_en_activity.lessons + 1;
  select * into u from public.ln_users where id = p_user for update;
  if u.streak_day is distinct from current_date then
    update public.ln_users set
      streak = case when u.streak_day = current_date - 1 then u.streak + 1 else 1 end,
      best_streak = greatest(u.best_streak, case when u.streak_day = current_date - 1 then u.streak + 1 else 1 end),
      streak_day = current_date
    where id = p_user returning * into u;
  end if;
  foreach w in array coalesce(p_words, '{}') loop
    insert into public.ln_en_vocab(user_id, word) values (p_user, left(w, 60)) on conflict do nothing;
  end loop;
  return jsonb_build_object('gain', gain, 'xp', (select xp from public.ln_en_profile where user_id = p_user), 'streak', u.streak, 'first', first_time);
end $$;

create or replace function public.ln_en_vocab_due(p_secret text, p_user uuid, p_limit integer) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('word', word, 'box', box)) from (
    select word, box from public.ln_en_vocab where user_id = p_user and due <= current_date
    order by due, box limit least(greatest(p_limit, 1), 50)) x), '[]'::jsonb);
end $$;

create or replace function public.ln_en_vocab_review(p_secret text, p_user uuid, p_word text, p_ok boolean) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare b integer; steps integer[] := array[0,1,2,4,8,16,30];
begin
  perform public.ln_check(p_secret);
  select box into b from public.ln_en_vocab where user_id = p_user and word = p_word;
  if not found then return jsonb_build_object('ok', false); end if;
  b := case when p_ok then least(b + 1, 6) else 0 end;
  update public.ln_en_vocab set box = b, seen = seen + 1, due = current_date + steps[b + 1] where user_id = p_user and word = p_word;
  if p_ok and b >= 1 then
    insert into public.ln_en_activity(user_id, day, xp, lessons) values (p_user, current_date, 1, 0)
    on conflict (user_id, day) do update set xp = public.ln_en_activity.xp + 1;
    update public.ln_en_profile set xp = xp + 1 where user_id = p_user;
  end if;
  return jsonb_build_object('ok', true, 'box', b);
end $$;

-- AI credits: only for people with an active plan; daily cap protects against runaway use.
create or replace function public.ln_en_spend(p_secret text, p_user uuid, p_cost integer, p_kind text, p_ref text) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare u public.ln_users; s public.ln_en_subs; cap integer; used integer;
begin
  perform public.ln_check(p_secret);
  if p_cost < 1 or p_cost > 50 then raise exception 'bad cost'; end if;
  select * into u from public.ln_users where id = p_user for update;
  if not found or u.banned then return jsonb_build_object('ok', false, 'reason', 'no_user'); end if;
  select * into s from public.ln_en_subs where user_id = p_user;
  if s.user_id is null or s.until <= now() then return jsonb_build_object('ok', false, 'reason', 'no_plan'); end if;
  cap := coalesce((select (value->>'ai_daily_cap')::integer from public.ln_config where key = 'en_catalog'), 150);
  select coalesce(sum(-delta), 0) into used from public.ln_ledger
    where user_id = p_user and delta < 0 and kind like 'ai\_%' and created_at >= date_trunc('day', now());
  if used + p_cost > cap then return jsonb_build_object('ok', false, 'reason', 'daily_cap', 'credits', u.credits); end if;
  if u.credits < p_cost then return jsonb_build_object('ok', false, 'reason', 'no_credits', 'credits', u.credits); end if;
  update public.ln_users set credits = credits - p_cost where id = p_user returning * into u;
  insert into public.ln_ledger(user_id, delta, kind, ref) values (p_user, -p_cost, 'ai_' || left(p_kind, 20), left(p_ref, 80));
  return jsonb_build_object('ok', true, 'credits', u.credits);
end $$;

create or replace function public.ln_en_refund(p_secret text, p_user uuid, p_cost integer, p_ref text) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare u public.ln_users;
begin
  perform public.ln_check(p_secret);
  update public.ln_users set credits = credits + least(greatest(p_cost, 0), 50) where id = p_user returning * into u;
  insert into public.ln_ledger(user_id, delta, kind, ref) values (p_user, least(greatest(p_cost, 0), 50), 'ai_refund', left(p_ref, 80));
  return jsonb_build_object('ok', true, 'credits', u.credits);
end $$;

-- Starting a payment for a plan (credits = the plan's credits) or a credit pack (credits = pack credits; needs an active plan).
create or replace function public.ln_en_pay_start(p_secret text, p_payment text, p_user uuid, p_pi numeric, p_usd numeric, p_item text, p_credits integer) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  if p_item not like 'plan:%' and p_item not like 'pack:%' then raise exception 'bad item'; end if;
  if p_item like 'pack:%' and not exists (select 1 from public.ln_en_subs where user_id = p_user and until > now()) then
    raise exception 'plan_required';
  end if;
  insert into public.ln_payments(pi_payment_id, user_id, pi_amount, usd, credits, item)
  values (p_payment, p_user, p_pi, p_usd, p_credits, p_item) on conflict (pi_payment_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- Completes a payment: plans start or extend the subscription and add the plan's credits; everything else goes through the old function.
create or replace function public.ln_payment_complete2(p_secret text, p_payment text, p_txid text) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare p public.ln_payments; u public.ln_users; plan_id text; days integer; cur timestamptz;
begin
  perform public.ln_check(p_secret);
  select * into p from public.ln_payments where pi_payment_id = p_payment for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_payment'); end if;
  if p.item like 'plan:%' and p.status <> 'completed' then
    plan_id := substr(p.item, 6);
    days := coalesce((select (value->'plans'->plan_id->>'days')::integer from public.ln_config where key = 'en_catalog'), 30);
    update public.ln_payments set status = 'completed', txid = p_txid, completed_at = now() where pi_payment_id = p_payment;
    select until into cur from public.ln_en_subs where user_id = p.user_id;
    insert into public.ln_en_subs(user_id, plan, until, payment_id) values (p.user_id, plan_id, now() + make_interval(days => days), p_payment)
    on conflict (user_id) do update set plan = excluded.plan, payment_id = p_payment,
      until = greatest(now(), coalesce(cur, now())) + make_interval(days => days);
    update public.ln_users set credits = credits + p.credits, paid = true where id = p.user_id returning * into u;
    insert into public.ln_ledger(user_id, delta, kind, ref) values (p.user_id, p.credits, 'plan', p_payment);
    return jsonb_build_object('ok', true, 'plan', plan_id, 'credits', u.credits, 'added', p.credits,
      'until', (select until from public.ln_en_subs where user_id = p.user_id));
  end if;
  return public.ln_payment_complete(p_secret, p_payment, p_txid);
end $$;

-- Admin helpers
create or replace function public.ln_en_admin_overview(p_secret text) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  return jsonb_build_object(
    'learners', (select count(*) from public.ln_en_profile),
    'onboarded', (select count(*) from public.ln_en_profile where onboarded),
    'plus', (select count(*) from public.ln_en_subs where plan = 'plus' and until > now()),
    'pro', (select count(*) from public.ln_en_subs where plan = 'pro' and until > now()),
    'revenue_usd', coalesce((select sum(usd) from public.ln_payments where status = 'completed' and item is not null), 0),
    'revenue_pi', coalesce((select sum(pi_amount) from public.ln_payments where status = 'completed' and item is not null), 0),
    'lessons_done', (select count(*) from public.ln_en_progress where done_at is not null),
    'ai_credits_30d', coalesce((select sum(-delta) from public.ln_ledger where kind like 'ai\_%' and delta < 0 and created_at > now() - interval '30 days'), 0),
    'ai_calls_30d', (select count(*) from public.ln_ledger where kind like 'ai\_%' and delta < 0 and created_at > now() - interval '30 days'),
    'teacher_pending', (select count(*) from public.ln_teacher_apps where status = 'pending'),
    'catalog', (select value from public.ln_config where key = 'en_catalog'));
end $$;

create or replace function public.ln_en_admin_grant(p_secret text, p_username text, p_plan text, p_days integer, p_credits integer) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare uid uuid; cur timestamptz;
begin
  perform public.ln_check(p_secret);
  select id into uid from public.ln_users where lower(username) = lower(p_username);
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'no_user'); end if;
  if p_plan in ('plus','pro') and p_days > 0 then
    select until into cur from public.ln_en_subs where user_id = uid;
    insert into public.ln_en_subs(user_id, plan, until, payment_id) values (uid, p_plan, now() + make_interval(days => least(p_days, 366)), 'admin')
    on conflict (user_id) do update set plan = excluded.plan, until = greatest(now(), coalesce(cur, now())) + make_interval(days => least(p_days, 366));
  end if;
  if coalesce(p_credits, 0) <> 0 then
    update public.ln_users set credits = greatest(credits + p_credits, 0) where id = uid;
    insert into public.ln_ledger(user_id, delta, kind, ref) values (uid, p_credits, 'grant', 'admin');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_en_admin_apps(p_secret text, p_status text) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select a.id, a.display_name, a.subjects, a.bio, a.years, a.doc_name, a.doc_type, a.status, a.reason, a.created_at, u.username
    from public.ln_teacher_apps a join public.ln_users u on u.id = a.user_id
    where p_status is null or a.status = p_status order by a.created_at desc limit 100) x), '[]'::jsonb);
end $$;

create or replace function public.ln_en_teacher_status(p_secret text, p_user uuid) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  return (select jsonb_build_object('status', status, 'reason', reason, 'created_at', created_at)
          from public.ln_teacher_apps where user_id = p_user order by created_at desc limit 1);
end $$;

-- Free users never get AI, so the old welcome gift of credits is switched off.
update public.ln_config set value = jsonb_set(value, '{welcome_credits}', '0'::jsonb) where key = 'limits';

create or replace function public.ln_en_admin_users(p_secret text, p_search text, p_limit integer, p_offset integer) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  return jsonb_build_object(
    'total', (select count(*) from public.ln_users where p_search is null or username ilike '%' || p_search || '%'),
    'rows', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select u.id, u.username, u.role, u.banned, u.created_at, u.credits,
        (select case when s.until > now() then s.plan end from public.ln_en_subs s where s.user_id = u.id) as plan,
        (select s.until from public.ln_en_subs s where s.user_id = u.id) as plan_until,
        (select p.xp from public.ln_en_profile p where p.user_id = u.id) as xp,
        u.streak
      from public.ln_users u
      where p_search is null or u.username ilike '%' || p_search || '%'
      order by u.created_at desc
      limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb));
end $$;
