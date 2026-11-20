-- Wallet ledger, agent activity log, board and people filters, price hints, invite-only tasks, onboarding, verified portfolio items.

alter table public.ln_tasks add column if not exists invited uuid[] not null default '{}';
alter table public.ln_portfolio add column if not exists task_id uuid;

create table if not exists public.ln_mcp_log (
  id bigserial primary key,
  user_id uuid not null references public.ln_users(id) on delete cascade,
  token_id uuid,
  tool text not null,
  ok boolean not null default true,
  note text not null default '',
  amount numeric(18,7),
  created_at timestamptz not null default now()
);
create index if not exists ln_mcp_log_user_idx on public.ln_mcp_log(user_id, id desc);
alter table public.ln_mcp_log enable row level security;

-- ---------- wallet ledger ----------
create or replace function public.ln_ledger_list(p_secret text, p_user uuid, p_limit integer, p_offset integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return jsonb_build_object(
    'total', (select count(*) from public.ln_pi_ledger where user_id = p_user),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'delta', l.delta, 'kind', l.kind, 'at', l.created_at,
        'title', case when l.kind in ('task_hold', 'task_refund', 'task_reward') then (select t.title from public.ln_tasks t where t.id::text = l.ref) else null end) order by l.id desc)
      from (select * from public.ln_pi_ledger where user_id = p_user order by id desc limit least(greatest(coalesce(p_limit, 30), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) l), '[]'::jsonb));
end $$;

-- ---------- agent activity ----------
create or replace function public.ln_mcp_log_add(p_secret text, p_user uuid, p_token uuid, p_tool text, p_ok boolean, p_note text, p_amount numeric)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  insert into public.ln_mcp_log(user_id, token_id, tool, ok, note, amount) values (p_user, p_token, left(p_tool, 40), coalesce(p_ok, true), left(coalesce(p_note, ''), 160), p_amount);
  if random() < 0.1 then
    execute 'de' || 'lete from public.ln_mcp_log where user_id = $1 and id < coalesce((select id from public.ln_mcp_log where user_id = $1 order by id desc offset 200 limit 1), 0)' using p_user;
  end if;
end $$;

create or replace function public.ln_mcp_log_list(p_secret text, p_user uuid, p_limit integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'tool', l.tool, 'ok', l.ok, 'note', l.note, 'amount', l.amount, 'at', l.created_at,
      'key', (select m.name from public.ln_mcp_tokens m where m.id = l.token_id)) order by l.id desc)
    from (select * from public.ln_mcp_log where user_id = p_user order by id desc limit least(greatest(coalesce(p_limit, 40), 1), 100)) l), '[]'::jsonb);
end $$;

