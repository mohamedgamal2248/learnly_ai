-- Task marketplace (first version): requesters post small AI tasks and hold the reward from their Pi balance;
-- workers (people using their own AI through MCP) claim, submit, and get paid when the requester approves
-- (or automatically after 48 hours).

create table if not exists public.ln_tasks (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.ln_users(id) on delete cascade,
  kind text not null check (kind in ('summary','translate','pdf','ppt','research')),
  title text not null,
  brief text not null default '',
  input_text text not null default '',
  lang text not null default 'ar',
  reward_pi numeric(18,7) not null check (reward_pi > 0),
  status text not null default 'open' check (status in ('open','claimed','submitted','approved','cancelled')),
  worker_id uuid references public.ln_users(id) on delete set null,
  excluded uuid[] not null default '{}',
  claimed_at timestamptz,
  result jsonb,
  submitted_at timestamptz,
  decided_at timestamptz,
  paid_pi numeric(18,7),
  reject_note text,
  created_at timestamptz not null default now()
);
create index if not exists ln_tasks_status_idx on public.ln_tasks(status, created_at desc);
create index if not exists ln_tasks_requester_idx on public.ln_tasks(requester_id, created_at desc);
create index if not exists ln_tasks_worker_idx on public.ln_tasks(worker_id, created_at desc);
alter table public.ln_tasks enable row level security;

