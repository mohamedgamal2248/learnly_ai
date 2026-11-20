-- Milestone stages for tasks, sub-tasks, fixed-price services, badges, referral fee-free tasks, recurring tasks in the sweep.

create table if not exists public.ln_services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ln_users(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default '',
  delivery text not null default 'text',
  price_pi numeric(18,7) not null,
  days integer not null default 3,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ln_services_user_idx on public.ln_services(user_id) where active;
alter table public.ln_services enable row level security;

create or replace function private.stage_pct(p_stages jsonb, p_idx integer)
returns numeric language sql immutable as $$ select coalesce((p_stages->p_idx->>'pct')::numeric, 100) $$;

create or replace function private.prior_pct(p_stages jsonb, p_idx integer)
returns numeric language sql immutable as $$
  select coalesce(sum((e.value->>'pct')::numeric), 0) from jsonb_array_elements(coalesce(p_stages, '[]'::jsonb)) with ordinality e(value, ord) where e.ord - 1 < p_idx
$$;

-- Pays the worker for the current stage (or the whole task) and closes it, or moves a staged task to its next stage.
create or replace function public.ln_task_pay(p_secret text, p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks; w public.ln_users; fee numeric; share numeric; net numeric; n integer; first_one boolean;
begin
  perform public.ln_check(p_secret);
  select * into t from public.ln_tasks where id = p_task for update;
  if t.id is null or t.status <> 'submitted' or t.worker_id is null then return jsonb_build_object('ok', false, 'reason', 'bad_state'); end if;
  select * into w from public.ln_users where id = t.worker_id for update;
  fee := public.ln_task_fee_pct();
  if w.fee_free_left > 0 then fee := 0; update public.ln_users set fee_free_left = fee_free_left - 1 where id = w.id; end if;
  first_one := t.stage_idx = 0 and not exists (select 1 from public.ln_tasks x where x.worker_id = t.worker_id and x.status = 'approved' and x.id <> t.id);
  n := case when t.stages is null then 0 else jsonb_array_length(t.stages) end;
  if n > 0 and t.stage_idx < n - 1 then
    share := t.reward_pi * private.stage_pct(t.stages, t.stage_idx) / 100;
    net := floor(share * (1 - fee / 100) * 10000000) / 10000000;
    update public.ln_users set pi_balance = pi_balance + net, pi_earned = pi_earned + net where id = t.worker_id;
    insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (t.worker_id, net, 'task_reward', t.id::text);
    update public.ln_tasks set status = 'claimed', claimed_at = now(), stage_idx = stage_idx + 1, stage_paid = stage_paid + net, result = null, submitted_at = null,
      reject_note = null, revision_note = null, revisions = 0 where id = t.id;
    return jsonb_build_object('ok', true, 'paid', net, 'stage', true);
  end if;
  share := t.reward_pi * (100 - private.prior_pct(t.stages, t.stage_idx)) / 100;
  net := floor(share * (1 - fee / 100) * 10000000) / 10000000;
  update public.ln_users set pi_balance = pi_balance + net, pi_earned = pi_earned + net where id = t.worker_id;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (t.worker_id, net, 'task_reward', t.id::text);
  update public.ln_tasks set status = 'approved', decided_at = now(), paid_pi = stage_paid + net where id = t.id;
  if first_one and w.referred_by is not null then
    update public.ln_users set fee_free_left = fee_free_left + 3 where id = w.referred_by;
    perform private.notify(w.referred_by, 'referral_bonus', jsonb_build_object('who', w.username), '/wallet');
  end if;
  return jsonb_build_object('ok', true, 'paid', net);
end $$;

create or replace function public.ln_task_decide(p_secret text, p_user uuid, p_task uuid, p_approve boolean, p_note text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks; back numeric;
begin
  perform public.ln_check(p_secret);
  select * into t from public.ln_tasks where id = p_task and requester_id = p_user for update;
  if t.id is null or t.status <> 'submitted' then return jsonb_build_object('ok', false, 'reason', 'bad_state'); end if;
  if p_approve then return public.ln_task_pay(p_secret, t.id); end if;
  if t.stages is not null and t.stage_idx > 0 then
    back := floor(t.reward_pi * (100 - private.prior_pct(t.stages, t.stage_idx)) / 100 * 10000000) / 10000000;
    update public.ln_users set pi_balance = pi_balance + back where id = t.requester_id;
    insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (t.requester_id, back, 'task_refund', t.id::text);
    update public.ln_tasks set status = 'cancelled', decided_at = now(), paid_pi = stage_paid, reject_note = left(coalesce(p_note, ''), 300) where id = t.id;
    return jsonb_build_object('ok', true, 'closed', true, 'refunded', back);
  end if;
  update public.ln_tasks set status = 'open', excluded = excluded || t.worker_id, worker_id = null, claimed_at = null, result = null,
    submitted_at = null, reject_note = left(coalesce(p_note, ''), 300), revisions = 0, revision_note = null,
    last_rej_worker = t.worker_id, last_rej_note = left(coalesce(p_note, ''), 300), last_rej_result = t.result, last_rej_at = now(),
    hold_until = now() + interval '1 hour' where id = t.id;
  return jsonb_build_object('ok', true, 'reopened', true);
end $$;

create or replace function public.ln_task_create4(p_secret text, p_user uuid, p_category text, p_delivery text, p_title text, p_brief text, p_input text, p_lang text, p_reward numeric, p_source text, p_token uuid, p_files jsonb, p_stages jsonb, p_parent uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; tk public.ln_mcp_tokens; par public.ln_tasks; tid uuid; cat text; k text; cap numeric; spent numeric; as_draft boolean := false; st jsonb := null; maxr numeric := 50;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user for update;
  if u.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;
  cat := left(regexp_replace(trim(coalesce(p_category, '')), '\s+', ' ', 'g'), 40);
  if char_length(cat) < 2 then return jsonb_build_object('ok', false, 'reason', 'bad_category'); end if;
  if p_delivery not in ('text', 'pdf', 'ppt', 'image', 'file') then return jsonb_build_object('ok', false, 'reason', 'bad_delivery'); end if;
  k := case p_delivery when 'pdf' then 'pdf' when 'ppt' then 'ppt' else 'summary' end;
  if p_stages is not null and jsonb_typeof(p_stages) = 'array' and jsonb_array_length(p_stages) > 0 then
    if jsonb_array_length(p_stages) not between 2 and 4 then return jsonb_build_object('ok', false, 'reason', 'bad_stages'); end if;
    if exists (select 1 from jsonb_array_elements(p_stages) e where char_length(trim(coalesce(e->>'title', ''))) < 1 or coalesce((e->>'pct')::numeric, 0) <= 0)
       or abs((select sum((e->>'pct')::numeric) from jsonb_array_elements(p_stages) e) - 100) > 0.01 then
      return jsonb_build_object('ok', false, 'reason', 'bad_stages'); end if;
    select jsonb_agg(jsonb_build_object('title', left(trim(e->>'title'), 60), 'pct', (e->>'pct')::numeric)) into st from jsonb_array_elements(p_stages) e;
    maxr := 200;
  end if;
  if p_reward is null or p_reward < 0.05 or p_reward > maxr then return jsonb_build_object('ok', false, 'reason', 'bad_reward'); end if;
  if (select count(*) from public.ln_tasks where requester_id = p_user and status in ('open','claimed','submitted')) >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  if p_parent is not null then
    select * into par from public.ln_tasks where id = p_parent and worker_id = p_user and status = 'claimed';
    if par.id is null then return jsonb_build_object('ok', false, 'reason', 'bad_parent'); end if;
    if (select count(*) from public.ln_tasks where parent_id = par.id and status <> 'cancelled') >= 5 then return jsonb_build_object('ok', false, 'reason', 'too_many_sub'); end if;
    if (select coalesce(sum(reward_pi), 0) from public.ln_tasks where parent_id = par.id and status <> 'cancelled') + p_reward > floor(par.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000 then
      return jsonb_build_object('ok', false, 'reason', 'parent_budget'); end if;
  end if;
  if p_source = 'mcp' then
    select * into tk from public.ln_mcp_tokens where id = p_token and user_id = p_user and not revoked;
    if tk.id is null then return jsonb_build_object('ok', false, 'reason', 'bad_key'); end if;
    cap := coalesce(tk.post_daily_pi, (select (value->>'mcp_post_daily_pi')::numeric from public.ln_config where key = 'limits'), 5);
    select coalesce(sum(reward_pi), 0) into spent from public.ln_tasks where token_id = tk.id and created_at > now() - interval '24 hours';
    if spent + p_reward > cap then return jsonb_build_object('ok', false, 'reason', 'mcp_cap', 'cap', cap, 'spent', spent); end if;
    if coalesce(array_length(tk.allowed_categories, 1), 0) > 0
       and not exists (select 1 from unnest(tk.allowed_categories) a where lower(trim(a)) = lower(cat)) then
      return jsonb_build_object('ok', false, 'reason', 'category_not_allowed', 'allowed', to_jsonb(tk.allowed_categories));
    end if;
    if tk.post_mode = 'approve' then
      as_draft := true;
      if (select count(*) from public.ln_tasks where requester_id = p_user and draft and status = 'open') >= 10 then
        return jsonb_build_object('ok', false, 'reason', 'too_many_drafts'); end if;
    end if;
  end if;
  if not as_draft then
    if u.pi_balance < p_reward then return jsonb_build_object('ok', false, 'reason', 'not_enough', 'balance', u.pi_balance); end if;
    update public.ln_users set pi_balance = pi_balance - p_reward where id = p_user;
  end if;
  insert into public.ln_tasks(requester_id, kind, category, category_key, delivery, source, title, brief, input_text, lang, reward_pi, draft, token_id, stages, parent_id)
    values (p_user, k, cat, lower(cat), p_delivery, case when p_source = 'mcp' then 'mcp' else 'web' end, left(p_title, 120), left(coalesce(p_brief, ''), 1000),
            left(coalesce(p_input, ''), 8000), case when p_lang = 'en' then 'en' else 'ar' end, p_reward, as_draft, case when p_source = 'mcp' then p_token else null end, st, p_parent)
    returning id into tid;
  if not as_draft then
    insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (p_user, -p_reward, 'task_hold', tid::text);
  end if;
  perform public.ln_task_files_add(p_secret, tid, p_user, 'input', p_files);
  return jsonb_build_object('ok', true, 'id', tid, 'draft', as_draft);
end $$;

create or replace function public.ln_task_sweep(p_secret text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare r record; res jsonb;
begin
  perform public.ln_check(p_secret);
  update public.ln_tasks set status = 'open', worker_id = null, claimed_at = null, revision_note = null, result = null
   where status = 'claimed' and deal_id is null and stage_idx = 0 and claimed_at < now() - case when revisions > 0 then interval '12 hours' else interval '2 hours' end;
  for r in select id, requester_id, reward_pi, stages, stage_idx from public.ln_tasks
    where status = 'claimed' and (deal_id is not null or stage_idx > 0) and claimed_at < now() - case when revisions > 0 then interval '3 days' else interval '7 days' end loop
    update public.ln_tasks set status = 'cancelled', decided_at = now() where id = r.id;
    update public.ln_users set pi_balance = pi_balance + floor(r.reward_pi * (100 - private.prior_pct(r.stages, r.stage_idx)) / 100 * 10000000) / 10000000 where id = r.requester_id;
    insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (r.requester_id, floor(r.reward_pi * (100 - private.prior_pct(r.stages, r.stage_idx)) / 100 * 10000000) / 10000000, 'task_refund', r.id::text);
  end loop;
  for r in select id from public.ln_tasks where status = 'submitted' and submitted_at < now() - interval '48 hours' loop
    perform public.ln_task_pay(p_secret, r.id);
  end loop;
  for r in select * from public.ln_recurring where active and next_at <= now() order by next_at limit 20 loop
    res := public.ln_task_create4(p_secret, r.user_id, r.category, r.delivery, r.title, r.brief, r.input_text, r.lang, r.reward_pi, 'web', null, null, null, null);
    update public.ln_recurring set next_at = greatest(next_at + make_interval(days => every_days), now() + interval '1 hour') where id = r.id;
    if not coalesce((res->>'ok')::boolean, false) then
      perform private.notify(r.user_id, 'recurring_failed', jsonb_build_object('title', r.title, 'reason', res->>'reason'), '/tasks');
    end if;
  end loop;
end $$;

create or replace function public.ln_task_get(p_secret text, p_user uuid, p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks; role_ text; visible boolean;
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  select * into t from public.ln_tasks where id = p_task;
  if t.id is null then return null; end if;
  role_ := case when t.requester_id = p_user then 'requester' when t.worker_id = p_user then 'worker' else 'viewer' end;
  visible := t.status = 'open' and not t.draft and (t.hold_until is null or t.hold_until <= now()) and not (p_user = any(t.excluded));
  if role_ = 'viewer' and not visible then return null; end if;
  return jsonb_build_object('id', t.id, 'kind', t.kind, 'category', t.category, 'delivery', t.delivery, 'title', t.title, 'brief', t.brief, 'input_text', t.input_text, 'lang', t.lang,
    'reward', t.reward_pi, 'net_reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000,
    'status', t.status, 'role', role_, 'draft', t.draft, 'source', t.source, 'created_at', t.created_at, 'claimed_at', t.claimed_at, 'submitted_at', t.submitted_at,
    'paid_pi', t.paid_pi, 'reject_note', case when role_ = 'viewer' then null else t.reject_note end,
    'revisions', t.revisions, 'revision_note', case when role_ = 'viewer' then null else t.revision_note end,
    'rating', case when role_ = 'viewer' then null else t.rating end,
    'stages', t.stages, 'stage_idx', t.stage_idx, 'stage_paid', t.stage_paid, 'parent_id', case when role_ = 'viewer' then null else t.parent_id end,
    'subtasks', case when role_ = 'viewer' then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'status', c.status, 'reward', c.reward_pi) order by c.created_at)
        from public.ln_tasks c where c.parent_id = t.id), '[]'::jsonb) end,
    'worker_stats', case when role_ = 'requester' and t.worker_id is not null then public.ln_worker_stats_of(t.worker_id) else null end,
    'result', case when role_ in ('requester','worker') then t.result else null end,
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'mime', f.mime, 'size', f.size, 'role', f.role) order by f.created_at)
       from public.ln_task_files f where f.task_id = t.id and (f.role = 'input' or role_ in ('requester','worker'))), '[]'::jsonb));
