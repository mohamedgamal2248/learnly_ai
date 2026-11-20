-- Courses: lessons with quizzes, bought with Pi (or free), progress and certificates.
create table if not exists public.ln_courses (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.ln_users(id) on delete cascade,
  bot_id uuid references public.ln_bots(id) on delete set null,
  title text not null, title_en text not null default '',
  description text not null default '', description_en text not null default '',
  track text not null default 'school',
  price_pi numeric(12,4) not null default 0 check (price_pi >= 0 and price_pi <= 1000),
  lessons jsonb not null default '[]'::jsonb,
  status text not null default 'review' check (status in ('review','live','rejected','paused')),
  students integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ln_courses_status_idx on public.ln_courses(status, updated_at desc);
alter table public.ln_courses enable row level security;

create table if not exists public.ln_enrollments (
  user_id uuid not null references public.ln_users(id) on delete cascade,
  course_id uuid not null references public.ln_courses(id) on delete cascade,
  paid_pi numeric(12,4) not null default 0,
  payment_id text,
  progress jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table public.ln_enrollments enable row level security;

alter table public.ln_payments add column if not exists course_id uuid;

-- Lessons as learners see them: never the quiz answers; full bodies only when allowed.
create or replace function public.ln_lessons_public(p_lessons jsonb, p_full boolean)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l->>'id', 'title', l->>'title',
      'body', case when p_full or ord = 1 then l->>'body' else null end,
      'quiz', case when p_full or ord = 1 then (select coalesce(jsonb_agg(q - 'answer'), '[]'::jsonb) from jsonb_array_elements(coalesce(l->'quiz', '[]'::jsonb)) q) else null end,
      'locked', not (p_full or ord = 1)) order by ord), '[]'::jsonb)
  from jsonb_array_elements(p_lessons) with ordinality as t(l, ord);
$$;

create or replace function public.ln_courses_list(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'title_en', c.title_en,
      'description', c.description, 'description_en', c.description_en, 'track', c.track, 'price_pi', c.price_pi,
      'lessons', jsonb_array_length(c.lessons), 'students', c.students, 'creator', u.username, 'bot_id', c.bot_id) order by c.students desc, c.updated_at desc)
    from public.ln_courses c join public.ln_users u on u.id = c.creator_id where c.status = 'live'), '[]'::jsonb);
end $$;

create or replace function public.ln_course_get(p_secret text, p_user uuid, p_course uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare c public.ln_courses; e public.ln_enrollments; r text; owner boolean; see_all boolean;
begin
  perform public.ln_check(p_secret);
  select * into c from public.ln_courses where id = p_course;
  if c.id is null then return null; end if;
  select role into r from public.ln_users where id = p_user;
  owner := coalesce(c.creator_id = p_user, false) or coalesce(r = 'admin', false);
  if c.status <> 'live' and not owner then return null; end if;
  select * into e from public.ln_enrollments where user_id = p_user and course_id = p_course;
  see_all := owner or e.user_id is not null;
  return jsonb_build_object('id', c.id, 'title', c.title, 'title_en', c.title_en, 'description', c.description,
    'description_en', c.description_en, 'track', c.track, 'price_pi', c.price_pi, 'students', c.students, 'status', c.status,
    'bot_id', c.bot_id, 'creator', (select username from public.ln_users where id = c.creator_id),
    'enrolled', e.user_id is not null, 'owner', owner, 'progress', coalesce(e.progress, '{}'::jsonb), 'completed', e.completed_at is not null,
    'lessons', public.ln_lessons_public(c.lessons, see_all));
end $$;

-- Server-only: the full course (with answers) for grading and editing.
create or replace function public.ln_course_raw(p_secret text, p_course uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select to_jsonb(c) from public.ln_courses c where id = p_course);
end $$;

create or replace function public.ln_my_courses(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(to_jsonb(c) order by updated_at desc) from public.ln_courses c where creator_id = p_user), '[]'::jsonb);
end $$;

-- Create or update (any change goes back to review). Max 20 courses per creator.
create or replace function public.ln_course_save(p_secret text, p_user uuid, p_course jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare cid uuid; bid uuid;
begin
  perform public.ln_check(p_secret);
  bid := nullif(p_course->>'bot_id', '')::uuid;
  if bid is not null and not exists (select 1 from public.ln_bots where id = bid and teacher_id = p_user) then bid := null; end if;
  cid := nullif(p_course->>'id', '')::uuid;
  if cid is not null then
    update public.ln_courses set title = p_course->>'title', title_en = coalesce(p_course->>'title_en', ''),
      description = coalesce(p_course->>'description', ''), description_en = coalesce(p_course->>'description_en', ''),
      track = coalesce(p_course->>'track', 'school'), price_pi = coalesce((p_course->>'price_pi')::numeric, 0),
      lessons = coalesce(p_course->'lessons', '[]'::jsonb), bot_id = bid, status = 'review', updated_at = now()
    where id = cid and creator_id = p_user;
    if not found then raise exception 'not your course'; end if;
  else
    if (select count(*) from public.ln_courses where creator_id = p_user) >= 20 then raise exception 'too many courses'; end if;
    insert into public.ln_courses(creator_id, bot_id, title, title_en, description, description_en, track, price_pi, lessons)
    values (p_user, bid, p_course->>'title', coalesce(p_course->>'title_en', ''), coalesce(p_course->>'description', ''),
      coalesce(p_course->>'description_en', ''), coalesce(p_course->>'track', 'school'), coalesce((p_course->>'price_pi')::numeric, 0),
      coalesce(p_course->'lessons', '[]'::jsonb)) returning id into cid;
  end if;
  return jsonb_build_object('id', cid);
end $$;

create or replace function public.ln_enroll_free(p_secret text, p_user uuid, p_course uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if not exists (select 1 from public.ln_courses where id = p_course and status = 'live' and price_pi = 0) then
    return jsonb_build_object('ok', false, 'reason', 'not_free'); end if;
  insert into public.ln_enrollments(user_id, course_id) values (p_user, p_course) on conflict do nothing;
  if found then update public.ln_courses set students = students + 1 where id = p_course; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Marks a lesson passed (the server already checked the answers). Returns progress and whether the course is done.
create or replace function public.ln_course_pass(p_secret text, p_user uuid, p_course uuid, p_lesson text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare e public.ln_enrollments; total integer; done integer;
begin
  perform public.ln_check(p_secret);
  update public.ln_enrollments set progress = progress || jsonb_build_object(p_lesson, true)
   where user_id = p_user and course_id = p_course returning * into e;
  if e.user_id is null then return jsonb_build_object('ok', false, 'reason', 'not_enrolled'); end if;
  select jsonb_array_length(lessons) into total from public.ln_courses where id = p_course;
  select count(*) into done from jsonb_object_keys(e.progress);
  if done >= total and e.completed_at is null then
    update public.ln_enrollments set completed_at = now() where user_id = p_user and course_id = p_course;
  end if;
  return jsonb_build_object('ok', true, 'progress', e.progress, 'completed', done >= total);
end $$;

create or replace function public.ln_my_enrollments(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'title_en', c.title_en,
      'lessons', jsonb_array_length(c.lessons), 'done', (select count(*) from jsonb_object_keys(e.progress)),
      'completed', e.completed_at is not null, 'at', e.created_at) order by e.created_at desc)
    from public.ln_enrollments e join public.ln_courses c on c.id = e.course_id where e.user_id = p_user), '[]'::jsonb);
