-- Phase 5: learner attachments. Only the extracted text is kept (no original file), at most 20 per learner.
create table if not exists public.ln_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ln_users(id) on delete cascade,
  name text not null,
  kind text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists ln_attachments_user_idx on public.ln_attachments(user_id, created_at desc);
alter table public.ln_attachments enable row level security;

create or replace function public.ln_att_put(p_secret text, p_user uuid, p_name text, p_kind text, p_text text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare n integer; aid uuid;
begin
  perform public.ln_check(p_secret);
  -- Each learner keeps at most 20 attachments: once full, the oldest slot is reused (bounded storage).
  select count(*) into n from public.ln_attachments where user_id = p_user and created_at > now() - interval '1 day';
  if n >= 40 then return jsonb_build_object('ok', false, 'reason', 'att_limit'); end if;
  select count(*) into n from public.ln_attachments where user_id = p_user;
  if n >= 20 then
    update public.ln_attachments set id = gen_random_uuid(), name = left(p_name, 120), kind = left(p_kind, 10), text = left(p_text, 200000), created_at = now()
     where id = (select id from public.ln_attachments where user_id = p_user order by created_at asc limit 1)
     returning id into aid;
  else
    insert into public.ln_attachments(user_id, name, kind, text)
      values (p_user, left(p_name, 120), left(p_kind, 10), left(p_text, 200000)) returning id into aid;
  end if;
  return jsonb_build_object('ok', true, 'id', aid);
end $$;

create or replace function public.ln_att_get(p_secret text, p_user uuid, p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'kind', kind, 'text', text))
    from public.ln_attachments where user_id = p_user and id = any(p_ids[1:5])), '[]'::jsonb);
end $$;

grant execute on function public.ln_att_put(text, uuid, text, text, text) to anon;
grant execute on function public.ln_att_get(text, uuid, uuid[]) to anon;