end $$;

create or replace function public.ln_my_tasks(p_secret text, p_user uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'category', t.category, 'delivery', t.delivery, 'title', t.title,
      'status', case when p_role = 'worker' and t.worker_id is distinct from p_user then 'rejected' else t.status end,
      'reward', t.reward_pi, 'draft', t.draft, 'source', t.source, 'parent_id', t.parent_id,
      'stages', case when t.stages is null then 0 else jsonb_array_length(t.stages) end, 'stage_idx', t.stage_idx, 'worker', (select username from public.ln_users where id = t.worker_id),
      'net_reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000,
      'has_result', t.result is not null, 'reject_note', case when p_role = 'worker' then (case when t.last_rej_worker = p_user then t.last_rej_note else t.reject_note end) when t.status = 'open' then t.reject_note else null end,
      'revision_note', t.revision_note, 'revisions', t.revisions, 'rating', t.rating, 'paid_pi', t.paid_pi, 'created_at', t.created_at,
      'can_dispute', coalesce(p_role = 'worker' and t.worker_id is distinct from p_user and t.last_rej_worker = p_user and t.status = 'open'
         and t.hold_until > now() and t.hold_until <> 'infinity', false),
      'in_dispute', coalesce(t.hold_until = 'infinity', false)) order by t.created_at desc)
    from (select * from public.ln_tasks
          where (p_role = 'worker' and (worker_id = p_user or (last_rej_worker = p_user and last_rej_at > now() - interval '3 days')))
             or (p_role <> 'worker' and requester_id = p_user)
          order by created_at desc limit 50) t), '[]'::jsonb);
