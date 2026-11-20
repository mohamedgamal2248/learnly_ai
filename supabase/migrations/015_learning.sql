-- Learning habits: daily streak, quiz mistakes to review, and a personal AI study plan.
alter table public.ln_users add column if not exists streak integer not null default 0;
alter table public.ln_users add column if not exists best_streak integer not null default 0;
alter table public.ln_users add column if not exists streak_day date;
alter table public.ln_users add column if not exists plan jsonb;

create table if not exists public.ln_mistakes (
  id bigserial primary key,
  user_id uuid not null references public.ln_users(id) on delete cascade,
  course_id uuid not null references public.ln_courses(id) on delete cascade,
  lesson_id text not null,
  question text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_id, question)
);
alter table public.ln_mistakes enable row level security;

-- Counts a learning day. Same day: no change; next day: +1; gap: back to 1.
create or replace function public.ln_touch_streak(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users;
begin
  perform public.ln_check(p_secret);
  update public.ln_users set
    streak = case when streak_day = current_date then streak when streak_day = current_date - 1 then streak + 1 else 1 end,
    streak_day = current_date
  where id = p_user returning * into u;
  update public.ln_users set best_streak = greatest(best_streak, streak) where id = p_user;
  return jsonb_build_object('streak', u.streak);
end $$;

create or replace function public.ln_mistakes_note(p_secret text, p_user uuid, p_course uuid, p_lesson text, p_questions text[], p_passed boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if p_passed then
    update public.ln_mistakes set resolved = true where user_id = p_user and course_id = p_course and lesson_id = p_lesson;
  else
    insert into public.ln_mistakes(user_id, course_id, lesson_id, question)
      select p_user, p_course, p_lesson, left(q, 400) from unnest(p_questions[1:10]) q
      on conflict (user_id, course_id, lesson_id, question) do update set resolved = false, created_at = now();
  end if;
end $$;

create or replace function public.ln_set_plan(p_secret text, p_user uuid, p_plan jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_users set plan = p_plan where id = p_user;
end $$;

-- Everything for the "My learning" page in one call.
create or replace function public.ln_learning(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  return jsonb_build_object(
    'streak', case when u.streak_day >= current_date - 1 then u.streak else 0 end,
    'best', u.best_streak, 'today', u.streak_day = current_date, 'plan', u.plan,
    'courses', public.ln_my_enrollments(p_secret, p_user),
    'certs', public.ln_my_certs(p_secret, p_user),
    'mistakes', coalesce((select jsonb_agg(jsonb_build_object('course', m.course_id, 'lesson', m.lesson_id, 'question', m.question,
        'title', c.title, 'title_en', c.title_en) order by m.created_at desc)
      from (select * from public.ln_mistakes where user_id = p_user and not resolved order by created_at desc limit 20) m
      join public.ln_courses c on c.id = m.course_id), '[]'::jsonb));
end $$;

grant execute on function public.ln_touch_streak(text, uuid) to anon;
grant execute on function public.ln_mistakes_note(text, uuid, uuid, text, text[], boolean) to anon;
grant execute on function public.ln_set_plan(text, uuid, jsonb) to anon;
grant execute on function public.ln_learning(text, uuid) to anon;