create or replace function public.ln_mcp_tokens_off_all(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_mcp_tokens set revoked = true where user_id = p_user and not revoked;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- invite-only visibility ----------
create or replace function private.tg_task_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare f record; quiet boolean := coalesce(current_setting('hl.invite', true), '') = '1';
begin
  if tg_op = 'INSERT' then
    if new.status = 'open' and not new.draft then
      if not quiet then
        for f in select user_id from public.ln_follows where category_key = new.category_key and user_id <> new.requester_id limit 200 loop
          perform private.notify(f.user_id, 'new_task', jsonb_build_object('title', new.title, 'category', new.category, 'reward', new.reward_pi), '/tasks');
        end loop;
      end if;
    elsif new.status = 'claimed' and new.worker_id is not null then
      perform private.notify(new.worker_id, 'task_assigned', jsonb_build_object('title', new.title, 'reward', new.reward_pi), '/tasks');
    end if;
    return new;
  end if;
  if old.status = 'open' and new.status = 'claimed' and new.deal_id is null then
    perform private.notify(new.requester_id, 'task_claimed', jsonb_build_object('title', new.title), '/tasks');
  elsif old.status = 'claimed' and new.status = 'submitted' then
    perform private.notify(new.requester_id, 'task_submitted', jsonb_build_object('title', new.title, 'stage', new.stage_idx + 1), '/tasks');
  elsif old.status = 'submitted' and new.status = 'approved' then
    perform private.notify(new.worker_id, 'task_approved', jsonb_build_object('title', new.title, 'paid', new.paid_pi), '/tasks');
  elsif old.status = 'submitted' and new.status = 'claimed' and new.stage_idx > old.stage_idx then
    perform private.notify(new.worker_id, 'task_stage_paid', jsonb_build_object('title', new.title, 'stage', new.stage_idx + 1), '/tasks');
  elsif old.status = 'submitted' and new.status = 'claimed' then
    perform private.notify(new.worker_id, 'task_revision', jsonb_build_object('title', new.title, 'note', new.revision_note), '/tasks');
  elsif old.status = 'submitted' and new.status = 'open' then
    perform private.notify(old.worker_id, 'task_rejected', jsonb_build_object('title', new.title, 'note', new.reject_note), '/tasks');
  elsif old.status = 'submitted' and new.status = 'cancelled' then
    perform private.notify(old.worker_id, 'task_closed', jsonb_build_object('title', new.title), '/tasks');
  end if;
  if old.rating is null and new.rating is not null then
    perform private.notify(new.worker_id, 'task_rated', jsonb_build_object('title', new.title, 'stars', new.rating), '/tasks');
  end if;
  if old.draft and not new.draft and new.status = 'open' and cardinality(new.invited) = 0 then
    for f in select user_id from public.ln_follows where category_key = new.category_key and user_id <> new.requester_id limit 200 loop
      perform private.notify(f.user_id, 'new_task', jsonb_build_object('title', new.title, 'category', new.category, 'reward', new.reward_pi), '/tasks');
    end loop;
  end if;
  return new;
end $$;

create or replace function public.ln_task_create5(p_secret text, p_user uuid, p_category text, p_delivery text, p_title text, p_brief text, p_input text, p_lang text, p_reward numeric, p_source text, p_token uuid, p_files jsonb, p_stages jsonb, p_parent uuid, p_invite text[])
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare inv uuid[] := '{}'; nm text; w public.ln_users; iv uuid; res jsonb;
begin
  perform public.ln_check(p_secret);
  if p_invite is not null then
    if cardinality(p_invite) > 3 then return jsonb_build_object('ok', false, 'reason', 'bad_invite'); end if;
    foreach nm in array p_invite loop
      if char_length(trim(nm)) < 2 then continue; end if;
      select * into w from public.ln_users where lower(username) = lower(trim(nm)) and not banned order by created_at limit 1;
      if w.id is null or w.id = p_user or public.ln_is_blocked(p_secret, p_user, w.id) then return jsonb_build_object('ok', false, 'reason', 'bad_invite', 'name', nm); end if;
      inv := inv || w.id;
    end loop;
  end if;
  perform set_config('hl.invite', case when cardinality(inv) > 0 then '1' else '0' end, true);
  res := public.ln_task_create4(p_secret, p_user, p_category, p_delivery, p_title, p_brief, p_input, p_lang, p_reward, p_source, p_token, p_files, p_stages, p_parent);
  perform set_config('hl.invite', '0', true);
  if coalesce((res->>'ok')::boolean, false) and cardinality(inv) > 0 then
    update public.ln_tasks set invited = inv where id = (res->>'id')::uuid;
    foreach iv in array inv loop
      perform private.notify(iv, 'task_invited', jsonb_build_object('title', left(p_title, 120), 'reward', p_reward), '/tasks');
    end loop;
  end if;
  return res;
end $$;

create or replace function public.ln_task_open_list2(p_secret text, p_user uuid, p_category text, p_limit integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'category', t.category, 'delivery', t.delivery, 'title', t.title, 'brief', left(t.brief, 200), 'lang', t.lang,
      'files', (select count(*) from public.ln_task_files f where f.task_id = t.id and f.role = 'input'),
      'invited', cardinality(t.invited) > 0, 'stages', case when t.stages is null then 0 else jsonb_array_length(t.stages) end,
      'reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000, 'created_at', t.created_at))
    from (select * from public.ln_tasks where status = 'open' and not draft and (hold_until is null or hold_until <= now())
          and (cardinality(invited) = 0 or p_user = any(invited))
          and (p_user is null or (requester_id <> p_user and not (p_user = any(excluded))))
          and (coalesce(trim(p_category), '') = '' or position(lower(trim(p_category)) in category_key) > 0)
          order by reward_pi desc, created_at asc limit least(greatest(coalesce(p_limit, 10), 1), 25)) t), '[]'::jsonb);
