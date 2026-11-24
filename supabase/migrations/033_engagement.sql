-- Engagement features: daily XP goal, streak freeze, mistakes, stats, weekly ranking, free trial, reports, Telegram reminders.

alter table public.ln_en_profile
  add column if not exists reminder_hour integer check (reminder_hour between 0 and 23),
  add column if not exists tz_offset integer not null default 0 check (tz_offset between -12 and 14),
  add column if not exists tg_chat bigint,
  add column if not exists tg_code text,
  add column if not exists hide_rank boolean not null default false,
  add column if not exists trial_used boolean not null default false,
  add column if not exists freezes integer not null default 1 check (freezes between 0 and 2);
alter table public.ln_en_activity
  add column if not exists correct integer not null default 0,
  add column if not exists total integer not null default 0,
  add column if not exists seconds integer not null default 0;
alter table public.ln_en_vocab
  add column if not exists missed integer not null default 0,
  add column if not exists last_missed date;

create table if not exists public.ln_en_reports (
  id bigserial primary key,
  user_id uuid not null references public.ln_users(id),
  lesson_id text not null,
  word text,
  note text,
  status text not null default 'open' check (status in ('open','fixed','dismissed')),
  created_at timestamptz not null default now()
);
alter table public.ln_en_reports enable row level security;
create index if not exists ln_en_activity_day_idx on public.ln_en_activity (day, user_id);

update public.ln_config set value = jsonb_set(value, '{trial}', jsonb_build_object('days', 3, 'credits', 20)) where key = 'en_catalog' and not (value ? 'trial');

create or replace function public.ln_en_state(p_secret text, p_user uuid) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare pr public.ln_en_profile; u public.ln_users; s public.ln_en_subs; act boolean; xpt integer;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  if not found then return null; end if;
  insert into public.ln_en_profile(user_id) values (p_user) on conflict do nothing;
  select * into pr from public.ln_en_profile where user_id = p_user;
  select * into s from public.ln_en_subs where user_id = p_user;
  act := s.user_id is not null and s.until > now();
  select coalesce(xp, 0) into xpt from public.ln_en_activity where user_id = p_user and day = current_date;
  return jsonb_build_object(
    'profile', to_jsonb(pr) - 'user_id' - 'created_at' - 'tg_chat' - 'tg_code',
    'sub', jsonb_build_object('plan', case when act then s.plan end, 'until', s.until, 'active', act),
    'credits', u.credits,
    'streak', case when u.streak_day is not null and (u.streak_day >= current_date - 1 or (u.streak_day = current_date - 2 and pr.freezes > 0)) then u.streak else 0 end,
    'best', u.best_streak,
    'today_done', (u.streak_day = current_date),
    'xp_today', coalesce(xpt, 0), 'xp_goal', pr.goal * 20, 'freezes', pr.freezes,
    'trial_available', (not pr.trial_used and not act),
    'tg_linked', pr.tg_chat is not null,
    'progress', coalesce((select jsonb_agg(jsonb_build_object('id', lesson_id, 'best', best, 'done', done_at is not null)) from public.ln_en_progress where user_id = p_user), '[]'::jsonb),
    'week', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'xp', xp)) from public.ln_en_activity where user_id = p_user and day >= current_date - 6), '[]'::jsonb),
    'due', (select count(*) from public.ln_en_vocab where user_id = p_user and due <= current_date),
    'mistakes', (select count(*) from public.ln_en_vocab where user_id = p_user and missed > 0));
end $$;

