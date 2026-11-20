-- Creator earnings are kept in Pi: course sales pay 70% of the Pi price, message fees are converted to Pi when earned.
alter table public.ln_users add column if not exists pi_balance numeric(18,7) not null default 0;
alter table public.ln_users add column if not exists pi_earned numeric(18,7) not null default 0;
alter table public.ln_users add column if not exists pi_withdrawn numeric(18,7) not null default 0;
update public.ln_config set value = jsonb_build_object('min_withdraw_pi', 1) || value where key = 'limits';

create table if not exists public.ln_pi_ledger (
  id bigserial primary key,
  user_id uuid not null references public.ln_users(id) on delete cascade,
  delta numeric(18,7) not null,
  kind text not null,
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists ln_pi_ledger_user_idx on public.ln_pi_ledger(user_id, created_at desc);
alter table public.ln_pi_ledger enable row level security;

create table if not exists public.ln_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ln_users(id) on delete cascade,
  pi_amount numeric(18,7) not null check (pi_amount > 0),
  status text not null default 'pending' check (status in ('pending','sending','sent','rejected','failed')),
  payment_id text, txid text, note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists ln_payouts_user_idx on public.ln_payouts(user_id, created_at desc);
alter table public.ln_payouts enable row level security;

-- Message fee share (already converted to Pi by the server) goes to the bot's creator.
create or replace function public.ln_add_earning(p_secret text, p_bot uuid, p_learner uuid, p_pi numeric)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare t uuid;
begin
  perform public.ln_check(p_secret);
  if p_pi is null or p_pi <= 0 then return; end if;
  select teacher_id into t from public.ln_bots where id = p_bot;
  if t is null or t = p_learner then return; end if;
  update public.ln_users set pi_balance = pi_balance + p_pi, pi_earned = pi_earned + p_pi where id = t;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (t, p_pi, 'message_fee', p_bot::text);
end $$;

create or replace function public.ln_pi_earnings(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  return jsonb_build_object('balance', u.pi_balance, 'earned', u.pi_earned, 'withdrawn', u.pi_withdrawn,
    'min', coalesce((select (value->>'min_withdraw_pi')::numeric from public.ln_config where key = 'limits'), 1),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'pi', pi_amount, 'status', status, 'txid', txid, 'note', note, 'at', created_at) order by created_at desc)
      from (select * from public.ln_payouts where user_id = p_user order by created_at desc limit 20) w), '[]'::jsonb));
end $$;

-- The amount is held right away so it can't be requested twice.
create or replace function public.ln_payout_request(p_secret text, p_user uuid, p_pi numeric)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; mn numeric; wid uuid;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user for update;
  if u.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;
  mn := coalesce((select (value->>'min_withdraw_pi')::numeric from public.ln_config where key = 'limits'), 1);
  if p_pi < mn then return jsonb_build_object('ok', false, 'reason', 'below_min', 'min', mn); end if;
  if exists (select 1 from public.ln_payouts where user_id = p_user and status in ('pending','sending')) then
    return jsonb_build_object('ok', false, 'reason', 'pending_exists'); end if;
  if p_pi > u.pi_balance then return jsonb_build_object('ok', false, 'reason', 'not_enough'); end if;
  update public.ln_users set pi_balance = pi_balance - p_pi, pi_withdrawn = pi_withdrawn + p_pi where id = p_user;
  insert into public.ln_payouts(user_id, pi_amount) values (p_user, p_pi) returning id into wid;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (p_user, -p_pi, 'withdraw', wid::text);
  return jsonb_build_object('ok', true, 'id', wid);
end $$;

create or replace function public.ln_admin_payouts(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'username', u.username, 'pi_uid', u.pi_uid, 'pi', w.pi_amount,
      'status', w.status, 'payment_id', w.payment_id, 'txid', w.txid, 'note', w.note, 'at', w.created_at) order by (w.status = 'pending') desc, w.created_at desc)
    from (select * from public.ln_payouts order by created_at desc limit 100) w join public.ln_users u on u.id = w.user_id), '[]'::jsonb);
end $$;

