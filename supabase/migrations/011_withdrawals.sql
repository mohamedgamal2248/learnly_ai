-- Creators withdraw earned credits as Pi (app-to-user payments), after admin approval.
alter table public.ln_users add column if not exists withdrawn integer not null default 0;
update public.ln_config set value = jsonb_build_object('min_withdraw', 1000) || value where key = 'limits';

create table if not exists public.ln_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ln_users(id) on delete cascade,
  credits integer not null check (credits > 0),
  pi_amount numeric(18,7) not null,
  rate numeric(18,7) not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','rejected','failed')),
  payment_id text, txid text, note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists ln_withdrawals_user_idx on public.ln_withdrawals(user_id, created_at desc);
create index if not exists ln_withdrawals_status_idx on public.ln_withdrawals(status, created_at);
alter table public.ln_withdrawals enable row level security;

-- Earnings summary + history for the creator.
create or replace function public.ln_my_earnings(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  return jsonb_build_object('earned', u.earned, 'withdrawn', u.withdrawn, 'credits', u.credits,
    'available', greatest(0, least(u.earned - u.withdrawn, u.credits)),
    'min', coalesce((select (value->>'min_withdraw')::int from public.ln_config where key = 'limits'), 1000),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'credits', credits, 'pi', pi_amount, 'status', status, 'txid', txid, 'note', note, 'at', created_at) order by created_at desc)
      from (select * from public.ln_withdrawals where user_id = p_user order by created_at desc limit 20) w), '[]'::jsonb));
end $$;

-- Hold the credits right away so they can't be spent twice.
create or replace function public.ln_withdraw_request(p_secret text, p_user uuid, p_credits integer, p_pi numeric, p_rate numeric)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; mn integer; wid uuid;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user for update;
  if u.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;
  mn := coalesce((select (value->>'min_withdraw')::int from public.ln_config where key = 'limits'), 1000);
  if p_credits < mn then return jsonb_build_object('ok', false, 'reason', 'below_min', 'min', mn); end if;
  if exists (select 1 from public.ln_withdrawals where user_id = p_user and status in ('pending','sending')) then
    return jsonb_build_object('ok', false, 'reason', 'pending_exists'); end if;
  if p_credits > least(u.earned - u.withdrawn, u.credits) then return jsonb_build_object('ok', false, 'reason', 'not_enough'); end if;
  update public.ln_users set credits = credits - p_credits, withdrawn = withdrawn + p_credits where id = p_user;
  insert into public.ln_withdrawals(user_id, credits, pi_amount, rate) values (p_user, p_credits, p_pi, p_rate) returning id into wid;
  insert into public.ln_ledger(user_id, delta, kind, ref) values (p_user, -p_credits, 'withdraw', wid::text);
  return jsonb_build_object('ok', true, 'id', wid);
end $$;

-- Admin list.
create or replace function public.ln_admin_withdrawals(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'username', u.username, 'pi_uid', u.pi_uid, 'credits', w.credits, 'pi', w.pi_amount,
      'status', w.status, 'payment_id', w.payment_id, 'txid', w.txid, 'note', w.note, 'at', w.created_at) order by (w.status = 'pending') desc, w.created_at desc)
    from (select * from public.ln_withdrawals order by created_at desc limit 100) w join public.ln_users u on u.id = w.user_id), '[]'::jsonb);
end $$;

-- Move a withdrawal through its states. Rejected/failed ones give the credits back.
create or replace function public.ln_withdraw_set(p_secret text, p_id uuid, p_status text, p_payment text, p_txid text, p_note text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare w public.ln_withdrawals;
begin
  perform public.ln_check(p_secret);
  select * into w from public.ln_withdrawals where id = p_id for update;
  if w.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  -- allowed transitions only
  -- pending→sending is the one-time lock (a second approve gets bad_state); sending→sending only records progress.
  if not ((w.status = 'pending' and p_status in ('sending','rejected'))
       or (w.status = 'sending' and p_status in ('sent','failed'))
       or (w.status = 'sending' and p_status = 'sending' and (p_payment is not null or p_txid is not null or p_note is not null))) then
    return jsonb_build_object('ok', false, 'reason', 'bad_state', 'status', w.status);
  end if;
  update public.ln_withdrawals set status = p_status, payment_id = coalesce(p_payment, payment_id), txid = coalesce(p_txid, txid),
    note = coalesce(p_note, note), decided_at = now() where id = p_id;
  if p_status in ('rejected','failed') then
    update public.ln_users set credits = credits + w.credits, withdrawn = withdrawn - w.credits where id = w.user_id;
    insert into public.ln_ledger(user_id, delta, kind, ref) values (w.user_id, w.credits, 'withdraw_refund', w.id::text);
  end if;
  return jsonb_build_object('ok', true, 'user_id', w.user_id, 'pi', w.pi_amount, 'payment_id', coalesce(p_payment, w.payment_id));
end $$;

grant execute on function public.ln_my_earnings(text, uuid) to anon;
grant execute on function public.ln_withdraw_request(text, uuid, integer, numeric, numeric) to anon;
grant execute on function public.ln_admin_withdrawals(text) to anon;
grant execute on function public.ln_withdraw_set(text, uuid, text, text, text, text) to anon;