create or replace function public.ln_en_complete2(p_secret text, p_user uuid, p_lesson text, p_score integer, p_total integer, p_words text[], p_missed text[], p_correct integer, p_answers integer, p_seconds integer) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare first_time boolean; gain integer; u public.ln_users; pr public.ln_en_profile; w text; sc integer; before_xp integer; goal integer; ns integer; used boolean := false;
begin
  perform public.ln_check(p_secret);
  sc := least(greatest(p_score, 0), greatest(p_total, 0));
  insert into public.ln_en_profile(user_id) values (p_user) on conflict do nothing;
  select * into pr from public.ln_en_profile where user_id = p_user for update;
  goal := pr.goal * 20;
  select coalesce(xp, 0) into before_xp from public.ln_en_activity where user_id = p_user and day = current_date;
  before_xp := coalesce(before_xp, 0);
  select (done_at is null) into first_time from public.ln_en_progress where user_id = p_user and lesson_id = p_lesson;
  first_time := coalesce(first_time, true);
  gain := case when first_time then 10 + sc * 2 else 2 end;
  insert into public.ln_en_progress(user_id, lesson_id, best, attempts, done_at) values (p_user, p_lesson, sc, 1, now())
  on conflict (user_id, lesson_id) do update set best = greatest(public.ln_en_progress.best, sc),
    attempts = public.ln_en_progress.attempts + 1, done_at = coalesce(public.ln_en_progress.done_at, now());
  update public.ln_en_profile set xp = xp + gain where user_id = p_user;
  insert into public.ln_en_activity(user_id, day, xp, lessons, correct, total, seconds)
  values (p_user, current_date, gain, 1, least(greatest(p_correct, 0), 200), least(greatest(p_answers, 0), 200), least(greatest(p_seconds, 0), 3600))
  on conflict (user_id, day) do update set xp = public.ln_en_activity.xp + gain, lessons = public.ln_en_activity.lessons + 1,
    correct = public.ln_en_activity.correct + least(greatest(p_correct, 0), 200), total = public.ln_en_activity.total + least(greatest(p_answers, 0), 200),
    seconds = public.ln_en_activity.seconds + least(greatest(p_seconds, 0), 3600);
  select * into u from public.ln_users where id = p_user for update;
  if u.streak_day is distinct from current_date then
    if u.streak_day = current_date - 1 then ns := u.streak + 1;
    elsif u.streak_day = current_date - 2 and pr.freezes > 0 then ns := u.streak + 1; used := true;
    else ns := 1; end if;
    update public.ln_users set streak = ns, best_streak = greatest(u.best_streak, ns), streak_day = current_date where id = p_user returning * into u;
    if used then update public.ln_en_profile set freezes = freezes - 1 where user_id = p_user; end if;
    if ns % 7 = 0 then update public.ln_en_profile set freezes = least(freezes + 1, 2) where user_id = p_user; end if;
  end if;
  foreach w in array coalesce(p_words, '{}') loop
    insert into public.ln_en_vocab(user_id, word) values (p_user, left(w, 60)) on conflict do nothing;
  end loop;
  foreach w in array coalesce(p_missed, '{}') loop
    update public.ln_en_vocab set missed = least(missed + 1, 9), last_missed = current_date, box = 0, due = current_date + 2 where user_id = p_user and word = left(w, 60);
  end loop;
  select * into pr from public.ln_en_profile where user_id = p_user;
  return jsonb_build_object('gain', gain, 'xp', pr.xp, 'streak', u.streak, 'first', first_time, 'freezes', pr.freezes, 'used_freeze', used,
    'xp_today', before_xp + gain, 'xp_goal', goal, 'goal_reached', (before_xp < goal and before_xp + gain >= goal));
end $$;

create or replace function public.ln_en_vocab_review(p_secret text, p_user uuid, p_word text, p_ok boolean) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare b integer; m integer; steps integer[] := array[0,1,2,4,8,16,30];
begin
  perform public.ln_check(p_secret);
  select box, missed into b, m from public.ln_en_vocab where user_id = p_user and word = p_word;
  if not found then return jsonb_build_object('ok', false); end if;
  b := case when p_ok then least(b + 1, 6) else 0 end;
  m := case when p_ok then greatest(m - 1, 0) else least(m + 1, 9) end;
  update public.ln_en_vocab set box = b, missed = m, last_missed = case when p_ok then last_missed else current_date end,
    seen = seen + 1, due = current_date + case when p_ok then steps[b + 1] else 1 end where user_id = p_user and word = p_word;
  if p_ok and b >= 1 then
    insert into public.ln_en_activity(user_id, day, xp, lessons) values (p_user, current_date, 1, 0)
    on conflict (user_id, day) do update set xp = public.ln_en_activity.xp + 1;
    update public.ln_en_profile set xp = xp + 1 where user_id = p_user;
  end if;
  return jsonb_build_object('ok', true, 'box', b, 'missed', m);