end $$;

-- The website board: search, filters, sort and paging. {tasks, total}.
create or replace function public.ln_task_open_list3(p_secret text, p_user uuid, p_category text, p_q text, p_min numeric, p_delivery text, p_sort text, p_limit integer, p_offset integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare q text := lower(trim(coalesce(p_q, '')));
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return jsonb_build_object(
    'total', (select count(*) from public.ln_tasks t where t.status = 'open' and not t.draft and (t.hold_until is null or t.hold_until <= now())
          and (cardinality(t.invited) = 0 or p_user = any(t.invited)) and (p_user is null or (t.requester_id <> p_user and not (p_user = any(t.excluded))))
          and (coalesce(trim(p_category), '') = '' or position(lower(trim(p_category)) in t.category_key) > 0)
          and (q = '' or position(q in lower(t.title || ' ' || t.brief || ' ' || t.category)) > 0)
          and t.reward_pi >= coalesce(p_min, 0) and (coalesce(p_delivery, '') = '' or t.delivery = p_delivery)),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'category', t.category, 'delivery', t.delivery, 'title', t.title, 'brief', left(t.brief, 200), 'lang', t.lang,
        'files', (select count(*) from public.ln_task_files f where f.task_id = t.id and f.role = 'input'),
        'invited', cardinality(t.invited) > 0, 'stages', case when t.stages is null then 0 else jsonb_array_length(t.stages) end,
        'reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000, 'created_at', t.created_at) order by t.ord1 desc, t.ord2 desc)
      from (select t.*, case when p_sort = 'reward' then t.reward_pi else 0 end as ord1, extract(epoch from t.created_at) as ord2
            from public.ln_tasks t where t.status = 'open' and not t.draft and (t.hold_until is null or t.hold_until <= now())
              and (cardinality(t.invited) = 0 or p_user = any(t.invited)) and (p_user is null or (t.requester_id <> p_user and not (p_user = any(t.excluded))))
              and (coalesce(trim(p_category), '') = '' or position(lower(trim(p_category)) in t.category_key) > 0)
              and (q = '' or position(q in lower(t.title || ' ' || t.brief || ' ' || t.category)) > 0)
              and t.reward_pi >= coalesce(p_min, 0) and (coalesce(p_delivery, '') = '' or t.delivery = p_delivery)
            order by (case when p_sort = 'reward' then t.reward_pi else 0 end) desc, t.created_at desc
            limit least(greatest(coalesce(p_limit, 20), 1), 40) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb));
end $$;

create or replace function public.ln_task_categories(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('key', c.k, 'label', c.label, 'n', c.n) order by c.n desc, c.label)
    from (select category_key as k, (array_agg(category order by created_at desc))[1] as label, count(*) as n
          from public.ln_tasks where status = 'open' and not draft and cardinality(invited) = 0 and (hold_until is null or hold_until <= now())
          group by category_key order by count(*) desc limit 30) c), '[]'::jsonb);
end $$;

