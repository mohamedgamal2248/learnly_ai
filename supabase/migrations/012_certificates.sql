-- Certificates. Their SHA-256 fingerprint is recorded on the Pi blockchain (memo of a no-op tx from the app wallet).
create table if not exists public.ln_certs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ln_users(id) on delete cascade,
  kind text not null check (kind in ('academy','course')),
  ref text not null,
  title text not null,
  title_en text not null default '',
  username text not null,
  score integer,
  hash text not null default '',
  txid text,
  network text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
alter table public.ln_certs enable row level security;

-- Creates the certificate once (idempotent) and returns it.
create or replace function public.ln_cert_issue(p_secret text, p_user uuid, p_kind text, p_ref text, p_title text, p_title_en text, p_score integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare c public.ln_certs; u public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into c from public.ln_certs where user_id = p_user and kind = p_kind and ref = p_ref;
  if c.id is null then
    select * into u from public.ln_users where id = p_user;
    insert into public.ln_certs(user_id, kind, ref, title, title_en, username, score)
      values (p_user, p_kind, p_ref, left(p_title, 160), left(coalesce(p_title_en, ''), 160), u.username, p_score) returning * into c;
  end if;
  return to_jsonb(c);
end $$;

create or replace function public.ln_cert_set_chain(p_secret text, p_id uuid, p_hash text, p_txid text, p_network text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_certs set hash = p_hash, txid = coalesce(p_txid, txid), network = coalesce(p_network, network) where id = p_id;
end $$;

-- Public lookup for the verify page (no user id exposed).
create or replace function public.ln_cert_get(p_secret text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select to_jsonb(c) - 'user_id' from public.ln_certs c where id = p_id);
end $$;

create or replace function public.ln_my_certs(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by created_at desc) from public.ln_certs c where user_id = p_user), '[]'::jsonb);
end $$;

grant execute on function public.ln_cert_issue(text, uuid, text, text, text, text, integer) to anon;
grant execute on function public.ln_cert_set_chain(text, uuid, text, text, text) to anon;
grant execute on function public.ln_cert_get(text, uuid) to anon;
grant execute on function public.ln_my_certs(text, uuid) to anon;
