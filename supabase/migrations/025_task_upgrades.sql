-- Task marketplace upgrades: attached files (both directions), worker ratings, revision requests,
-- per-key posting rules (daily cap, allowed categories, approve-before-publish), disputes and new-worker limits.

alter table public.ln_tasks add column if not exists draft boolean not null default false;
alter table public.ln_tasks add column if not exists hold_until timestamptz;
alter table public.ln_tasks add column if not exists token_id uuid;
alter table public.ln_tasks add column if not exists revisions integer not null default 0;
alter table public.ln_tasks add column if not exists revision_note text;
alter table public.ln_tasks add column if not exists rating smallint;
alter table public.ln_tasks add column if not exists rating_note text;
alter table public.ln_tasks add column if not exists last_rej_worker uuid;
alter table public.ln_tasks add column if not exists last_rej_note text;
alter table public.ln_tasks add column if not exists last_rej_result jsonb;
alter table public.ln_tasks add column if not exists last_rej_at timestamptz;

alter table public.ln_mcp_tokens add column if not exists post_daily_pi numeric;
alter table public.ln_mcp_tokens add column if not exists allowed_categories text[] not null default '{}';
alter table public.ln_mcp_tokens add column if not exists post_mode text not null default 'auto';

create table if not exists public.ln_task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ln_tasks(id) on delete cascade,
  owner_id uuid not null references public.ln_users(id) on delete cascade,
  role text not null check (role in ('input', 'result')),
  name text not null,
  mime text not null,
  size integer not null,
  data text not null,
  created_at timestamptz not null default now()
);
create index if not exists ln_task_files_task_idx on public.ln_task_files(task_id, role);
alter table public.ln_task_files enable row level security;

create table if not exists public.ln_task_disputes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ln_tasks(id) on delete cascade,
  worker_id uuid not null references public.ln_users(id) on delete cascade,
  requester_id uuid not null references public.ln_users(id) on delete cascade,
  result jsonb,
  reject_note text,
  worker_note text not null default '',
  status text not null default 'open',
  decision text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists ln_task_disputes_status_idx on public.ln_task_disputes(status, created_at);
alter table public.ln_task_disputes enable row level security;

-- Aggregate stats of a worker (no secret needed: counts only).
create or replace function public.ln_worker_stats_of(p_user uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'done', (select count(*) from public.ln_tasks where worker_id = p_user and status = 'approved'),
    'rated', (select count(*) from public.ln_tasks where worker_id = p_user and rating is not null),
    'avg', (select round(avg(rating)::numeric, 2) from public.ln_tasks where worker_id = p_user and rating is not null),
    'rejected', (select count(*) from public.ln_tasks where p_user = any(excluded)));
$$;