end $$;

create or replace function public.ln_en_mistakes(p_secret text, p_user uuid, p_limit integer) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('word', word, 'missed', missed, 'last', last_missed, 'due', due)) from (
    select word, missed, last_missed, due from public.ln_en_vocab where user_id = p_user and missed > 0
    order by missed desc, last_missed desc limit least(greatest(p_limit, 1), 100)) x), '[]'::jsonb);
end $$;

create or replace function public.ln_en_stats(p_secret text, p_user uuid) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  return jsonb_build_object(
    'words', (select count(*) from public.ln_en_vocab where user_id = p_user),
    'mastered', (select count(*) from public.ln_en_vocab where user_id = p_user and box >= 4),
    'lessons', (select count(*) from public.ln_en_progress where user_id = p_user and done_at is not null),
    'accuracy', (select case when sum(total) > 0 then round(100.0 * sum(correct) / sum(total)) end from public.ln_en_activity where user_id = p_user and day >= current_date - 29),
    'minutes_total', (select coalesce(sum(seconds), 0) / 60 from public.ln_en_activity where user_id = p_user),
    'xp', (select xp from public.ln_en_profile where user_id = p_user),
    'best', (select best_streak from public.ln_users where id = p_user),
    'mistakes', (select count(*) from public.ln_en_vocab where user_id = p_user and missed > 0),
    'week', (select jsonb_agg(jsonb_build_object('day', d::date, 'xp', coalesce(a.xp, 0), 'minutes', coalesce(a.seconds, 0) / 60) order by d)
             from generate_series(current_date - 6, current_date, interval '1 day') d
             left join public.ln_en_activity a on a.user_id = p_user and a.day = d::date));
end $$;

create or replace function public.ln_en_leaderboard(p_secret text, p_user uuid, p_limit integer) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare ws date := date_trunc('week', current_date)::date; my integer; rk integer; hid boolean;
begin
  perform public.ln_check(p_secret);
  select coalesce(sum(xp), 0) into my from public.ln_en_activity where user_id = p_user and day >= ws;
  select hide_rank into hid from public.ln_en_profile where user_id = p_user;
  select 1 + count(*) into rk from (select user_id, sum(xp) s from public.ln_en_activity where day >= ws group by user_id) t where t.s > my;
  return jsonb_build_object('week_start', ws, 'hidden', coalesce(hid, false), 'me', jsonb_build_object('xp', my, 'rank', rk),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('username', username, 'xp', s, 'me', uid = p_user)) from (
      select u.username, t.s, u.id uid from (select user_id, sum(xp) s from public.ln_en_activity where day >= ws group by user_id) t
      join public.ln_users u on u.id = t.user_id join public.ln_en_profile p on p.user_id = t.user_id
      where not p.hide_rank and not u.banned and t.s > 0 order by t.s desc, u.username limit least(greatest(p_limit, 1), 50)) z), '[]'::jsonb));
end $$;

create or replace function public.ln_en_rank_hide(p_secret text, p_user uuid, p_hide boolean) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  insert into public.ln_en_profile(user_id) values (p_user) on conflict do nothing;
  update public.ln_en_profile set hide_rank = p_hide where user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_en_trial_start(p_secret text, p_user uuid) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare pr public.ln_en_profile; days integer; cr integer;