end $$;

-- ---------- badges ----------
create or replace function public.ln_badges_of(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare st jsonb; b text[] := '{}'; u public.ln_users;
begin
  st := public.ln_worker_stats_of(p_user);
  select * into u from public.ln_users where id = p_user;
  if (st->>'rated')::int >= 5 and (st->>'avg')::numeric >= 4.7 then b := b || 'top_rated'; end if;
  if (st->>'done')::int >= 25 then b := b || 'pro'; end if;
  if (st->>'done')::int >= 3 and u.created_at > now() - interval '60 days' and coalesce((st->>'avg')::numeric, 5) >= 4.5 then b := b || 'rising'; end if;
  if exists (select 1 from public.ln_mcp_tokens m where m.user_id = p_user and not m.revoked and m.last_used > now() - interval '30 days') then b := b || 'agent'; end if;
  return to_jsonb(b);
end $$;

-- ---------- services ----------
create or replace function public.ln_service_save(p_secret text, p_user uuid, p_title text, p_desc text, p_category text, p_delivery text, p_price numeric, p_days integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare sid uuid;
begin
  perform public.ln_check(p_secret);
  if char_length(trim(coalesce(p_title, ''))) < 3 then return jsonb_build_object('ok', false, 'reason', 'bad_title'); end if;
  if char_length(trim(coalesce(p_category, ''))) < 2 then return jsonb_build_object('ok', false, 'reason', 'bad_category'); end if;
  if p_delivery not in ('text', 'pdf', 'ppt', 'image', 'file') then return jsonb_build_object('ok', false, 'reason', 'bad_delivery'); end if;
  if p_price is null or p_price < 0.05 or p_price > 50 then return jsonb_build_object('ok', false, 'reason', 'bad_price'); end if;
  if p_days is null or p_days < 1 or p_days > 30 then return jsonb_build_object('ok', false, 'reason', 'bad_days'); end if;
  if (select count(*) from public.ln_services where user_id = p_user and active) >= 6 then return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  insert into public.ln_profiles(user_id) values (p_user) on conflict (user_id) do nothing;
  insert into public.ln_services(user_id, title, description, category, delivery, price_pi, days)
  values (p_user, left(trim(p_title), 100), left(trim(coalesce(p_desc, '')), 600), left(trim(p_category), 40), p_delivery, p_price, p_days) returning id into sid;
  return jsonb_build_object('ok', true, 'id', sid);
end $$;

create or replace function public.ln_service_remove(p_secret text, p_user uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_services set active = false where id = p_id and user_id = p_user;
  return jsonb_build_object('ok', found);
end $$;

-- One-click order: the price is held now and a task is assigned straight to the seller.
create or replace function public.ln_service_order(p_secret text, p_user uuid, p_service uuid, p_brief text, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s public.ln_services; u public.ln_users; pr public.ln_profiles; tk public.ln_mcp_tokens; did uuid; tid uuid; cap numeric; spent numeric; k text; brief text;
begin
  perform public.ln_check(p_secret);
  select * into s from public.ln_services where id = p_service and active;
  if s.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if s.user_id = p_user then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  if public.ln_is_blocked(p_secret, p_user, s.user_id) then return jsonb_build_object('ok', false, 'reason', 'blocked_user'); end if;
  select * into pr from public.ln_profiles where user_id = s.user_id;
  if pr.user_id is null or not pr.visible or not pr.available then return jsonb_build_object('ok', false, 'reason', 'not_available'); end if;
  select * into u from public.ln_users where id = p_user for update;
  if u.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;
  if u.pi_balance < s.price_pi then return jsonb_build_object('ok', false, 'reason', 'not_enough', 'balance', u.pi_balance); end if;
  if (select count(*) from public.ln_tasks where requester_id = p_user and status in ('open','claimed','submitted')) >= 20 then return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  if p_token is not null then
    select * into tk from public.ln_mcp_tokens where id = p_token and user_id = p_user and not revoked;
    if tk.id is null then return jsonb_build_object('ok', false, 'reason', 'bad_key'); end if;
    cap := coalesce(tk.post_daily_pi, (select (value->>'mcp_post_daily_pi')::numeric from public.ln_config where key = 'limits'), 5);
    select coalesce(sum(reward_pi), 0) into spent from public.ln_tasks where token_id = tk.id and created_at > now() - interval '24 hours';
    if spent + s.price_pi > cap then return jsonb_build_object('ok', false, 'reason', 'mcp_cap', 'cap', cap, 'spent', spent); end if;
  end if;
  k := case s.delivery when 'pdf' then 'pdf' when 'ppt' then 'ppt' else 'summary' end;
  brief := left(trim(coalesce(p_brief, '')), 1000);
  update public.ln_users set pi_balance = pi_balance - s.price_pi where id = p_user;
  insert into public.ln_deals(requester_id, worker_id, title, brief, category, delivery, price_pi, last_offer_by, status)
  values (p_user, s.user_id, s.title, brief, s.category, s.delivery, s.price_pi, p_user, 'accepted') returning id into did;
  insert into public.ln_tasks(requester_id, worker_id, status, claimed_at, kind, category, category_key, delivery, source, title, brief, input_text, lang, reward_pi, token_id, deal_id)
  values (p_user, s.user_id, 'claimed', now(), k, s.category, lower(s.category), s.delivery, 'deal', s.title, brief, '', 'ar', s.price_pi, p_token, did) returning id into tid;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (p_user, -s.price_pi, 'task_hold', tid::text);
  update public.ln_deals set task_id = tid where id = did;
  insert into public.ln_deal_msgs(deal_id, sender_id, body, price_pi, kind) values (did, p_user, brief, s.price_pi, 'accepted');
  return jsonb_build_object('ok', true, 'task_id', tid, 'deal_id', did, 'price', s.price_pi, 'days', s.days);
end $$;

-- ---------- profiles: badges, services, blocked flag ----------
create or replace function public.ln_profile_get(p_secret text, p_viewer uuid, p_username text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; pr public.ln_profiles;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where lower(username) = lower(trim(p_username)) and not banned order by created_at limit 1;
  if u.id is null then return null; end if;
  select * into pr from public.ln_profiles where user_id = u.id;
  if pr.user_id is not null and not pr.visible and u.id is distinct from p_viewer then return null; end if;
  return jsonb_build_object('username', u.username, 'has_profile', pr.user_id is not null, 'is_me', u.id = p_viewer,
    'headline', coalesce(pr.headline, ''), 'bio', coalesce(pr.bio, ''), 'skills', coalesce(pr.skills, '{}'), 'uses_ai', coalesce(pr.uses_ai, 'both'),
    'available', coalesce(pr.available, true), 'rate_from', pr.rate_from, 'visible', coalesce(pr.visible, true), 'since', u.created_at,
    'stats', public.ln_worker_stats_of(u.id), 'badges', public.ln_badges_of(u.id),
    'blocked', exists (select 1 from public.ln_blocks b where b.user_id = p_viewer and b.blocked_id = u.id),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'description', s.description, 'category', s.category, 'delivery', s.delivery, 'price', s.price_pi, 'days', s.days) order by s.created_at)
        from public.ln_services s where s.user_id = u.id and s.active), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(c.label order by c.n desc) from (select (array_agg(category order by decided_at desc))[1] as label, count(*) as n
        from public.ln_tasks where worker_id = u.id and status = 'approved' and category <> '' group by category_key order by count(*) desc limit 6) c), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('stars', t.rating, 'note', t.rating_note, 'by', ru.username, 'category', t.category, 'at', t.decided_at) order by t.decided_at desc)
        from (select * from public.ln_tasks where worker_id = u.id and rating is not null order by decided_at desc limit 6) t join public.ln_users ru on ru.id = t.requester_id), '[]'::jsonb),
    'portfolio', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description, 'made_with', p.made_with, 'tags', p.tags,
        'has_image', p.image_data is not null, 'at', p.created_at) order by p.created_at desc)
        from public.ln_portfolio p where p.user_id = u.id and p.active), '[]'::jsonb));