end $$;

-- Paid courses: the payment row remembers the course; completion enrolls and pays the creator 70% as earned credits.
create or replace function public.ln_payment_start2(p_secret text, p_payment text, p_user uuid, p_pi numeric, p_usd numeric, p_credits integer, p_course uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  insert into public.ln_payments(pi_payment_id, user_id, pi_amount, usd, credits, course_id)
  values (p_payment, p_user, p_pi, p_usd, p_credits, p_course) on conflict (pi_payment_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_payment_complete(p_secret text, p_payment text, p_txid text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p public.ln_payments; u public.ln_users; c public.ln_courses; share integer; cu numeric;
begin
  perform public.ln_check(p_secret);
  select * into p from public.ln_payments where pi_payment_id = p_payment for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_payment'); end if;
  if p.status = 'completed' then
    select * into u from public.ln_users where id = p.user_id;
    return jsonb_build_object('ok', true, 'already', true, 'credits', u.credits, 'course', p.course_id);
  end if;
  update public.ln_payments set status = 'completed', txid = p_txid, completed_at = now() where pi_payment_id = p_payment;
  if p.course_id is not null then
    select * into c from public.ln_courses where id = p.course_id;
    insert into public.ln_enrollments(user_id, course_id, paid_pi, payment_id) values (p.user_id, p.course_id, p.pi_amount, p_payment)
      on conflict (user_id, course_id) do nothing;
    update public.ln_courses set students = students + 1 where id = p.course_id;
    cu := coalesce((select (value->>'credit_usd')::numeric from public.ln_config where key = 'limits'), 0.001);
    share := floor(p.usd * 0.7 / cu);
    if share > 0 and c.creator_id <> p.user_id then
      update public.ln_users set credits = credits + share, earned = earned + share where id = c.creator_id;
      insert into public.ln_ledger(user_id, delta, kind, ref) values (c.creator_id, share, 'course_sale', p.course_id::text);
    end if;
    update public.ln_users set paid = true where id = p.user_id returning * into u;
    return jsonb_build_object('ok', true, 'credits', u.credits, 'course', p.course_id);
  end if;
  update public.ln_users set credits = credits + p.credits, paid = true where id = p.user_id returning * into u;
  insert into public.ln_ledger(user_id, delta, kind, ref) values (p.user_id, p.credits, 'purchase', p_payment);
  return jsonb_build_object('ok', true, 'credits', u.credits, 'added', p.credits);
end $$;

create or replace function public.ln_admin_courses(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'title_en', c.title_en, 'creator', u.username,
      'price_pi', c.price_pi, 'lessons', jsonb_array_length(c.lessons), 'status', c.status, 'students', c.students, 'updated_at', c.updated_at)
      order by (c.status = 'review') desc, c.updated_at desc)
    from public.ln_courses c join public.ln_users u on u.id = c.creator_id), '[]'::jsonb);
end $$;

create or replace function public.ln_admin_course_status(p_secret text, p_course uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if p_status not in ('review','live','rejected','paused') then raise exception 'bad status'; end if;
  update public.ln_courses set status = p_status where id = p_course;
  return jsonb_build_object('ok', found);
end $$;

grant execute on function public.ln_courses_list(text) to anon;
grant execute on function public.ln_course_get(text, uuid, uuid) to anon;
grant execute on function public.ln_course_raw(text, uuid) to anon;
grant execute on function public.ln_my_courses(text, uuid) to anon;
grant execute on function public.ln_course_save(text, uuid, jsonb) to anon;
grant execute on function public.ln_enroll_free(text, uuid, uuid) to anon;
grant execute on function public.ln_course_pass(text, uuid, uuid, text) to anon;
grant execute on function public.ln_my_enrollments(text, uuid) to anon;
grant execute on function public.ln_payment_start2(text, text, uuid, numeric, numeric, integer, uuid) to anon;
grant execute on function public.ln_admin_courses(text) to anon;
grant execute on function public.ln_admin_course_status(text, uuid, text) to anon;
