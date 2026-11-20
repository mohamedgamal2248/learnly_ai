-- Withdrawals go straight to a wallet address the creator enters; 0.01 Pi network fee is taken from the amount.
alter table public.ln_payouts add column if not exists address text;
alter table public.ln_payouts add column if not exists sent_pi numeric(18,7);
alter table public.ln_users add column if not exists pi_address text;

create or replace function public.ln_payout_request2(p_secret text, p_user uuid, p_pi numeric, p_address text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; mn numeric; wid uuid;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user for update;
  if u.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;
  if p_address !~ '^G[A-Z2-7]{55}$' then return jsonb_build_object('ok', false, 'reason', 'bad_address'); end if;
  mn := coalesce((select (value->>'min_withdraw_pi')::numeric from public.ln_config where key = 'limits'), 1);
  if p_pi < mn then return jsonb_build_object('ok', false, 'reason', 'below_min', 'min', mn); end if;
  if exists (select 1 from public.ln_payouts where user_id = p_user and status in ('pending','sending')) then
    return jsonb_build_object('ok', false, 'reason', 'pending_exists'); end if;
  if p_pi > u.pi_balance then return jsonb_build_object('ok', false, 'reason', 'not_enough'); end if;
  update public.ln_users set pi_balance = pi_balance - p_pi, pi_withdrawn = pi_withdrawn + p_pi, pi_address = p_address where id = p_user;
  insert into public.ln_payouts(user_id, pi_amount, address, sent_pi) values (p_user, p_pi, p_address, p_pi - 0.01) returning id into wid;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (p_user, -p_pi, 'withdraw', wid::text);
  return jsonb_build_object('ok', true, 'id', wid);
end $$;

create or replace function public.ln_pi_earnings(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  return jsonb_build_object('balance', u.pi_balance, 'earned', u.pi_earned, 'withdrawn', u.pi_withdrawn, 'address', u.pi_address, 'fee', 0.01,
    'min', coalesce((select (value->>'min_withdraw_pi')::numeric from public.ln_config where key = 'limits'), 1),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'pi', pi_amount, 'sent', sent_pi, 'address', address, 'status', status, 'txid', txid, 'note', note, 'at', created_at) order by created_at desc)
      from (select * from public.ln_payouts where user_id = p_user order by created_at desc limit 20) w), '[]'::jsonb));
end $$;

create or replace function public.ln_admin_payouts(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'username', u.username, 'pi_uid', u.pi_uid, 'pi', w.pi_amount, 'sent', w.sent_pi,
      'address', w.address, 'status', w.status, 'payment_id', w.payment_id, 'txid', w.txid, 'note', w.note, 'at', w.created_at)
      order by (w.status = 'pending') desc, w.created_at desc)
    from (select * from public.ln_payouts order by created_at desc limit 100) w join public.ln_users u on u.id = w.user_id), '[]'::jsonb);
end $$;

grant execute on function public.ln_payout_request2(text, uuid, numeric, text) to anon;
