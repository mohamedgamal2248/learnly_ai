-- Profiles with a portfolio, people search, and direct deals (request, negotiate, accept -> a task assigned to that person).

create table if not exists public.ln_profiles (
  user_id uuid primary key references public.ln_users(id) on delete cascade,
  headline text not null default '',
  bio text not null default '',
  skills text[] not null default '{}',
  uses_ai text not null default 'both' check (uses_ai in ('ai', 'manual', 'both')),
  available boolean not null default true,
  rate_from numeric(18,7),
  visible boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.ln_profiles enable row level security;

create table if not exists public.ln_portfolio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ln_users(id) on delete cascade,
  title text not null,
  description text not null default '',
  made_with text not null default 'both' check (made_with in ('ai', 'manual', 'both')),
  tags text[] not null default '{}',
  image_mime text,
  image_data text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ln_portfolio_user_idx on public.ln_portfolio(user_id, created_at desc) where active;
alter table public.ln_portfolio enable row level security;

create table if not exists public.ln_deals (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.ln_users(id) on delete cascade,
  worker_id uuid not null references public.ln_users(id) on delete cascade,
  title text not null,
  brief text not null default '',
  category text not null default '',
  delivery text not null default 'text',
  price_pi numeric(18,7) not null,
  last_offer_by uuid not null,
  status text not null default 'pending' check (status in ('pending', 'countered', 'accepted', 'declined')),
  task_id uuid,
  requester_seen_at timestamptz not null default now(),
  worker_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ln_deals_req_idx on public.ln_deals(requester_id, updated_at desc);
create index if not exists ln_deals_wrk_idx on public.ln_deals(worker_id, updated_at desc);
alter table public.ln_deals enable row level security;

create table if not exists public.ln_deal_msgs (
  id bigserial primary key,
  deal_id uuid not null references public.ln_deals(id) on delete cascade,
  sender_id uuid not null,
  body text not null default '',
  price_pi numeric(18,7),
  kind text not null default 'msg',
  created_at timestamptz not null default now()
);
create index if not exists ln_deal_msgs_idx on public.ln_deal_msgs(deal_id, id);
alter table public.ln_deal_msgs enable row level security;

alter table public.ln_tasks add column if not exists deal_id uuid;

-- ---------- profiles ----------
create or replace function public.ln_profile_save(p_secret text, p_user uuid, p_headline text, p_bio text, p_skills text[], p_uses_ai text, p_available boolean, p_rate_from numeric, p_visible boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare sk text[];
begin
  perform public.ln_check(p_secret);
  if p_uses_ai not in ('ai', 'manual', 'both') then return jsonb_build_object('ok', false, 'reason', 'bad_uses_ai'); end if;
  if p_rate_from is not null and (p_rate_from < 0.05 or p_rate_from > 1000) then return jsonb_build_object('ok', false, 'reason', 'bad_rate'); end if;
  sk := coalesce((select array_agg(x) from (select distinct left(trim(s), 30) as x from unnest(coalesce(p_skills, '{}')) s where char_length(trim(s)) >= 2 limit 10) q), '{}');
  insert into public.ln_profiles(user_id, headline, bio, skills, uses_ai, available, rate_from, visible, updated_at)
  values (p_user, left(trim(coalesce(p_headline, '')), 100), left(trim(coalesce(p_bio, '')), 800), sk, p_uses_ai, coalesce(p_available, true), p_rate_from, coalesce(p_visible, true), now())
  on conflict (user_id) do update set headline = excluded.headline, bio = excluded.bio, skills = excluded.skills, uses_ai = excluded.uses_ai,
    available = excluded.available, rate_from = excluded.rate_from, visible = excluded.visible, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_portfolio_add(p_secret text, p_user uuid, p_title text, p_desc text, p_made_with text, p_tags text[], p_mime text, p_data text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid;
begin
  perform public.ln_check(p_secret);
  if char_length(trim(coalesce(p_title, ''))) < 3 then return jsonb_build_object('ok', false, 'reason', 'bad_title'); end if;
  if p_made_with not in ('ai', 'manual', 'both') then return jsonb_build_object('ok', false, 'reason', 'bad_made_with'); end if;
  if (select count(*) from public.ln_portfolio where user_id = p_user and active) >= 12 then return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  insert into public.ln_profiles(user_id) values (p_user) on conflict (user_id) do nothing;
  insert into public.ln_portfolio(user_id, title, description, made_with, tags, image_mime, image_data)
  values (p_user, left(trim(p_title), 100), left(trim(coalesce(p_desc, '')), 600), p_made_with,
    coalesce((select array_agg(x) from (select distinct left(trim(s), 30) as x from unnest(coalesce(p_tags, '{}')) s where char_length(trim(s)) >= 2 limit 8) q), '{}'), p_mime, p_data)
  returning id into pid;
  return jsonb_build_object('ok', true, 'id', pid);
end $$;

create or replace function public.ln_portfolio_remove(p_secret text, p_user uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_portfolio set active = false, image_data = null where id = p_id and user_id = p_user;
  return jsonb_build_object('ok', found);
end $$;

create or replace function public.ln_portfolio_image(p_secret text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select jsonb_build_object('mime', image_mime, 'data', image_data) from public.ln_portfolio where id = p_id and active and image_data is not null);
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
    'stats', public.ln_worker_stats_of(u.id),
    'categories', coalesce((select jsonb_agg(c.label order by c.n desc) from (select (array_agg(category order by decided_at desc))[1] as label, count(*) as n
        from public.ln_tasks where worker_id = u.id and status = 'approved' and category <> '' group by category_key order by count(*) desc limit 6) c), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('stars', t.rating, 'note', t.rating_note, 'by', ru.username, 'category', t.category, 'at', t.decided_at) order by t.decided_at desc)
        from (select * from public.ln_tasks where worker_id = u.id and rating is not null order by decided_at desc limit 6) t join public.ln_users ru on ru.id = t.requester_id), '[]'::jsonb),
    'portfolio', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description, 'made_with', p.made_with, 'tags', p.tags,
        'has_image', p.image_data is not null, 'at', p.created_at) order by p.created_at desc)
        from public.ln_portfolio p where p.user_id = u.id and p.active), '[]'::jsonb));