-- Pairing codes (shown inside Pi Browser, typed on the AI app's consent page) and access tokens for MCP clients.
create table if not exists public.ln_link_codes (
  hash text primary key,
  user_id uuid not null references public.ln_users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table public.ln_link_codes enable row level security;

create table if not exists public.ln_mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  hash text not null unique,
  user_id uuid not null references public.ln_users(id) on delete cascade,
  name text not null default '',
  revoked boolean not null default false,
  last_used timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ln_mcp_tokens_user_idx on public.ln_mcp_tokens(user_id);
alter table public.ln_mcp_tokens enable row level security;

create or replace function public.ln_link_code_create(p_secret text, p_user uuid, p_hash text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  -- older unused codes of this user stop working
  update public.ln_link_codes set used_at = now() where user_id = p_user and used_at is null;
  insert into public.ln_link_codes(hash, user_id, expires_at) values (p_hash, p_user, now() + interval '10 minutes');
end $$;

create or replace function public.ln_link_code_use(p_secret text, p_hash text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  perform public.ln_check(p_secret);
  update public.ln_link_codes set used_at = now()
   where hash = p_hash and used_at is null and expires_at > now() returning user_id into uid;
  return uid;
end $$;

create or replace function public.ln_mcp_token_create(p_secret text, p_user uuid, p_hash text, p_name text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid;
begin
  perform public.ln_check(p_secret);
  if (select count(*) from public.ln_mcp_tokens where user_id = p_user and not revoked) >= 10 then
    update public.ln_mcp_tokens set revoked = true where id = (select id from public.ln_mcp_tokens where user_id = p_user and not revoked order by created_at asc limit 1);
  end if;
  insert into public.ln_mcp_tokens(hash, user_id, name) values (p_hash, p_user, left(coalesce(p_name, ''), 60)) returning id into tid;
  return tid;
end $$;

-- Returns the user for a valid token (null otherwise). last_used is refreshed at most every 5 minutes.
create or replace function public.ln_mcp_token_verify(p_secret text, p_hash text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_mcp_tokens; u public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into t from public.ln_mcp_tokens where hash = p_hash and not revoked;
  if t.id is null then return null; end if;
  if t.last_used is null or t.last_used < now() - interval '5 minutes' then
    update public.ln_mcp_tokens set last_used = now() where id = t.id;
  end if;
  select * into u from public.ln_users where id = t.user_id;
  return jsonb_build_object('user_id', u.id, 'username', u.username, 'banned', u.banned);
end $$;

create or replace function public.ln_mcp_tokens_list(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'last_used', last_used, 'created_at', created_at) order by created_at desc)
    from public.ln_mcp_tokens where user_id = p_user and not revoked), '[]'::jsonb);
end $$;

create or replace function public.ln_mcp_token_off(p_secret text, p_user uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_mcp_tokens set revoked = true where id = p_id and user_id = p_user;
end $$;

-- Platform share of each task reward (percent), default 20.
create or replace function public.ln_task_fee_pct()
returns numeric language sql stable as $$
  select coalesce((select (value->>'task_fee_pct')::numeric from public.ln_config where key = 'limits'), 20);
$$;

-- Pays the worker (reward minus platform share) and closes the task. Used for approvals and auto-approvals.
create or replace function public.ln_task_pay(p_secret text, p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks; net numeric;
begin
  perform public.ln_check(p_secret);
  select * into t from public.ln_tasks where id = p_task for update;
  if t.id is null or t.status <> 'submitted' or t.worker_id is null then return jsonb_build_object('ok', false, 'reason', 'bad_state'); end if;
  net := floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000;
  update public.ln_users set pi_balance = pi_balance + net, pi_earned = pi_earned + net where id = t.worker_id;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (t.worker_id, net, 'task_reward', t.id::text);
  update public.ln_tasks set status = 'approved', decided_at = now(), paid_pi = net where id = t.id;
  return jsonb_build_object('ok', true, 'paid', net);
end $$;

-- Releases expired claims (2 hours) and auto-approves submissions nobody answered (48 hours).
create or replace function public.ln_task_sweep(p_secret text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  perform public.ln_check(p_secret);
  update public.ln_tasks set status = 'open', worker_id = null, claimed_at = null
   where status = 'claimed' and claimed_at < now() - interval '2 hours';
  for r in select id from public.ln_tasks where status = 'submitted' and submitted_at < now() - interval '48 hours' loop
    perform public.ln_task_pay(p_secret, r.id);
  end loop;
end $$;

create or replace function public.ln_task_create(p_secret text, p_user uuid, p_kind text, p_title text, p_brief text, p_input text, p_lang text, p_reward numeric)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; tid uuid;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user for update;
  if u.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;
  if p_kind not in ('summary','translate','pdf','ppt','research') then return jsonb_build_object('ok', false, 'reason', 'bad_kind'); end if;
  if p_reward is null or p_reward < 0.05 or p_reward > 50 then return jsonb_build_object('ok', false, 'reason', 'bad_reward'); end if;
  if (select count(*) from public.ln_tasks where requester_id = p_user and status in ('open','claimed','submitted')) >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  if u.pi_balance < p_reward then return jsonb_build_object('ok', false, 'reason', 'not_enough', 'balance', u.pi_balance); end if;
  update public.ln_users set pi_balance = pi_balance - p_reward where id = p_user;
  insert into public.ln_tasks(requester_id, kind, title, brief, input_text, lang, reward_pi)
    values (p_user, p_kind, left(p_title, 120), left(coalesce(p_brief, ''), 1000), left(coalesce(p_input, ''), 8000), case when p_lang = 'en' then 'en' else 'ar' end, p_reward)
    returning id into tid;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (p_user, -p_reward, 'task_hold', tid::text);
  return jsonb_build_object('ok', true, 'id', tid);
end $$;

create or replace function public.ln_task_cancel(p_secret text, p_user uuid, p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks;
begin
  perform public.ln_check(p_secret);
  select * into t from public.ln_tasks where id = p_task and requester_id = p_user for update;
  if t.id is null or t.status <> 'open' then return jsonb_build_object('ok', false, 'reason', 'bad_state'); end if;
  update public.ln_tasks set status = 'cancelled', decided_at = now() where id = t.id;
  update public.ln_users set pi_balance = pi_balance + t.reward_pi where id = p_user;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (p_user, t.reward_pi, 'task_refund', t.id::text);
  return jsonb_build_object('ok', true);
end $$;

-- Open tasks a worker can take (not their own, not ones they were rejected on). Shows the net reward.
create or replace function public.ln_task_open_list(p_secret text, p_user uuid, p_kind text, p_limit integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'brief', left(t.brief, 200), 'lang', t.lang,
      'reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000, 'created_at', t.created_at))
    from (select * from public.ln_tasks where status = 'open' and requester_id <> p_user and not (p_user = any(excluded))
          and (p_kind is null or kind = p_kind) order by reward_pi desc, created_at asc limit least(greatest(coalesce(p_limit, 10), 1), 25)) t), '[]'::jsonb);
end $$;

-- One task. Requesters see everything including the result; the claiming worker sees the brief and their own result;
-- anyone else only sees an open task they could take.
create or replace function public.ln_task_get(p_secret text, p_user uuid, p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks; role_ text;
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  select * into t from public.ln_tasks where id = p_task;
  if t.id is null then return null; end if;
  role_ := case when t.requester_id = p_user then 'requester' when t.worker_id = p_user then 'worker' else 'viewer' end;
  if role_ = 'viewer' and (t.status <> 'open' or p_user = any(t.excluded)) then return null; end if;
  return jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'brief', t.brief, 'input_text', t.input_text, 'lang', t.lang,
    'reward', t.reward_pi, 'net_reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000,
    'status', t.status, 'role', role_, 'created_at', t.created_at, 'claimed_at', t.claimed_at, 'submitted_at', t.submitted_at,
    'paid_pi', t.paid_pi, 'reject_note', case when role_ = 'viewer' then null else t.reject_note end,
    'result', case when role_ in ('requester','worker') then t.result else null end);
end $$;

create or replace function public.ln_task_claim(p_secret text, p_user uuid, p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks;
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  if (select count(*) from public.ln_tasks where worker_id = p_user and status = 'claimed') >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_claims'); end if;
  update public.ln_tasks set status = 'claimed', worker_id = p_user, claimed_at = now()
   where id = p_task and status = 'open' and requester_id <> p_user and not (p_user = any(excluded)) returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'reason', 'not_available'); end if;
  return jsonb_build_object('ok', true, 'expires_in_minutes', 120);
end $$;

create or replace function public.ln_task_submit(p_secret text, p_user uuid, p_task uuid, p_result jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks;
begin
  perform public.ln_check(p_secret);
  update public.ln_tasks set status = 'submitted', result = p_result, submitted_at = now(), reject_note = null
   where id = p_task and worker_id = p_user and status = 'claimed' returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'reason', 'not_claimed'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Requester approves (pays the worker) or rejects (task reopens; this worker can't take it again).
create or replace function public.ln_task_decide(p_secret text, p_user uuid, p_task uuid, p_approve boolean, p_note text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks;
begin
  perform public.ln_check(p_secret);
  select * into t from public.ln_tasks where id = p_task and requester_id = p_user for update;
  if t.id is null or t.status <> 'submitted' then return jsonb_build_object('ok', false, 'reason', 'bad_state'); end if;
  if p_approve then return public.ln_task_pay(p_secret, t.id); end if;
  update public.ln_tasks set status = 'open', excluded = excluded || t.worker_id, worker_id = null, claimed_at = null, result = null,
    submitted_at = null, reject_note = left(coalesce(p_note, ''), 300) where id = t.id;
  return jsonb_build_object('ok', true, 'reopened', true);
end $$;

-- A user's tasks as requester ('requester') or worker ('worker'), newest first, without the heavy result.
create or replace function public.ln_my_tasks(p_secret text, p_user uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'status', t.status, 'reward', t.reward_pi,
      'net_reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000,
      'has_result', t.result is not null, 'reject_note', t.reject_note, 'paid_pi', t.paid_pi, 'created_at', t.created_at) order by t.created_at desc)
    from (select * from public.ln_tasks where (p_role = 'worker' and worker_id = p_user) or (p_role <> 'worker' and requester_id = p_user)
          order by created_at desc limit 50) t), '[]'::jsonb);
end $$;

grant execute on function public.ln_link_code_create(text, uuid, text) to anon;
grant execute on function public.ln_link_code_use(text, text) to anon;
grant execute on function public.ln_mcp_token_create(text, uuid, text, text) to anon;
grant execute on function public.ln_mcp_token_verify(text, text) to anon;
grant execute on function public.ln_mcp_tokens_list(text, uuid) to anon;
grant execute on function public.ln_mcp_token_off(text, uuid, uuid) to anon;
grant execute on function public.ln_task_pay(text, uuid) to anon;
grant execute on function public.ln_task_sweep(text) to anon;
grant execute on function public.ln_task_create(text, uuid, text, text, text, text, text, numeric) to anon;
grant execute on function public.ln_task_cancel(text, uuid, uuid) to anon;
grant execute on function public.ln_task_open_list(text, uuid, text, integer) to anon;
grant execute on function public.ln_task_get(text, uuid, uuid) to anon;
grant execute on function public.ln_task_claim(text, uuid, uuid) to anon;
grant execute on function public.ln_task_submit(text, uuid, uuid, jsonb) to anon;
grant execute on function public.ln_task_decide(text, uuid, uuid, boolean, text) to anon;
grant execute on function public.ln_my_tasks(text, uuid, text) to anon;