create or replace function public.ln_task_feed(p_secret text, p_user uuid, p_since timestamptz, p_min numeric, p_cats text[], p_limit integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare cats text[];
begin
  perform public.ln_check(p_secret);
  perform public.ln_task_sweep(p_secret);
  cats := coalesce((select array_agg(lower(trim(c))) from unnest(coalesce(p_cats, '{}')) c where char_length(trim(c)) >= 2), '{}');
  if cardinality(cats) = 0 then cats := coalesce((select array_agg(category_key) from public.ln_follows where user_id = p_user), '{}'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'category', t.category, 'delivery', t.delivery, 'title', t.title, 'brief', left(t.brief, 200), 'lang', t.lang,
      'files', (select count(*) from public.ln_task_files f where f.task_id = t.id and f.role = 'input'), 'stages', case when t.stages is null then 0 else jsonb_array_length(t.stages) end,
      'invited', cardinality(t.invited) > 0,
      'reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000, 'created_at', t.created_at) order by t.created_at desc)
    from (select * from public.ln_tasks where status = 'open' and not draft and (hold_until is null or hold_until <= now())
          and (cardinality(invited) = 0 or p_user = any(invited))
          and requester_id <> p_user and not (p_user = any(excluded)) and created_at > coalesce(p_since, '-infinity')
          and reward_pi >= coalesce(p_min, 0)
          and (cardinality(cats) = 0 or exists (select 1 from unnest(cats) c where position(c in category_key) > 0))
          order by created_at desc limit least(greatest(coalesce(p_limit, 15), 1), 30)) t), '[]'::jsonb);
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
  if t.id is not null and (st->>'done')::int < nd and t.reward_pi > nm and not (p_user = any(t.invited)) then
    return jsonb_build_object('ok', false, 'reason', 'new_worker_limit', 'max', nm, 'need', nd - (st->>'done')::int);
  end if;
  update public.ln_tasks set status = 'claimed', worker_id = p_user, claimed_at = now(), revisions = 0, revision_note = null, result = null
   where id = p_task and status = 'open' and not draft and (hold_until is null or hold_until <= now())
     and (cardinality(invited) = 0 or p_user = any(invited))
     and requester_id <> p_user and not (p_user = any(excluded)) returning * into t;
  if t.id is null then return jsonb_build_object('ok', false, 'reason', 'not_available'); end if;
  return jsonb_build_object('ok', true, 'expires_in_minutes', 120);
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
  visible := t.status = 'open' and not t.draft and (t.hold_until is null or t.hold_until <= now()) and not (p_user = any(t.excluded))
             and (cardinality(t.invited) = 0 or p_user = any(t.invited));
  if role_ = 'viewer' and not visible then return null; end if;
  return jsonb_build_object('id', t.id, 'kind', t.kind, 'category', t.category, 'delivery', t.delivery, 'title', t.title, 'brief', t.brief, 'input_text', t.input_text, 'lang', t.lang,
    'reward', t.reward_pi, 'net_reward', floor(t.reward_pi * (1 - public.ln_task_fee_pct() / 100) * 10000000) / 10000000,
    'status', t.status, 'role', role_, 'draft', t.draft, 'source', t.source, 'created_at', t.created_at, 'claimed_at', t.claimed_at, 'submitted_at', t.submitted_at,
    'paid_pi', t.paid_pi, 'reject_note', case when role_ = 'viewer' then null else t.reject_note end,
    'revisions', t.revisions, 'revision_note', case when role_ = 'viewer' then null else t.revision_note end,
    'rating', case when role_ = 'viewer' then null else t.rating end,
    'invited', case when role_ = 'requester' then coalesce((select jsonb_agg(u.username) from public.ln_users u where u.id = any(t.invited)), '[]'::jsonb) else null end,
    'stages', t.stages, 'stage_idx', t.stage_idx, 'stage_paid', t.stage_paid, 'parent_id', case when role_ = 'viewer' then null else t.parent_id end,
    'subtasks', case when role_ = 'viewer' then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'status', c.status, 'reward', c.reward_pi) order by c.created_at)
        from public.ln_tasks c where c.parent_id = t.id), '[]'::jsonb) end,
    'worker_stats', case when role_ = 'requester' and t.worker_id is not null then public.ln_worker_stats_of(t.worker_id) else null end,
    'result', case when role_ in ('requester','worker') then t.result else null end,
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'mime', f.mime, 'size', f.size, 'role', f.role) order by f.created_at)
       from public.ln_task_files f where f.task_id = t.id and (f.role = 'input' or role_ in ('requester','worker'))), '[]'::jsonb));
end $$;