end $$;

create or replace function public.ln_people_search(p_secret text, p_query text, p_ai text, p_limit integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare words text[];
begin
  perform public.ln_check(p_secret);
  words := coalesce((select array_agg(w) from (select distinct lower(x) as w from regexp_split_to_table(trim(coalesce(p_query, '')), '\s+') x where char_length(x) >= 2 limit 6) q), '{}');
  return coalesce((select jsonb_agg(z.card order by z.sc desc, z.av desc, z.dn desc) from (
    select jsonb_build_object('username', u.username, 'headline', pr.headline, 'skills', pr.skills, 'uses_ai', pr.uses_ai, 'available', pr.available, 'rate_from', pr.rate_from,
        'stats', st.j, 'badges', public.ln_badges_of(u.id),
        'services', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'price', s.price_pi)) from (select title, price_pi from public.ln_services where user_id = u.id and active order by created_at limit 2) s), '[]'::jsonb),
        'works', coalesce((select jsonb_agg(p.title) from (select title from public.ln_portfolio where user_id = u.id and active order by created_at desc limit 3) p), '[]'::jsonb)) as card,
      sc.n as sc, coalesce((st.j->>'avg')::numeric, 0) as av, (st.j->>'done')::int as dn
    from public.ln_profiles pr join public.ln_users u on u.id = pr.user_id
    cross join lateral (select public.ln_worker_stats_of(u.id) as j) st
    cross join lateral (select lower(coalesce(pr.headline, '') || ' ' || coalesce(pr.bio, '') || ' ' || array_to_string(pr.skills, ' ') || ' ' ||
        coalesce((select string_agg(title || ' ' || description || ' ' || array_to_string(tags, ' '), ' ') from public.ln_portfolio where user_id = u.id and active), '') || ' ' ||
        coalesce((select string_agg(title || ' ' || description || ' ' || category, ' ') from public.ln_services where user_id = u.id and active), '') || ' ' ||
        coalesce((select string_agg(distinct category_key, ' ') from public.ln_tasks where worker_id = u.id and status = 'approved'), '')) as hay) s
    cross join lateral (select case when cardinality(words) = 0 then 1 else (select count(*) from unnest(words) w where position(w in s.hay) > 0) end as n) sc
    where pr.visible and not u.banned and (coalesce(p_ai, '') = '' or pr.uses_ai in (p_ai, 'both')) and sc.n > 0
    order by sc.n desc, coalesce((st.j->>'avg')::numeric, 0) desc, (st.j->>'done')::int desc
    limit least(greatest(coalesce(p_limit, 20), 1), 40)) z), '[]'::jsonb);
end $$;

grant execute on function public.ln_task_create4(text, uuid, text, text, text, text, text, text, numeric, text, uuid, jsonb, jsonb, uuid) to anon;
grant execute on function public.ln_service_save(text, uuid, text, text, text, text, numeric, integer) to anon;
grant execute on function public.ln_service_remove(text, uuid, uuid) to anon;
grant execute on function public.ln_service_order(text, uuid, uuid, text, uuid) to anon;