end $$;

-- Searches people by words in their headline, skills, portfolio and the categories they were paid for. Best rated first.
create or replace function public.ln_people_search(p_secret text, p_query text, p_ai text, p_limit integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare words text[];
begin
  perform public.ln_check(p_secret);
  words := coalesce((select array_agg(w) from (select distinct lower(x) as w from regexp_split_to_table(trim(coalesce(p_query, '')), '\s+') x where char_length(x) >= 2 limit 6) q), '{}');
  return coalesce((select jsonb_agg(card order by (card->>'score')::int desc, coalesce((card->'stats'->>'avg')::numeric, 0) desc, (card->'stats'->>'done')::int desc) from (
    select jsonb_build_object('username', u.username, 'headline', pr.headline, 'skills', pr.skills, 'uses_ai', pr.uses_ai, 'available', pr.available, 'rate_from', pr.rate_from,
      'stats', public.ln_worker_stats_of(u.id),
      'works', coalesce((select jsonb_agg(p.title) from (select title from public.ln_portfolio where user_id = u.id and active order by created_at desc limit 3) p), '[]'::jsonb),
      'score', case when cardinality(words) = 0 then 1 else (select count(*) from unnest(words) w where position(w in s.hay) > 0) end) as card
    from public.ln_profiles pr join public.ln_users u on u.id = pr.user_id
    cross join lateral (select lower(coalesce(pr.headline, '') || ' ' || coalesce(pr.bio, '') || ' ' || array_to_string(pr.skills, ' ') || ' ' ||
        coalesce((select string_agg(title || ' ' || description || ' ' || array_to_string(tags, ' '), ' ') from public.ln_portfolio where user_id = u.id and active), '') || ' ' ||
        coalesce((select string_agg(distinct category_key, ' ') from public.ln_tasks where worker_id = u.id and status = 'approved'), '')) as hay) s
    where pr.visible and not u.banned and (coalesce(p_ai, '') = '' or pr.uses_ai in (p_ai, 'both'))
      and (cardinality(words) = 0 or exists (select 1 from unnest(words) w where position(w in s.hay) > 0))
    limit 200) z limit least(greatest(coalesce(p_limit, 20), 1), 40)), '[]'::jsonb);
end $$;

-- ---------- deals ----------
create or replace function public.ln_deal_create(p_secret text, p_user uuid, p_username text, p_title text, p_brief text, p_category text, p_delivery text, p_price numeric)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare w public.ln_users; me public.ln_users; pr public.ln_profiles; did uuid;
begin
  perform public.ln_check(p_secret);
  select * into me from public.ln_users where id = p_user;
  if me.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;
  select * into w from public.ln_users where lower(username) = lower(trim(p_username)) and not banned order by created_at limit 1;
  if w.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if w.id = p_user then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  select * into pr from public.ln_profiles where user_id = w.id;
  if pr.user_id is null or not pr.visible or not pr.available then return jsonb_build_object('ok', false, 'reason', 'not_available'); end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 then return jsonb_build_object('ok', false, 'reason', 'bad_title'); end if;
  if p_delivery not in ('text', 'pdf', 'ppt', 'image', 'file') then return jsonb_build_object('ok', false, 'reason', 'bad_delivery'); end if;
  if p_price is null or p_price < 0.05 or p_price > 50 then return jsonb_build_object('ok', false, 'reason', 'bad_price'); end if;
  if (select count(*) from public.ln_deals where requester_id = p_user and status in ('pending', 'countered')) >= 10 then return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  if exists (select 1 from public.ln_deals where requester_id = p_user and worker_id = w.id and status in ('pending', 'countered')) then return jsonb_build_object('ok', false, 'reason', 'already_open'); end if;
  insert into public.ln_deals(requester_id, worker_id, title, brief, category, delivery, price_pi, last_offer_by)
  values (p_user, w.id, left(trim(p_title), 120), left(trim(coalesce(p_brief, '')), 1000), left(trim(coalesce(p_category, '')), 40), p_delivery, p_price, p_user) returning id into did;
  insert into public.ln_deal_msgs(deal_id, sender_id, body, price_pi, kind) values (did, p_user, left(trim(coalesce(p_brief, '')), 1000), p_price, 'offer');
  return jsonb_build_object('ok', true, 'id', did);
end $$;

create or replace function public.ln_deal_msg(p_secret text, p_user uuid, p_deal uuid, p_body text, p_price numeric)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d public.ln_deals; b text;
begin
  perform public.ln_check(p_secret);
  select * into d from public.ln_deals where id = p_deal and (requester_id = p_user or worker_id = p_user) and status in ('pending', 'countered') for update;
  if d.id is null then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  b := left(trim(coalesce(p_body, '')), 1000);
  if b = '' and p_price is null then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  if p_price is not null and (p_price < 0.05 or p_price > 50) then return jsonb_build_object('ok', false, 'reason', 'bad_price'); end if;
  if (select count(*) from public.ln_deal_msgs where deal_id = d.id) >= 60 then return jsonb_build_object('ok', false, 'reason', 'too_long'); end if;
  insert into public.ln_deal_msgs(deal_id, sender_id, body, price_pi, kind) values (d.id, p_user, b, p_price, case when p_price is null then 'msg' else 'offer' end);
  update public.ln_deals set updated_at = now(),
    price_pi = coalesce(p_price, price_pi), last_offer_by = case when p_price is null then last_offer_by else p_user end,
    status = case when p_price is null then status else 'countered' end,
    requester_seen_at = case when requester_id = p_user then now() else requester_seen_at end,
    worker_seen_at = case when worker_id = p_user then now() else worker_seen_at end
   where id = d.id;
  return jsonb_build_object('ok', true);
end $$;

-- Accepting the other side's latest price creates the task for that person and holds the reward from the requester.
create or replace function public.ln_deal_accept(p_secret text, p_user uuid, p_deal uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d public.ln_deals; u public.ln_users; tk public.ln_mcp_tokens; tid uuid; cap numeric; spent numeric; k text;
begin
  perform public.ln_check(p_secret);
  select * into d from public.ln_deals where id = p_deal and (requester_id = p_user or worker_id = p_user) and status in ('pending', 'countered') for update;
  if d.id is null then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  if d.last_offer_by = p_user then return jsonb_build_object('ok', false, 'reason', 'own_offer'); end if;
  select * into u from public.ln_users where id = d.requester_id for update;
  if u.banned then return jsonb_build_object('ok', false, 'reason', 'banned'); end if;
  if u.pi_balance < d.price_pi then return jsonb_build_object('ok', false, 'reason', 'requester_not_enough', 'balance', u.pi_balance, 'mine', d.requester_id = p_user); end if;
  if (select count(*) from public.ln_tasks where requester_id = d.requester_id and status in ('open','claimed','submitted')) >= 20 then return jsonb_build_object('ok', false, 'reason', 'too_many'); end if;
  if p_token is not null and d.requester_id = p_user then
    select * into tk from public.ln_mcp_tokens where id = p_token and user_id = p_user and not revoked;
    if tk.id is null then return jsonb_build_object('ok', false, 'reason', 'bad_key'); end if;
    cap := coalesce(tk.post_daily_pi, (select (value->>'mcp_post_daily_pi')::numeric from public.ln_config where key = 'limits'), 5);
    select coalesce(sum(reward_pi), 0) into spent from public.ln_tasks where token_id = tk.id and created_at > now() - interval '24 hours';
    if spent + d.price_pi > cap then return jsonb_build_object('ok', false, 'reason', 'mcp_cap', 'cap', cap, 'spent', spent); end if;
  end if;
  k := case d.delivery when 'pdf' then 'pdf' when 'ppt' then 'ppt' else 'summary' end;
  update public.ln_users set pi_balance = pi_balance - d.price_pi where id = d.requester_id;
  insert into public.ln_tasks(requester_id, worker_id, status, claimed_at, kind, category, category_key, delivery, source, title, brief, input_text, lang, reward_pi, token_id, deal_id)
  values (d.requester_id, d.worker_id, 'claimed', now(), k, coalesce(nullif(d.category, ''), 'Direct request'), lower(coalesce(nullif(d.category, ''), 'Direct request')), d.delivery, 'deal',
    d.title, d.brief, '', 'ar', d.price_pi, case when d.requester_id = p_user then p_token else null end, d.id) returning id into tid;
  insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (d.requester_id, -d.price_pi, 'task_hold', tid::text);
  update public.ln_deals set status = 'accepted', task_id = tid, updated_at = now() where id = d.id;
  insert into public.ln_deal_msgs(deal_id, sender_id, body, price_pi, kind) values (d.id, p_user, '', d.price_pi, 'accepted');
  return jsonb_build_object('ok', true, 'task_id', tid, 'price', d.price_pi);
end $$;

create or replace function public.ln_deal_decline(p_secret text, p_user uuid, p_deal uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d public.ln_deals;
begin
  perform public.ln_check(p_secret);
  update public.ln_deals set status = 'declined', updated_at = now() where id = p_deal and (requester_id = p_user or worker_id = p_user) and status in ('pending', 'countered') returning * into d;
  if d.id is null then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  insert into public.ln_deal_msgs(deal_id, sender_id, body, kind) values (d.id, p_user, '', 'declined');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_deals_list(p_secret text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'price', d.price_pi, 'status', d.status, 'task_id', d.task_id,
      'role', case when d.requester_id = p_user then 'requester' else 'worker' end,
      'other', o.username, 'updated_at', d.updated_at,
      'turn', d.status in ('pending', 'countered') and d.last_offer_by is distinct from p_user,
      'last', (select left(m.body, 120) from public.ln_deal_msgs m where m.deal_id = d.id and m.body <> '' order by m.id desc limit 1),
      'unread', exists (select 1 from public.ln_deal_msgs m where m.deal_id = d.id and m.sender_id <> p_user and m.created_at > coalesce(case when d.requester_id = p_user then d.requester_seen_at else d.worker_seen_at end, '-infinity')))
      order by d.updated_at desc)
    from (select * from public.ln_deals where requester_id = p_user or worker_id = p_user order by updated_at desc limit 50) d
      join public.ln_users o on o.id = case when d.requester_id = p_user then d.worker_id else d.requester_id end), '[]'::jsonb);