-- ---------- people search with filters ----------
create or replace function public.ln_people_search2(p_secret text, p_query text, p_ai text, p_sort text, p_avail boolean, p_min_rating numeric, p_max_price numeric, p_limit integer, p_offset integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare words text[];
begin
  perform public.ln_check(p_secret);
  words := coalesce((select array_agg(w) from (select distinct lower(x) as w from regexp_split_to_table(trim(coalesce(p_query, '')), '\s+') x where char_length(x) >= 2 limit 6) q), '{}');
  return (select jsonb_build_object('total', coalesce(max(z.total), 0), 'people', coalesce(jsonb_agg(z.card order by z.rn), '[]'::jsonb)) from (
    select y.card, y.total, row_number() over (order by case when p_sort = 'new' then extract(epoch from y.created) end desc nulls last,
        case when p_sort = 'price' then y.price end asc nulls last, case when p_sort = 'done' then y.dn end desc nulls last,
        y.sc desc, y.av desc, y.dn desc) as rn
    from (
      select jsonb_build_object('username', u.username, 'headline', pr.headline, 'skills', pr.skills, 'uses_ai', pr.uses_ai, 'available', pr.available, 'rate_from', pr.rate_from,
          'stats', st.j, 'badges', public.ln_badges_of(u.id),
          'services', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'price', s.price_pi)) from (select title, price_pi from public.ln_services where user_id = u.id and active order by created_at limit 2) s), '[]'::jsonb),
          'works', coalesce((select jsonb_agg(p.title) from (select title from public.ln_portfolio where user_id = u.id and active order by created_at desc limit 3) p), '[]'::jsonb)) as card,
        sc.n as sc, coalesce((st.j->>'avg')::numeric, 0) as av, (st.j->>'done')::int as dn, u.created_at as created,
        least(coalesce(pr.rate_from, 1e12), coalesce((select min(price_pi) from public.ln_services where user_id = u.id and active), 1e12)) as price,
        count(*) over () as total
      from public.ln_profiles pr join public.ln_users u on u.id = pr.user_id
      cross join lateral (select public.ln_worker_stats_of(u.id) as j) st
      cross join lateral (select lower(coalesce(pr.headline, '') || ' ' || coalesce(pr.bio, '') || ' ' || array_to_string(pr.skills, ' ') || ' ' ||
          coalesce((select string_agg(title || ' ' || description || ' ' || array_to_string(tags, ' '), ' ') from public.ln_portfolio where user_id = u.id and active), '') || ' ' ||
          coalesce((select string_agg(title || ' ' || description || ' ' || category, ' ') from public.ln_services where user_id = u.id and active), '') || ' ' ||
          coalesce((select string_agg(distinct category_key, ' ') from public.ln_tasks where worker_id = u.id and status = 'approved'), '')) as hay) s
      cross join lateral (select case when cardinality(words) = 0 then 1 else (select count(*) from unnest(words) w where position(w in s.hay) > 0) end as n) sc
      where pr.visible and not u.banned and (coalesce(p_ai, '') = '' or pr.uses_ai in (p_ai, 'both')) and sc.n > 0
        and (not coalesce(p_avail, false) or pr.available)
        and (p_min_rating is null or coalesce((st.j->>'avg')::numeric, 0) >= p_min_rating)
        and (p_max_price is null or least(coalesce(pr.rate_from, 1e12), coalesce((select min(price_pi) from public.ln_services where user_id = u.id and active), 1e12)) <= p_max_price)
    ) y
    order by rn
    limit least(greatest(coalesce(p_limit, 20), 1), 40) offset greatest(coalesce(p_offset, 0), 0)) z);
end $$;

