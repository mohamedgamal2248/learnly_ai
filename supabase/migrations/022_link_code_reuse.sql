-- One pairing code can connect several AI apps (up to 5 uses in its 10 minutes), with clear failure reasons.
alter table public.ln_link_codes add column if not exists uses integer not null default 0;

create or replace function public.ln_link_code_use2(p_secret text, p_hash text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare c public.ln_link_codes;
begin
  perform public.ln_check(p_secret);
  select * into c from public.ln_link_codes where hash = p_hash for update;
  if c.hash is null then return jsonb_build_object('reason', 'not_found'); end if;
  if c.used_at is not null then return jsonb_build_object('reason', 'replaced'); end if;
  if c.expires_at <= now() then return jsonb_build_object('reason', 'expired'); end if;
  if c.uses >= 5 then return jsonb_build_object('reason', 'used_up'); end if;
  update public.ln_link_codes set uses = uses + 1 where hash = p_hash;
  return jsonb_build_object('uid', c.user_id);
end $$;
grant execute on function public.ln_link_code_use2(text, text) to anon;

-- Open tasks also for visitors who aren't signed in (p_user null) so the site can show the board to everyone.
create or replace function public.ln_task_open_list(p_secret text, p_user uuid, p_kind text, p_limit integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'brief', left(t.brief, 200), 'lang', t.lang,
      'reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000, 'created_at', t.created_at))
    from (select * from public.ln_tasks where status = 'open'
          and (p_user is null or (requester_id <> p_user and not (p_user = any(excluded))))
          and (p_kind is null or kind = p_kind) order by reward_pi desc, created_at asc limit least(greatest(coalesce(p_limit, 10), 1), 25)) t), '[]'::jsonb);
end $$;
