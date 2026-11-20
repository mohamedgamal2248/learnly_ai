-- Ratings and reviews for bots and courses. Only people who really used them can rate.
create table if not exists public.ln_reviews (
  user_id uuid not null references public.ln_users(id) on delete cascade,
  kind text not null check (kind in ('bot','course')),
  target uuid not null,
  stars integer not null check (stars between 1 and 5),
  body text not null default '',
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, target)
);
create index if not exists ln_reviews_target_idx on public.ln_reviews(kind, target, created_at desc);
alter table public.ln_reviews enable row level security;

create or replace function public.ln_review_save(p_secret text, p_user uuid, p_kind text, p_target uuid, p_stars integer, p_body text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if p_kind = 'bot' then
    if not exists (select 1 from public.ln_chats where user_id = p_user and bot_id = p_target and msgs >= 4) then
      return jsonb_build_object('ok', false, 'reason', 'use_first'); end if;
    if exists (select 1 from public.ln_bots where id = p_target and teacher_id = p_user) then
      return jsonb_build_object('ok', false, 'reason', 'own'); end if;
  elsif p_kind = 'course' then
    if not exists (select 1 from public.ln_enrollments where user_id = p_user and course_id = p_target) then
      return jsonb_build_object('ok', false, 'reason', 'use_first'); end if;
    if exists (select 1 from public.ln_courses where id = p_target and creator_id = p_user) then
      return jsonb_build_object('ok', false, 'reason', 'own'); end if;
  else return jsonb_build_object('ok', false, 'reason', 'bad_kind');
  end if;
  insert into public.ln_reviews(user_id, kind, target, stars, body) values (p_user, p_kind, p_target, greatest(1, least(5, p_stars)), left(coalesce(p_body, ''), 500))
    on conflict (user_id, kind, target) do update set stars = excluded.stars, body = excluded.body, created_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- Averages for every rated bot and course (small; cached by the API).
create or replace function public.ln_ratings(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_object_agg(target::text, jsonb_build_object('avg', round(avg_s, 1), 'n', n))
    from (select target, avg(stars) as avg_s, count(*) as n from public.ln_reviews where not hidden group by target) r), '{}'::jsonb);
end $$;

create or replace function public.ln_reviews_list(p_secret text, p_kind text, p_target uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return jsonb_build_object(
    'list', coalesce((select jsonb_agg(jsonb_build_object('username', u.username, 'stars', r.stars, 'body', r.body, 'at', r.created_at) order by r.created_at desc)
      from (select * from public.ln_reviews where kind = p_kind and target = p_target and not hidden and body <> '' order by created_at desc limit 20) r
      join public.ln_users u on u.id = r.user_id), '[]'::jsonb),
    'mine', (select jsonb_build_object('stars', stars, 'body', body) from public.ln_reviews where user_id = p_user and kind = p_kind and target = p_target));
end $$;

grant execute on function public.ln_review_save(text, uuid, text, uuid, integer, text) to anon;
grant execute on function public.ln_ratings(text) to anon;
grant execute on function public.ln_reviews_list(text, text, uuid, uuid) to anon;