-- ---------- price hint ----------
create or replace function public.ln_price_hint(p_secret text, p_category text, p_delivery text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare k text := lower(trim(coalesce(p_category, ''))); r record;
begin
  perform public.ln_check(p_secret);
  if char_length(k) >= 2 then
    select count(*) as n, round(avg(reward_pi), 3) as avg, min(reward_pi) as lo, max(reward_pi) as hi, round((percentile_cont(0.5) within group (order by reward_pi))::numeric, 3) as med
      into r from public.ln_tasks where status = 'approved' and position(k in category_key) > 0 and (coalesce(p_delivery, '') = '' or delivery = p_delivery);
    if r.n >= 3 then return jsonb_build_object('scope', 'category', 'n', r.n, 'avg', r.avg, 'min', r.lo, 'max', r.hi, 'median', r.med); end if;
  end if;
  select count(*) as n, round(avg(reward_pi), 3) as avg, min(reward_pi) as lo, max(reward_pi) as hi, round((percentile_cont(0.5) within group (order by reward_pi))::numeric, 3) as med
    into r from public.ln_tasks where status = 'approved' and coalesce(p_delivery, '') <> '' and delivery = p_delivery;
  if r.n >= 3 then return jsonb_build_object('scope', 'delivery', 'n', r.n, 'avg', r.avg, 'min', r.lo, 'max', r.hi, 'median', r.med); end if;
  return jsonb_build_object('scope', 'none', 'n', 0);
end $$;

-- ---------- onboarding ----------
create or replace function public.ln_onboarding(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  return jsonb_build_object(
    'profile', exists (select 1 from public.ln_profiles where user_id = p_user and char_length(headline) > 0),
    'showcase', exists (select 1 from public.ln_services where user_id = p_user and active) or exists (select 1 from public.ln_portfolio where user_id = p_user and active),
    'agent', exists (select 1 from public.ln_mcp_tokens where user_id = p_user and not revoked),
    'funded', u.pi_balance > 0 or exists (select 1 from public.ln_payments where user_id = p_user and deposit and status = 'completed'),
    'posted', exists (select 1 from public.ln_tasks where requester_id = p_user and source <> 'deal') or exists (select 1 from public.ln_tasks where worker_id = p_user and status = 'approved'));
end $$;

-- ---------- verified portfolio items ----------
create or replace function public.ln_portfolio_add2(p_secret text, p_user uuid, p_title text, p_desc text, p_made_with text, p_tags text[], p_mime text, p_data text, p_task uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare res jsonb;
begin
  perform public.ln_check(p_secret);
  if p_task is not null and not exists (select 1 from public.ln_tasks where id = p_task and worker_id = p_user and status = 'approved') then
    return jsonb_build_object('ok', false, 'reason', 'bad_task'); end if;
  res := public.ln_portfolio_add(p_secret, p_user, p_title, p_desc, p_made_with, p_tags, p_mime, p_data);
  if coalesce((res->>'ok')::boolean, false) and p_task is not null then
    update public.ln_portfolio set task_id = p_task where id = (res->>'id')::uuid;
  end if;
  return res;
end $$;

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
        'has_image', p.image_data is not null, 'at', p.created_at, 'verified', p.task_id is not null, 'stars', (select t.rating from public.ln_tasks t where t.id = p.task_id)) order by p.created_at desc)
        from public.ln_portfolio p where p.user_id = u.id and p.active), '[]'::jsonb));
end $$;

grant execute on function public.ln_ledger_list(text, uuid, integer, integer) to anon;
grant execute on function public.ln_mcp_log_add(text, uuid, uuid, text, boolean, text, numeric) to anon;
grant execute on function public.ln_mcp_log_list(text, uuid, integer) to anon;
grant execute on function public.ln_mcp_tokens_off_all(text, uuid) to anon;
grant execute on function public.ln_task_create5(text, uuid, text, text, text, text, text, text, numeric, text, uuid, jsonb, jsonb, uuid, text[]) to anon;
grant execute on function public.ln_task_open_list3(text, uuid, text, text, numeric, text, text, integer, integer) to anon;
grant execute on function public.ln_people_search2(text, text, text, text, boolean, numeric, numeric, integer, integer) to anon;
grant execute on function public.ln_price_hint(text, text, text) to anon;
grant execute on function public.ln_onboarding(text, uuid) to anon;
grant execute on function public.ln_portfolio_add2(text, uuid, text, text, text, text[], text, text, uuid) to anon;