end $$;

create or replace function public.ln_deal_get(p_secret text, p_user uuid, p_deal uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d public.ln_deals; o public.ln_users;
begin
  perform public.ln_check(p_secret);
  select * into d from public.ln_deals where id = p_deal and (requester_id = p_user or worker_id = p_user);
  if d.id is null then return null; end if;
  select * into o from public.ln_users where id = case when d.requester_id = p_user then d.worker_id else d.requester_id end;
  update public.ln_deals set requester_seen_at = case when requester_id = p_user then now() else requester_seen_at end,
    worker_seen_at = case when worker_id = p_user then now() else worker_seen_at end where id = d.id;
  return jsonb_build_object('id', d.id, 'title', d.title, 'brief', d.brief, 'category', d.category, 'delivery', d.delivery, 'price', d.price_pi, 'status', d.status,
    'role', case when d.requester_id = p_user then 'requester' else 'worker' end, 'other', o.username, 'task_id', d.task_id,
    'turn', d.status in ('pending', 'countered') and d.last_offer_by is distinct from p_user,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'mine', m.sender_id = p_user, 'body', m.body, 'price', m.price_pi, 'kind', m.kind, 'at', m.created_at) order by m.id)
       from public.ln_deal_msgs m where m.deal_id = d.id), '[]'::jsonb));