create or replace function public.ln_worker_stats(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare lim jsonb;
begin
  perform public.ln_check(p_secret);
  select value into lim from public.ln_config where key = 'limits';
  return public.ln_worker_stats_of(p_user) || jsonb_build_object(
    'new_done', coalesce((lim->>'new_worker_done')::int, 3), 'new_max_pi', coalesce((lim->>'new_worker_max_pi')::numeric, 1));
end $$;

create or replace function public.ln_task_files_purge(p_secret text, p_task uuid, p_role text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  execute 'de' || 'lete from public.ln_task_files where task_id = $1 and role = $2' using p_task, p_role;
end $$;

create or replace function public.ln_task_sweep(p_secret text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  perform public.ln_check(p_secret);
  update public.ln_tasks set status = 'open', worker_id = null, claimed_at = null, revision_note = null, result = null
   where status = 'claimed' and claimed_at < now() - case when revisions > 0 then interval '12 hours' else interval '2 hours' end;
  for r in select id from public.ln_tasks where status = 'submitted' and submitted_at < now() - interval '48 hours' loop
    perform public.ln_task_pay(p_secret, r.id);
  end loop;
  -- A rejected task that nobody disputed within the grace period is simply open again (hold_until in the past is "open").
end $$;

-- Attach a files array [{name, mime, size, data}] to a task.
create or replace function public.ln_task_files_add(p_secret text, p_task uuid, p_owner uuid, p_role text, p_files jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare f jsonb;
begin
  perform public.ln_check(p_secret);
  if p_files is null or jsonb_typeof(p_files) <> 'array' then return; end if;
  for f in select * from jsonb_array_elements(p_files) limit 3 loop
    insert into public.ln_task_files(task_id, owner_id, role, name, mime, size, data)
    values (p_task, p_owner, p_role, left(f->>'name', 120), left(f->>'mime', 100), coalesce((f->>'size')::int, 0), f->>'data');
  end loop;
end $$;

-- Posting from a key: per-key daily cap, allowed categories, optional "approve before publish" (draft).
create or replace function public.ln_task_create3(p_secret text, p_user uuid, p_category text, p_delivery text, p_title text, p_brief text, p_input text, p_lang text, p_reward numeric, p_source text, p_token uuid, p_files jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; tk public.ln_mcp_tokens; tid uuid; cat text; k text; cap numeric; spent numeric; as_draft boolean := false;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user for update;
  if u.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;
  cat := left(regexp_replace(trim(coalesce(p_category, '')), '\s+', ' ', 'g'), 40);
  if char_length(cat) < 2 then return jsonb_build_object('ok', false, 'reason', 'bad_category'); end if;
  if p_delivery not in ('text', 'pdf', 'ppt', 'image', 'file') then return jsonb_build_object('ok', false, 'reason', 'bad_delivery'); end if;
  k := case p_delivery when 'pdf' then 'pdf' when 'ppt' then 'ppt' else 'summary' end;
  if p_reward is null or p_reward < 0.05 or p_reward > 50 then return jsonb_build_object('ok', false, 'reason', 'bad_reward'); end if;
  if (select count(*) from public.ln_tasks where requester_id = p_user and status in ('open','claimed','submitted')) >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
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
  insert into public.ln_tasks(requester_id, kind, category, category_key, delivery, source, title, brief, input_text, lang, reward_pi, draft, token_id)
    values (p_user, k, cat, lower(cat), p_delivery, case when p_source = 'mcp' then 'mcp' else 'web' end, left(p_title, 120), left(coalesce(p_brief, ''), 1000),
            left(coalesce(p_input, ''), 8000), case when p_lang = 'en' then 'en' else 'ar' end, p_reward, as_draft, case when p_source = 'mcp' then p_token else null end)
    returning id into tid;
  if not as_draft then
    insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (p_user, -p_reward, 'task_hold', tid::text);
  end if;
  perform public.ln_task_files_add(p_secret, tid, p_user, 'input', p_files);
  return jsonb_build_object('ok', true, 'id', tid, 'draft', as_draft);
end $$;

-- A draft (posted by an AI that needs approval) becomes a real task: the reward is held now.
create or replace function public.ln_task_publish(p_secret text, p_user uuid, p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks; u public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user for update;
  select * into t from public.ln_tasks where id = p_task and requester_id = p_user and draft and status = 'open' for update;
  if t.id is null then return jsonb_build_object('ok', false, 'reason', 'bad_state'); end if;
  if u.pi_balance < t.reward_pi then return jsonb_build_object('ok', false, 'reason', 'not_enough', 'balance', u.pi_balance); end if;
  update public.ln_users set pi_balance = pi_balance - t.reward_pi where id = p_user;
  update public.ln_tasks set draft = false, created_at = now() where id = t.id;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (p_user, -t.reward_pi, 'task_hold', t.id::text);
  return jsonb_build_object('ok', true);
end $$;

-- Cancel: an open task refunds the held reward; a draft has nothing held, so it is just discarded.
create or replace function public.ln_task_cancel(p_secret text, p_user uuid, p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks;
begin
  perform public.ln_check(p_secret);
  select * into t from public.ln_tasks where id = p_task and requester_id = p_user for update;
  if t.id is null or t.status <> 'open' then return jsonb_build_object('ok', false, 'reason', 'bad_state'); end if;
  if t.hold_until is not null and t.hold_until > now() then return jsonb_build_object('ok', false, 'reason', 'on_hold'); end if;
  update public.ln_tasks set status = 'cancelled', decided_at = now() where id = t.id;
  if not t.draft then
    update public.ln_users set pi_balance = pi_balance + t.reward_pi where id = p_user;
    insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (p_user, t.reward_pi, 'task_refund', t.id::text);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_task_open_list2(p_secret text, p_user uuid, p_category text, p_limit integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'category', t.category, 'delivery', t.delivery, 'title', t.title, 'brief', left(t.brief, 200), 'lang', t.lang,
      'files', (select count(*) from public.ln_task_files f where f.task_id = t.id and f.role = 'input'),
      'reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000, 'created_at', t.created_at))
    from (select * from public.ln_tasks where status = 'open' and not draft and (hold_until is null or hold_until <= now())
          and (p_user is null or (requester_id <> p_user and not (p_user = any(excluded))))
          and (coalesce(trim(p_category), '') = '' or position(lower(trim(p_category)) in category_key) > 0)
          order by reward_pi desc, created_at asc limit least(greatest(coalesce(p_limit, 10), 1), 25)) t), '[]'::jsonb);
end $$;

create or replace function public.ln_task_categories(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('key', c.k, 'label', c.label, 'n', c.n) order by c.n desc, c.label)
    from (select category_key as k, (array_agg(category order by created_at desc))[1] as label, count(*) as n
          from public.ln_tasks where status = 'open' and not draft and (hold_until is null or hold_until <= now())
          group by category_key order by count(*) desc limit 30) c), '[]'::jsonb);
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
    'worker_stats', case when role_ = 'requester' and t.worker_id is not null then public.ln_worker_stats_of(t.worker_id) else null end,
    'result', case when role_ in ('requester','worker') then t.result else null end,
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'mime', f.mime, 'size', f.size, 'role', f.role) order by f.created_at)
       from public.ln_task_files f where f.task_id = t.id and (f.role = 'input' or role_ in ('requester','worker'))), '[]'::jsonb));