begin
  perform public.ln_check(p_secret);
  insert into public.ln_en_profile(user_id) values (p_user) on conflict do nothing;
  select * into pr from public.ln_en_profile where user_id = p_user for update;
  if pr.trial_used then return jsonb_build_object('ok', false, 'reason', 'used'); end if;
  if exists (select 1 from public.ln_en_subs where user_id = p_user and until > now()) then return jsonb_build_object('ok', false, 'reason', 'has_plan'); end if;
  days := coalesce((select (value->'trial'->>'days')::integer from public.ln_config where key = 'en_catalog'), 3);
  cr := coalesce((select (value->'trial'->>'credits')::integer from public.ln_config where key = 'en_catalog'), 20);
  insert into public.ln_en_subs(user_id, plan, until, payment_id) values (p_user, 'plus', now() + make_interval(days => days), 'trial')
  on conflict (user_id) do update set plan = 'plus', until = now() + make_interval(days => days), payment_id = 'trial';
  update public.ln_en_profile set trial_used = true where user_id = p_user;
  update public.ln_users set credits = credits + cr where id = p_user;
  insert into public.ln_ledger(user_id, delta, kind, ref) values (p_user, cr, 'trial', 'trial');
  return jsonb_build_object('ok', true, 'days', days, 'credits', cr);
end $$;

create or replace function public.ln_en_report_add(p_secret text, p_user uuid, p_lesson text, p_word text, p_note text) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  if (select count(*) from public.ln_en_reports where user_id = p_user and created_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'limit');
  end if;
  insert into public.ln_en_reports(user_id, lesson_id, word, note) values (p_user, left(p_lesson, 20), left(p_word, 60), left(p_note, 500));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_en_admin_reports(p_secret text, p_status text) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select r.id, r.lesson_id, r.word, r.note, r.status, r.created_at, u.username from public.ln_en_reports r join public.ln_users u on u.id = r.user_id
    where p_status is null or r.status = p_status order by r.created_at desc limit 100) x), '[]'::jsonb);
end $$;

create or replace function public.ln_en_admin_report_set(p_secret text, p_id bigint, p_status text) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  if p_status not in ('open','fixed','dismissed') then raise exception 'bad status'; end if;
  update public.ln_en_reports set status = p_status where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_en_reminder_set(p_secret text, p_user uuid, p_hour integer, p_tz integer) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  insert into public.ln_en_profile(user_id) values (p_user) on conflict do nothing;
  update public.ln_en_profile set reminder_hour = case when p_hour between 0 and 23 then p_hour end, tz_offset = least(greatest(coalesce(p_tz, 0), -12), 14) where user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_en_tg_code(p_secret text, p_user uuid) returns text
language plpgsql security definer set search_path to 'public','extensions' as $$
declare c text := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
begin
  perform public.ln_check(p_secret);
  insert into public.ln_en_profile(user_id) values (p_user) on conflict do nothing;
  update public.ln_en_profile set tg_code = c where user_id = p_user;
  return c;
end $$;

create or replace function public.ln_en_tg_link(p_secret text, p_code text, p_chat bigint) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare uid uuid; nm text;
begin
  perform public.ln_check(p_secret);
  select user_id into uid from public.ln_en_profile where tg_code = upper(p_code) and p_code is not null and length(p_code) >= 8;
  if uid is null then return jsonb_build_object('ok', false); end if;
  update public.ln_en_profile set tg_chat = p_chat, tg_code = null, reminder_hour = coalesce(reminder_hour, 19) where user_id = uid;
  select username into nm from public.ln_users where id = uid;
  return jsonb_build_object('ok', true, 'username', nm, 'native', (select native from public.ln_en_profile where user_id = uid));
end $$;

create or replace function public.ln_en_tg_unlink(p_secret text, p_user uuid, p_chat bigint) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_en_profile set tg_chat = null where (user_id = p_user or (p_user is null and tg_chat = p_chat));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_en_reminders_due(p_secret text, p_utc_hour integer) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('chat', p.tg_chat, 'name', u.username, 'native', p.native,
      'streak', case when u.streak_day >= current_date - 1 then u.streak else 0 end, 'xp_goal', p.goal * 20))
    from public.ln_en_profile p join public.ln_users u on u.id = p.user_id
    where p.tg_chat is not null and p.reminder_hour is not null and not u.banned
      and ((p_utc_hour + p.tz_offset + 48) % 24) = p.reminder_hour
      and (u.streak_day is null or u.streak_day < current_date)), '[]'::jsonb);
end $$;
