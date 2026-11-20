-- Public counters for the landing section.
create or replace function public.ln_public_stats(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return jsonb_build_object(
    'learners', (select count(*) from public.ln_users),
    'bots', (select count(*) from public.ln_bots where status = 'live'),
    'creators', (select count(distinct teacher_id) from public.ln_bots where status = 'live' and teacher_id is not null),
    'messages', (select coalesce(sum(msgs), 0) from public.ln_usage_daily));
end $$;
grant execute on function public.ln_public_stats(text) to anon;
