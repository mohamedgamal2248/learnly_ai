-- Phase 6: web search per bot (the official assistant has it on).
alter table public.ln_bots add column if not exists web boolean not null default false;
update public.ln_bots set web = true where official;

create or replace function public.ln_bot_set_web(p_secret text, p_user uuid, p_bot uuid, p_on boolean)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare r text;
begin
  perform public.ln_check(p_secret);
  select role into r from public.ln_users where id = p_user;
  update public.ln_bots set web = coalesce(p_on, false)
   where id = p_bot and (teacher_id = p_user or r = 'admin');
  return found;
end $$;
grant execute on function public.ln_bot_set_web(text, uuid, uuid, boolean) to anon;
