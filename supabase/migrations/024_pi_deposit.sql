-- Top up the Pi balance (used to post tasks) with a normal user-to-app Pi payment.
alter table public.ln_payments add column if not exists deposit boolean not null default false;

create or replace function public.ln_payment_start3(p_secret text, p_payment text, p_user uuid, p_pi numeric)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  insert into public.ln_payments(pi_payment_id, user_id, pi_amount, usd, credits, deposit)
  values (p_payment, p_user, p_pi, 0, 0, true) on conflict (pi_payment_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_payment_complete(p_secret text, p_payment text, p_txid text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p public.ln_payments; u public.ln_users; c public.ln_courses; share numeric;
begin
  perform public.ln_check(p_secret);
  select * into p from public.ln_payments where pi_payment_id = p_payment for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_payment'); end if;
  if p.status = 'completed' then
    select * into u from public.ln_users where id = p.user_id;
    return jsonb_build_object('ok', true, 'already', true, 'credits', u.credits, 'course', p.course_id, 'deposit', p.deposit, 'balance', u.pi_balance);
  end if;
  update public.ln_payments set status = 'completed', txid = p_txid, completed_at = now() where pi_payment_id = p_payment;
  if p.deposit then
    update public.ln_users set pi_balance = pi_balance + p.pi_amount where id = p.user_id returning * into u;
    insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (p.user_id, p.pi_amount, 'deposit', p_payment);
    return jsonb_build_object('ok', true, 'deposit', true, 'added', p.pi_amount, 'balance', u.pi_balance, 'credits', u.credits);
  end if;
  if p.course_id is not null then
    select * into c from public.ln_courses where id = p.course_id;
    insert into public.ln_enrollments(user_id, course_id, paid_pi, payment_id) values (p.user_id, p.course_id, p.pi_amount, p_payment)
      on conflict (user_id, course_id) do nothing;
    update public.ln_courses set students = students + 1 where id = p.course_id;
    share := floor(p.pi_amount * 0.7 * 10000000) / 10000000;
    if share > 0 and c.creator_id <> p.user_id then
      update public.ln_users set pi_balance = pi_balance + share, pi_earned = pi_earned + share where id = c.creator_id;
      insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (c.creator_id, share, 'course_sale', p.course_id::text);
    end if;
    update public.ln_users set paid = true where id = p.user_id returning * into u;
    return jsonb_build_object('ok', true, 'credits', u.credits, 'course', p.course_id);
  end if;
  update public.ln_users set credits = credits + p.credits, paid = true where id = p.user_id returning * into u;
  insert into public.ln_ledger(user_id, delta, kind, ref) values (p.user_id, p.credits, 'purchase', p_payment);
  return jsonb_build_object('ok', true, 'credits', u.credits, 'added', p.credits);
end $$;

grant execute on function public.ln_payment_start3(text, text, uuid, numeric) to anon;
