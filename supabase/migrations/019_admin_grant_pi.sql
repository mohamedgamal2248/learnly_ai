-- Admin can add Pi earnings to any user (e.g. to test withdrawals). Logged in the Pi ledger.
create or replace function public.ln_admin_grant_pi(p_secret text, p_admin uuid, p_username text, p_pi numeric)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users;
begin
  perform public.ln_check(p_secret);
  if p_pi is null or p_pi <= 0 or p_pi > 1000 then return jsonb_build_object('ok', false, 'reason', 'bad_amount'); end if;
  select * into u from public.ln_users where lower(username) = lower(trim(both '@' from trim(p_username))) limit 1;
  if u.id is null then return jsonb_build_object('ok', false, 'reason', 'user_not_found'); end if;
  update public.ln_users set pi_balance = pi_balance + p_pi, pi_earned = pi_earned + p_pi where id = u.id returning * into u;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (u.id, p_pi, 'admin_grant', p_admin::text);
  return jsonb_build_object('ok', true, 'username', u.username, 'balance', u.pi_balance);
end $$;
grant execute on function public.ln_admin_grant_pi(text, uuid, text, numeric) to anon;
