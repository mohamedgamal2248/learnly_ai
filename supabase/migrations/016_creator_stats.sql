-- Creator dashboard: per bot and per course numbers, 30-day activity and recent learner questions (no usernames).
create or replace function public.ln_creator_stats(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return jsonb_build_object(
    'bots', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'name_en', b.name_en,
        'chats', (select count(*) from public.ln_chats c where c.bot_id = b.id),
        'learners', (select count(distinct c.user_id) from public.ln_chats c where c.bot_id = b.id),
        'messages', (select coalesce(sum(c.msgs), 0) / 2 from public.ln_chats c where c.bot_id = b.id),
        'earned', (select coalesce(sum(l.delta), 0) from public.ln_ledger l where l.user_id = p_user and l.kind = 'teacher_fee' and l.ref = b.id::text))
        order by b.updated_at desc)
      from public.ln_bots b where b.teacher_id = p_user), '[]'::jsonb),
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'title_en', c.title_en, 'students', c.students,
        'completed', (select count(*) from public.ln_enrollments e where e.course_id = c.id and e.completed_at is not null),
        'sales_pi', (select coalesce(sum(e.paid_pi), 0) from public.ln_enrollments e where e.course_id = c.id),
        'earned', (select coalesce(sum(l.delta), 0) from public.ln_ledger l where l.user_id = p_user and l.kind = 'course_sale' and l.ref = c.id::text)))
      from public.ln_courses c where c.creator_id = p_user), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'chats', d.n) order by d.day)
      from (select date_trunc('day', c.updated_at)::date as day, count(*) as n from public.ln_chats c
            join public.ln_bots b on b.id = c.bot_id where b.teacher_id = p_user and c.updated_at > now() - interval '30 days'
            group by 1) d), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(q.title) from (select c.title from public.ln_chats c join public.ln_bots b on b.id = c.bot_id
      where b.teacher_id = p_user and c.user_id <> p_user and c.title <> '' order by c.created_at desc limit 15) q), '[]'::jsonb));
end $$;
grant execute on function public.ln_creator_stats(text, uuid) to anon;
