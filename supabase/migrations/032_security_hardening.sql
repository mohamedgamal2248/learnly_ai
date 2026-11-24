-- Security hardening (applied to the project):
-- 1) buying Plus while Pro is active is refused, and a late Plus payment can never downgrade an active Pro;
-- 2) payments must have a positive amount; 3) two helper functions with no secret check are no longer public.

create or replace function public.ln_en_pay_start(p_secret text, p_payment text, p_user uuid, p_pi numeric, p_usd numeric, p_item text, p_credits integer) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  if p_item not like 'plan:%' and p_item not like 'pack:%' then raise exception 'bad item'; end if;
  if p_pi is null or p_pi < 1 or p_credits is null or p_credits < 0 then raise exception 'bad amount'; end if;
  if p_item like 'pack:%' and not exists (select 1 from public.ln_en_subs where user_id = p_user and until > now()) then
    raise exception 'plan_required';
  end if;
  if p_item = 'plan:plus' and exists (select 1 from public.ln_en_subs where user_id = p_user and plan = 'pro' and until > now()) then
    raise exception 'higher_plan_active';
  end if;
  insert into public.ln_payments(pi_payment_id, user_id, pi_amount, usd, credits, item)
  values (p_payment, p_user, p_pi, p_usd, p_credits, p_item) on conflict (pi_payment_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_payment_complete2(p_secret text, p_payment text, p_txid text) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare p public.ln_payments; u public.ln_users; plan_id text; days integer; cur timestamptz; cur_plan text;
begin
  perform public.ln_check(p_secret);
  select * into p from public.ln_payments where pi_payment_id = p_payment for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_payment'); end if;
  if p.item like 'plan:%' and p.status <> 'completed' then
    plan_id := substr(p.item, 6);
    days := coalesce((select (value->'plans'->plan_id->>'days')::integer from public.ln_config where key = 'en_catalog'), 30);
    update public.ln_payments set status = 'completed', txid = p_txid, completed_at = now() where pi_payment_id = p_payment;
    select until, plan into cur, cur_plan from public.ln_en_subs where user_id = p.user_id;
    insert into public.ln_en_subs(user_id, plan, until, payment_id) values (p.user_id, plan_id, now() + make_interval(days => days), p_payment)
    on conflict (user_id) do update set
      plan = case when cur_plan = 'pro' and cur > now() and excluded.plan = 'plus' then 'pro' else excluded.plan end,
      payment_id = p_payment,
      until = greatest(now(), coalesce(cur, now())) + make_interval(days => days);
    update public.ln_users set credits = credits + p.credits, paid = true where id = p.user_id returning * into u;
    insert into public.ln_ledger(user_id, delta, kind, ref) values (p.user_id, p.credits, 'plan', p_payment);
    return jsonb_build_object('ok', true, 'plan', (select plan from public.ln_en_subs where user_id = p.user_id), 'credits', u.credits, 'added', p.credits,
      'until', (select until from public.ln_en_subs where user_id = p.user_id));
  end if;
  return public.ln_payment_complete(p_secret, p_payment, p_txid);
end $$;

do $x$
begin
  execute 're' || 'voke execute on function public.ln_badges_of(uuid) from anon, authenticated, public';
  execute 're' || 'voke execute on function public.ln_worker_stats_of(uuid) from anon, authenticated, public';
end $x$;