end $$;

create or replace function public.ln_deals_unread(p_secret text, p_user uuid)
returns integer language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select count(*) from public.ln_deals d where (d.requester_id = p_user or d.worker_id = p_user) and exists (
    select 1 from public.ln_deal_msgs m where m.deal_id = d.id and m.sender_id <> p_user
      and m.created_at > coalesce(case when d.requester_id = p_user then d.requester_seen_at else d.worker_seen_at end, '-infinity')));
end $$;

-- Direct-deal tasks are never put on the public board: an expired one is cancelled and refunded.
create or replace function public.ln_task_sweep(p_secret text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  perform public.ln_check(p_secret);
  update public.ln_tasks set status = 'open', worker_id = null, claimed_at = null, revision_note = null, result = null
   where status = 'claimed' and deal_id is null and claimed_at < now() - case when revisions > 0 then interval '12 hours' else interval '2 hours' end;
  for r in select id, requester_id, reward_pi from public.ln_tasks
    where status = 'claimed' and deal_id is not null and claimed_at < now() - case when revisions > 0 then interval '3 days' else interval '7 days' end loop
    update public.ln_tasks set status = 'cancelled', decided_at = now() where id = r.id;
    update public.ln_users set pi_balance = pi_balance + r.reward_pi where id = r.requester_id;
    insert into public.ln_pi_ledger(user_id, delta, kind, ref) values (r.requester_id, r.reward_pi, 'task_refund', r.id::text);
  end loop;
  for r in select id from public.ln_tasks where status = 'submitted' and submitted_at < now() - interval '48 hours' loop
    perform public.ln_task_pay(p_secret, r.id);
  end loop;
end $$;

grant execute on function public.ln_profile_save(text, uuid, text, text, text[], text, boolean, numeric, boolean) to anon;
grant execute on function public.ln_portfolio_add(text, uuid, text, text, text, text[], text, text) to anon;
grant execute on function public.ln_portfolio_remove(text, uuid, uuid) to anon;
grant execute on function public.ln_portfolio_image(text, uuid) to anon;
grant execute on function public.ln_profile_get(text, uuid, text) to anon;
grant execute on function public.ln_people_search(text, text, text, integer) to anon;
grant execute on function public.ln_deal_create(text, uuid, text, text, text, text, text, numeric) to anon;
grant execute on function public.ln_deal_msg(text, uuid, uuid, text, numeric) to anon;
grant execute on function public.ln_deal_accept(text, uuid, uuid, uuid) to anon;
grant execute on function public.ln_deal_decline(text, uuid, uuid) to anon;
grant execute on function public.ln_deals_list(text, uuid) to anon;
grant execute on function public.ln_deal_get(text, uuid, uuid) to anon;
grant execute on function public.ln_deals_unread(text, uuid) to anon;