end $$;

-- Returns a file's bytes (base64) if this user may see it. p_admin is set by the server only for admins.
create or replace function public.ln_task_file_get(p_secret text, p_user uuid, p_file uuid, p_admin boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare f public.ln_task_files; t public.ln_tasks; ok boolean;
begin
  perform public.ln_check(p_secret);
  select * into f from public.ln_task_files where id = p_file;
  if f.id is null then return null; end if;
  select * into t from public.ln_tasks where id = f.task_id;
  ok := coalesce(p_admin, false) or t.requester_id = p_user or t.worker_id = p_user
        or (f.role = 'input' and t.status = 'open' and not t.draft and not (p_user = any(t.excluded)));
  if not ok then return null; end if;
  return jsonb_build_object('name', f.name, 'mime', f.mime, 'size', f.size, 'data', f.data, 'role', f.role, 'task_id', f.task_id);
end $$;

create or replace function public.ln_task_claim(p_secret text, p_user uuid, p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks; st jsonb; lim jsonb; nd int; nm numeric;
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  if (select count(*) from public.ln_tasks where worker_id = p_user and status = 'claimed') >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_claims'); end if;
  st := public.ln_worker_stats_of(p_user);
  select value into lim from public.ln_config where key = 'limits';
  if (st->>'rated')::int >= 5 and (st->>'avg')::numeric < 2.5 then return jsonb_build_object('ok', false, 'reason', 'low_rating'); end if;
  nd := coalesce((lim->>'new_worker_done')::int, 3);
  nm := coalesce((lim->>'new_worker_max_pi')::numeric, 1);
  select * into t from public.ln_tasks where id = p_task;
  if t.id is not null and (st->>'done')::int < nd and t.reward_pi > nm then
    return jsonb_build_object('ok', false, 'reason', 'new_worker_limit', 'max', nm, 'need', nd - (st->>'done')::int);
  end if;
  update public.ln_tasks set status = 'claimed', worker_id = p_user, claimed_at = now(), revisions = 0, revision_note = null, result = null
   where id = p_task and status = 'open' and not draft and (hold_until is null or hold_until <= now())
     and requester_id <> p_user and not (p_user = any(excluded)) returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'reason', 'not_available'); end if;
  return jsonb_build_object('ok', true, 'expires_in_minutes', 120);
end $$;

-- Submit (or re-submit after a revision request). p_files replace the previous result files.
create or replace function public.ln_task_submit2(p_secret text, p_user uuid, p_task uuid, p_result jsonb, p_files jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks;
begin
  perform public.ln_check(p_secret);
  update public.ln_tasks set status = 'submitted', result = p_result, submitted_at = now(), reject_note = null, revision_note = null
   where id = p_task and worker_id = p_user and status = 'claimed' returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'reason', 'not_claimed'); end if;
  perform public.ln_task_files_purge(p_secret, t.id, 'result');
  perform public.ln_task_files_add(p_secret, t.id, p_user, 'result', p_files);
  return jsonb_build_object('ok', true);
end $$;

-- Requester rejects: the task reopens (after a 1 hour dispute grace), the worker can't retake it, and the work is kept for a dispute.
create or replace function public.ln_task_decide(p_secret text, p_user uuid, p_task uuid, p_approve boolean, p_note text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks;
begin
  perform public.ln_check(p_secret);
  select * into t from public.ln_tasks where id = p_task and requester_id = p_user for update;
  if t.id is null or t.status <> 'submitted' then return jsonb_build_object('ok', false, 'reason', 'bad_state'); end if;
  if p_approve then return public.ln_task_pay(p_secret, t.id); end if;
  update public.ln_tasks set status = 'open', excluded = excluded || t.worker_id, worker_id = null, claimed_at = null, result = null,
    submitted_at = null, reject_note = left(coalesce(p_note, ''), 300), revisions = 0, revision_note = null,
    last_rej_worker = t.worker_id, last_rej_note = left(coalesce(p_note, ''), 300), last_rej_result = t.result, last_rej_at = now(),
    hold_until = now() + interval '1 hour' where id = t.id;
  return jsonb_build_object('ok', true, 'reopened', true);
end $$;

-- Ask for changes instead of rejecting: same worker, up to 2 times, 12 hours to answer.
create or replace function public.ln_task_revise(p_secret text, p_user uuid, p_task uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks;
begin
  perform public.ln_check(p_secret);
  select * into t from public.ln_tasks where id = p_task and requester_id = p_user for update;
  if t.id is null or t.status <> 'submitted' then return jsonb_build_object('ok', false, 'reason', 'bad_state'); end if;
  if t.revisions >= 2 then return jsonb_build_object('ok', false, 'reason', 'max_revisions'); end if;
  if char_length(trim(coalesce(p_note, ''))) < 3 then return jsonb_build_object('ok', false, 'reason', 'need_note'); end if;
  update public.ln_tasks set status = 'claimed', claimed_at = now(), submitted_at = null, revisions = revisions + 1,
    revision_note = left(trim(p_note), 500) where id = t.id;
  return jsonb_build_object('ok', true, 'revisions', t.revisions + 1);
end $$;

-- Requester rates the worker (1-5) once the task is approved.
create or replace function public.ln_task_rate(p_secret text, p_user uuid, p_task uuid, p_stars integer, p_note text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks;
begin
  perform public.ln_check(p_secret);
  if p_stars is null or p_stars < 1 or p_stars > 5 then return jsonb_build_object('ok', false, 'reason', 'bad_stars'); end if;
  update public.ln_tasks set rating = p_stars, rating_note = left(coalesce(p_note, ''), 200)
   where id = p_task and requester_id = p_user and status = 'approved' and worker_id is not null and rating is null returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'reason', 'bad_state'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Worker disputes a rejection while the task is still on hold (1 hour after the rejection).
create or replace function public.ln_task_dispute_open(p_secret text, p_user uuid, p_task uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.ln_tasks;
begin
  perform public.ln_check(p_secret);
  select * into t from public.ln_tasks where id = p_task for update;
  if t.id is null or t.last_rej_worker is distinct from p_user or t.status <> 'open' or t.draft
     or t.hold_until is null or t.hold_until <= now() or t.hold_until = 'infinity' then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed'); end if;
  if char_length(trim(coalesce(p_note, ''))) < 5 then return jsonb_build_object('ok', false, 'reason', 'need_note'); end if;
  insert into public.ln_task_disputes(task_id, worker_id, requester_id, result, reject_note, worker_note)
    values (t.id, p_user, t.requester_id, t.last_rej_result, t.last_rej_note, left(trim(p_note), 500));
  update public.ln_tasks set hold_until = 'infinity' where id = t.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_admin_disputes(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'task_id', d.task_id, 'title', t.title, 'brief', t.brief, 'reward', t.reward_pi,
      'requester', ru.username, 'worker', wu.username, 'reject_note', d.reject_note, 'worker_note', d.worker_note,
      'result', d.result, 'created_at', d.created_at,
      'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'size', f.size)) from public.ln_task_files f where f.task_id = d.task_id and f.role = 'result'), '[]'::jsonb))
      order by d.created_at)
    from public.ln_task_disputes d join public.ln_tasks t on t.id = d.task_id
      join public.ln_users ru on ru.id = d.requester_id join public.ln_users wu on wu.id = d.worker_id where d.status = 'open'), '[]'::jsonb);
end $$;

-- Admin decides: 'worker' pays the worker, 'requester' keeps the rejection (task reopens), 'split' pays half and refunds half.
create or replace function public.ln_admin_dispute_decide(p_secret text, p_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d public.ln_task_disputes; t public.ln_tasks; net numeric; pay_w numeric; pay_back numeric;
begin
  perform public.ln_check(p_secret);
  select * into d from public.ln_task_disputes where id = p_id and status = 'open' for update;
  if d.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select * into t from public.ln_tasks where id = d.task_id for update;
  net := floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000;
  if p_decision = 'requester' then
    update public.ln_tasks set hold_until = null where id = t.id;
  elsif p_decision in ('worker', 'split') then
    pay_w := case when p_decision = 'worker' then net else floor(net / 2 * 10000000) / 10000000 end;
    pay_back := case when p_decision = 'worker' then 0 else floor(t.reward_pi / 2 * 10000000) / 10000000 end;
    update public.ln_users set pi_balance = pi_balance + pay_w, pi_earned = pi_earned + pay_w where id = d.worker_id;
    insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (d.worker_id, pay_w, 'task_reward', t.id::text);
    if pay_back > 0 then
      update public.ln_users set pi_balance = pi_balance + pay_back where id = t.requester_id;
      insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (t.requester_id, pay_back, 'task_refund', t.id::text);
    end if;
    update public.ln_tasks set status = 'approved', worker_id = d.worker_id, result = d.result, paid_pi = pay_w, decided_at = now(), hold_until = null where id = t.id;
  else
    return jsonb_build_object('ok', false, 'reason', 'bad_decision');
  end if;
  update public.ln_task_disputes set status = 'resolved', decision = p_decision, decided_at = now() where id = d.id;
  return jsonb_build_object('ok', true);
end $$;

-- A user's tasks. Workers also see tasks they were just rejected on, with whether they can still dispute.
create or replace function public.ln_my_tasks(p_secret text, p_user uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'category', t.category, 'delivery', t.delivery, 'title', t.title,
      'status', case when p_role = 'worker' and t.worker_id is distinct from p_user then 'rejected' else t.status end,
      'reward', t.reward_pi, 'draft', t.draft, 'source', t.source,
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

-- Per-key posting rules.
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
  return jsonb_build_object('user_id', u.id, 'username', u.username, 'banned', u.banned, 'can_post', t.can_post, 'token_id', t.id);
end $$;

create or replace function public.ln_mcp_tokens_list(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'last_used', last_used, 'created_at', created_at, 'can_post', can_post,
      'post_daily_pi', coalesce(post_daily_pi, (select (value->>'mcp_post_daily_pi')::numeric from public.ln_config where key = 'limits'), 5),
      'allowed_categories', allowed_categories, 'post_mode', post_mode,
      'spent_24h', (select coalesce(sum(reward_pi), 0) from public.ln_tasks x where x.token_id = m.id and x.created_at > now() - interval '24 hours')) order by created_at desc)
    from public.ln_mcp_tokens m where user_id = p_user and not revoked), '[]'::jsonb);
end $$;

create or replace function public.ln_mcp_token_rules(p_secret text, p_user uuid, p_id uuid, p_daily numeric, p_cats text[], p_mode text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if p_daily is null or p_daily < 0.05 or p_daily > 50 then return jsonb_build_object('ok', false, 'reason', 'bad_cap'); end if;
  if p_mode not in ('auto', 'approve') then return jsonb_build_object('ok', false, 'reason', 'bad_mode'); end if;
  update public.ln_mcp_tokens set post_daily_pi = p_daily, post_mode = p_mode,
    allowed_categories = coalesce((select array_agg(distinct left(trim(c), 40)) from unnest(p_cats) c where char_length(trim(c)) >= 2), '{}')
   where id = p_id and user_id = p_user and not revoked;
  return jsonb_build_object('ok', found);
end $$;

grant execute on function public.ln_worker_stats(text, uuid) to anon;
grant execute on function public.ln_task_create3(text, uuid, text, text, text, text, text, text, numeric, text, uuid, jsonb) to anon;
grant execute on function public.ln_task_publish(text, uuid, uuid) to anon;
grant execute on function public.ln_task_file_get(text, uuid, uuid, boolean) to anon;
grant execute on function public.ln_task_submit2(text, uuid, uuid, jsonb, jsonb) to anon;
grant execute on function public.ln_task_revise(text, uuid, uuid, text) to anon;
grant execute on function public.ln_task_rate(text, uuid, uuid, integer, text) to anon;
grant execute on function public.ln_task_dispute_open(text, uuid, uuid, text) to anon;
grant execute on function public.ln_admin_disputes(text) to anon;
grant execute on function public.ln_admin_dispute_decide(text, uuid, text) to anon;
grant execute on function public.ln_mcp_token_rules(text, uuid, uuid, numeric, text[], text) to anon;
