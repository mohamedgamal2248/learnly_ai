-- Free-text task categories (any word), a separate delivery format, filters built from what's actually posted,
-- and an opt-in per MCP key to let that AI post tasks (with a daily Pi cap).
alter table public.ln_tasks add column if not exists category text not null default '';
alter table public.ln_tasks add column if not exists category_key text not null default '';
alter table public.ln_tasks add column if not exists delivery text not null default 'text';
alter table public.ln_tasks add column if not exists source text not null default 'web';
update public.ln_tasks set delivery = case kind when 'pdf' then 'pdf' when 'ppt' then 'ppt' else 'text' end where category = '';
update public.ln_tasks set category = case kind when 'summary' then 'تلخيص' when 'translate' then 'ترجمة' when 'research' then 'بحث' when 'pdf' then 'ملف PDF' else 'عرض PowerPoint' end where category = '';
update public.ln_tasks set category_key = lower(category) where category_key = '';
create index if not exists ln_tasks_cat_idx on public.ln_tasks(category_key) where status = 'open';
alter table public.ln_mcp_tokens add column if not exists can_post boolean not null default false;

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
  return jsonb_build_object('user_id', u.id, 'username', u.username, 'banned', u.banned, 'can_post', t.can_post);
end $$;

create or replace function public.ln_mcp_tokens_list(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'last_used', last_used, 'created_at', created_at, 'can_post', can_post) order by created_at desc)
    from public.ln_mcp_tokens where user_id = p_user and not revoked), '[]'::jsonb);
end $$;

create or replace function public.ln_mcp_token_set_post(p_secret text, p_user uuid, p_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_mcp_tokens set can_post = coalesce(p_on, false) where id = p_id and user_id = p_user and not revoked;
end $$;

create or replace function public.ln_task_create2(p_secret text, p_user uuid, p_category text, p_delivery text, p_title text, p_brief text, p_input text, p_lang text, p_reward numeric, p_source text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; tid uuid; cat text; k text; cap numeric; spent numeric;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user for update;
  if u.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;
  cat := left(regexp_replace(trim(coalesce(p_category, '')), '\s+', ' ', 'g'), 40);
  if char_length(cat) < 2 then return jsonb_build_object('ok', false, 'reason', 'bad_category'); end if;
  if p_delivery not in ('text', 'pdf', 'ppt') then return jsonb_build_object('ok', false, 'reason', 'bad_delivery'); end if;
  k := case p_delivery when 'pdf' then 'pdf' when 'ppt' then 'ppt' else 'summary' end;
  if p_reward is null or p_reward < 0.05 or p_reward > 50 then return jsonb_build_object('ok', false, 'reason', 'bad_reward'); end if;
  if (select count(*) from public.ln_tasks where requester_id = p_user and status in ('open','claimed','submitted')) >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  if u.pi_balance < p_reward then return jsonb_build_object('ok', false, 'reason', 'not_enough', 'balance', u.pi_balance); end if;
  if p_source = 'mcp' then
    cap := coalesce((select (value->>'mcp_post_daily_pi')::numeric from public.ln_config where key = 'limits'), 5);
    select coalesce(sum(reward_pi), 0) into spent from public.ln_tasks where requester_id = p_user and source = 'mcp' and created_at > now() - interval '24 hours';
    if spent + p_reward > cap then return jsonb_build_object('ok', false, 'reason', 'mcp_cap', 'cap', cap, 'spent', spent); end if;
  end if;
  update public.ln_users set pi_balance = pi_balance - p_reward where id = p_user;
  insert into public.ln_tasks(requester_id, kind, category, category_key, delivery, source, title, brief, input_text, lang, reward_pi)
    values (p_user, k, cat, lower(cat), p_delivery, case when p_source = 'mcp' then 'mcp' else 'web' end, left(p_title, 120), left(coalesce(p_brief, ''), 1000),
            left(coalesce(p_input, ''), 8000), case when p_lang = 'en' then 'en' else 'ar' end, p_reward) returning id into tid;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (p_user, -p_reward, 'task_hold', tid::text);
  return jsonb_build_object('ok', true, 'id', tid);
end $$;

-- p_category: empty = all; otherwise matches categories that contain the text (case-insensitive).
create or replace function public.ln_task_open_list2(p_secret text, p_user uuid, p_category text, p_limit integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'category', t.category, 'delivery', t.delivery, 'title', t.title, 'brief', left(t.brief, 200), 'lang', t.lang,
      'reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000, 'created_at', t.created_at))
    from (select * from public.ln_tasks where status = 'open'
          and (p_user is null or (requester_id <> p_user and not (p_user = any(excluded))))
          and (coalesce(trim(p_category), '') = '' or position(lower(trim(p_category)) in category_key) > 0)
          order by reward_pi desc, created_at asc limit least(greatest(coalesce(p_limit, 10), 1), 25)) t), '[]'::jsonb);
end $$;

-- Categories that currently have open tasks (this is what the filter shows), biggest first.
create or replace function public.ln_task_categories(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('key', c.k, 'label', c.label, 'n', c.n) order by c.n desc, c.label)
    from (select category_key as k, (array_agg(category order by created_at desc))[1] as label, count(*) as n
          from public.ln_tasks where status = 'open' group by category_key order by count(*) desc limit 30) c), '[]'::jsonb);
end $$;

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
  return jsonb_build_object('id', t.id, 'kind', t.kind, 'category', t.category, 'delivery', t.delivery, 'title', t.title, 'brief', t.brief, 'input_text', t.input_text, 'lang', t.lang,
    'reward', t.reward_pi, 'net_reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000,
    'status', t.status, 'role', role_, 'created_at', t.created_at, 'claimed_at', t.claimed_at, 'submitted_at', t.submitted_at,
    'paid_pi', t.paid_pi, 'reject_note', case when role_ = 'viewer' then null else t.reject_note end,
    'result', case when role_ in ('requester','worker') then t.result else null end);
end $$;

create or replace function public.ln_my_tasks(p_secret text, p_user uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'category', t.category, 'delivery', t.delivery, 'title', t.title, 'status', t.status, 'reward', t.reward_pi,
      'net_reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000,
      'has_result', t.result is not null, 'reject_note', t.reject_note, 'paid_pi', t.paid_pi, 'created_at', t.created_at) order by t.created_at desc)
    from (select * from public.ln_tasks where (p_role = 'worker' and worker_id = p_user) or (p_role <> 'worker' and requester_id = p_user)
          order by created_at desc limit 50) t), '[]'::jsonb);
end $$;

grant execute on function public.ln_mcp_token_set_post(text, uuid, uuid, boolean) to anon;
grant execute on function public.ln_task_create2(text, uuid, text, text, text, text, text, text, numeric, text) to anon;
grant execute on function public.ln_task_open_list2(text, uuid, text, integer) to anon;
grant execute on function public.ln_task_categories(text) to anon;