-- pending→sending is a one-time lock; rejected/failed give the Pi balance back.
create or replace function public.ln_payout_set(p_secret text, p_id uuid, p_status text, p_payment text, p_txid text, p_note text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare w public.ln_payouts;
begin
  perform public.ln_check(p_secret);
  select * into w from public.ln_payouts where id = p_id for update;
  if w.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not ((w.status = 'pending' and p_status in ('sending','rejected'))
       or (w.status = 'sending' and p_status in ('sent','failed'))
       or (w.status = 'sending' and p_status = 'sending' and (p_payment is not null or p_txid is not null or p_note is not null))) then
    return jsonb_build_object('ok', false, 'reason', 'bad_state', 'status', w.status);
  end if;
  update public.ln_payouts set status = p_status, payment_id = coalesce(p_payment, payment_id), txid = coalesce(p_txid, txid),
    note = coalesce(p_note, note), decided_at = now() where id = p_id;
  if p_status in ('rejected','failed') then
    update public.ln_users set pi_balance = pi_balance + w.pi_amount, pi_withdrawn = pi_withdrawn - w.pi_amount where id = w.user_id;
    insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (w.user_id, w.pi_amount, 'withdraw_refund', w.id::text);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Course sales now pay the creator 70% of the Pi price, in Pi.
create or replace function public.ln_payment_complete(p_secret text, p_payment text, p_txid text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare p public.ln_payments; u public.ln_users; c public.ln_courses; share numeric;
begin
  perform public.ln_check(p_secret);
  select * into p from public.ln_payments where pi_payment_id = p_payment for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_payment'); end if;
  if p.status = 'completed' then
    select * into u from public.ln_users where id = p.user_id;
    return jsonb_build_object('ok', true, 'already', true, 'credits', u.credits, 'course', p.course_id);
  end if;
  update public.ln_payments set status = 'completed', txid = p_txid, completed_at = now() where pi_payment_id = p_payment;
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

-- Creator dashboard earnings in Pi.
create or replace function public.ln_creator_stats(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return jsonb_build_object(
    'bots', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'name_en', b.name_en,
        'chats', (select count(*) from public.ln_chats c where c.bot_id = b.id),
        'learners', (select count(distinct c.user_id) from public.ln_chats c where c.bot_id = b.id),
        'messages', (select coalesce(sum(c.msgs), 0) / 2 from public.ln_chats c where c.bot_id = b.id),
        'earned', (select coalesce(sum(l.delta), 0) from public.ln_pi_ledger l where l.user_id = p_user and l.kind = 'message_fee' and l.ref = b.id::text))
        order by b.updated_at desc)
      from public.ln_bots b where b.teacher_id = p_user), '[]'::jsonb),
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'title_en', c.title_en, 'students', c.students,
        'completed', (select count(*) from public.ln_enrollments e where e.course_id = c.id and e.completed_at is not null),
        'sales_pi', (select coalesce(sum(e.paid_pi), 0) from public.ln_enrollments e where e.course_id = c.id),
        'earned', (select coalesce(sum(l.delta), 0) from public.ln_pi_ledger l where l.user_id = p_user and l.kind = 'course_sale' and l.ref = c.id::text)))
      from public.ln_courses c where c.creator_id = p_user), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'chats', d.n) order by d.day)
      from (select date_trunc('day', c.updated_at)::date as day, count(*) as n from public.ln_chats c
            join public.ln_bots b on b.id = c.bot_id where b.teacher_id = p_user and c.updated_at > now() - interval '30 days'
            group by 1) d), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(q.title) from (select c.title from public.ln_chats c join public.ln_bots b on b.id = c.bot_id
      where b.teacher_id = p_user and c.user_id <> p_user and c.title <> '' order by c.created_at desc limit 15) q), '[]'::jsonb));
end $$;

grant execute on function public.ln_add_earning(text, uuid, uuid, numeric) to anon;
grant execute on function public.ln_pi_earnings(text, uuid) to anon;
grant execute on function public.ln_payout_request(text, uuid, numeric) to anon;
grant execute on function public.ln_admin_payouts(text) to anon;
grant execute on function public.ln_payout_set(text, uuid, text, text, text, text) to anon;
