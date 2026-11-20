-- Learnly v2: bilingual bots, teacher materials as separate rows, saved conversations.
-- Additive only (no deletes), safe to run more than once.

alter table public.ln_bots add column if not exists name_en text not null default '';
alter table public.ln_bots add column if not exists subject_en text not null default '';
alter table public.ln_bots add column if not exists description_en text not null default '';
alter table public.ln_bots add column if not exists notes text not null default '';

update public.ln_bots set name_en = 'Learnly Tutor', subject_en = 'All subjects',
  description_en = 'A general tutor that helps you study any subject and makes summaries and PDF, Word, PowerPoint and Excel files.'
where official and name_en = '';

-- Teacher materials (handouts, slides, books) as extracted text, one row per uploaded file.
create table if not exists public.ln_bot_files (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.ln_bots(id) on delete cascade,
  name text not null,
  body text not null,
  chars integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ln_bot_files_bot_idx on public.ln_bot_files(bot_id, active, created_at);
alter table public.ln_bot_files enable row level security;

-- Conversations between a student and a bot.
create table if not exists public.ln_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ln_users(id) on delete cascade,
  bot_id uuid not null references public.ln_bots(id) on delete cascade,
  title text not null default '',
  msgs integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ln_chats_user_bot_idx on public.ln_chats(user_id, bot_id, updated_at desc);
alter table public.ln_chats enable row level security;

create table if not exists public.ln_messages (
  id bigserial primary key,
  chat_id uuid not null references public.ln_chats(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  files jsonb,
  credits integer,
  created_at timestamptz not null default now()
);
create index if not exists ln_messages_chat_idx on public.ln_messages(chat_id, id);
alter table public.ln_messages enable row level security;

create or replace function public.ln_list_bots(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'name_en', name_en, 'subject', subject,
    'subject_en', subject_en, 'track', track, 'description', description, 'description_en', description_en,
    'fee', fee, 'official', official, 'teacher_name', teacher_name, 'has_knowledge', knowledge <> '')
    order by official desc, updated_at desc)
    from public.ln_bots where status = 'live'), '[]'::jsonb);
end $$;

-- Everything a teacher needs to edit a bot, without the (large) assembled knowledge.
create or replace function public.ln_bot_detail(p_secret text, p_user uuid, p_bot uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare b public.ln_bots; r text;
begin
  perform public.ln_check(p_secret);
  select * into b from public.ln_bots where id = p_bot;
  if not found then return null; end if;
  select role into r from public.ln_users where id = p_user;
  if b.teacher_id is distinct from p_user and r <> 'admin' then return null; end if;
  return (to_jsonb(b) - 'knowledge') || jsonb_build_object('files', coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'chars', f.chars) order by f.created_at)
    from public.ln_bot_files f where f.bot_id = b.id and f.active), '[]'::jsonb));
end $$;

-- Save a bot with both languages and its materials. p_files: [{id} to keep, {name, body} to add].
create or replace function public.ln_save_bot2(p_secret text, p_user uuid, p_bot jsonb, p_files jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; app_name text; bid uuid; keep uuid[]; f jsonb; k text;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  if u.role not in ('teacher','admin') then raise exception 'not a teacher'; end if;
  select display_name into app_name from public.ln_teacher_apps where user_id = p_user and status = 'approved' order by decided_at desc limit 1;

  if (p_bot->>'id') is null then
    if (select count(*) from public.ln_bots where teacher_id = p_user) >= 10 then raise exception 'too many bots'; end if;
    insert into public.ln_bots(teacher_id, teacher_name, name, name_en, subject, subject_en, track, description, description_en,
      instructions, notes, fee, status)
    values (p_user, coalesce(app_name, u.username), left(p_bot->>'name', 80), left(coalesce(p_bot->>'name_en',''), 80),
      left(p_bot->>'subject', 80), left(coalesce(p_bot->>'subject_en',''), 80), coalesce(p_bot->>'track', 'school'),
      left(coalesce(p_bot->>'description',''), 400), left(coalesce(p_bot->>'description_en',''), 400),
      left(coalesce(p_bot->>'instructions',''), 4000), left(coalesce(p_bot->>'notes',''), 100000),
      least(greatest(coalesce((p_bot->>'fee')::int, 0), 0), 20), 'review')
    returning id into bid;
  else
    update public.ln_bots set name = left(p_bot->>'name', 80), name_en = left(coalesce(p_bot->>'name_en',''), 80),
      subject = left(p_bot->>'subject', 80), subject_en = left(coalesce(p_bot->>'subject_en',''), 80),
      track = coalesce(p_bot->>'track', track),
      description = left(coalesce(p_bot->>'description',''), 400), description_en = left(coalesce(p_bot->>'description_en',''), 400),
      instructions = left(coalesce(p_bot->>'instructions',''), 4000), notes = left(coalesce(p_bot->>'notes',''), 100000),
      fee = least(greatest(coalesce((p_bot->>'fee')::int, 0), 0), 20), status = 'review', updated_at = now()
    where id = (p_bot->>'id')::uuid and teacher_id = p_user returning id into bid;
    if bid is null then raise exception 'not your bot'; end if;
  end if;

  select coalesce(array_agg((x->>'id')::uuid), '{}') into keep
  from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) x where x ? 'id';
  update public.ln_bot_files set active = false where bot_id = bid and active and not (id = any(keep));
  for f in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    if not (f ? 'id') and coalesce(f->>'body','') <> '' then
      insert into public.ln_bot_files(bot_id, name, body, chars)
      values (bid, left(coalesce(f->>'name','file'), 160), left(f->>'body', 300000), char_length(left(f->>'body', 300000)));
    end if;
  end loop;

  -- The bot answers from notes + active files, capped at 300K characters.
  select left(concat_ws(E'\n\n', nullif(b.notes, ''), (
      select string_agg('### ' || x.name || E'\n' || x.body, E'\n\n' order by x.created_at)
      from public.ln_bot_files x where x.bot_id = bid and x.active)), 300000)
  into k from public.ln_bots b where b.id = bid;
  update public.ln_bots set knowledge = coalesce(k, '') where id = bid;
  return jsonb_build_object('id', bid, 'status', 'review');
end $$;

-- ---------- conversations ----------
create or replace function public.ln_chats_list(p_secret text, p_user uuid, p_bot uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'msgs', c.msgs, 'updated_at', c.updated_at)
    order by c.updated_at desc) from (select * from public.ln_chats where user_id = p_user and bot_id = p_bot
    order by updated_at desc limit 30) c), '[]'::jsonb);
end $$;

create or replace function public.ln_chat_history(p_secret text, p_user uuid, p_chat uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if not exists (select 1 from public.ln_chats where id = p_chat and user_id = p_user) then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'files', m.files, 'credits', m.credits)
    order by m.id) from (select * from public.ln_messages where chat_id = p_chat order by id desc limit 60) m), '[]'::jsonb);
end $$;

-- Settle the credit reservation and store both sides of the exchange in one call.
create or replace function public.ln_chat_finish(p_secret text, p_user uuid, p_bot uuid, p_chat uuid,
  p_user_msg text, p_reply text, p_files jsonb, p_reserved integer, p_actual integer, p_cost_usd numeric,
  p_teacher_share integer, p_meta jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare actual integer; u public.ln_users; t uuid; cid uuid;
begin
  perform public.ln_check(p_secret);
  actual := least(greatest(p_actual, 0), p_reserved);
  update public.ln_users set credits = credits + (p_reserved - actual) where id = p_user returning * into u;
  if actual > 0 then
    insert into public.ln_ledger(user_id, delta, kind, ref, meta) values (p_user, -actual, 'ai', p_bot::text, p_meta);
  end if;
  if p_teacher_share > 0 and p_bot is not null then
    select teacher_id into t from public.ln_bots where id = p_bot;
    if t is not null and t <> p_user then
      update public.ln_users set earned = earned + p_teacher_share where id = t;
      insert into public.ln_ledger(user_id, delta, kind, ref) values (t, p_teacher_share, 'teacher_fee', p_bot::text);
    end if;
  end if;
  insert into public.ln_usage_daily(day, cost_usd, credits, msgs) values (current_date, p_cost_usd, actual, 1)
  on conflict (day) do update set cost_usd = ln_usage_daily.cost_usd + excluded.cost_usd,
    credits = ln_usage_daily.credits + excluded.credits, msgs = ln_usage_daily.msgs + 1;

  if p_user_msg is not null and (coalesce(p_reply, '') <> '' or p_files is not null) then
    select id into cid from public.ln_chats where id = p_chat and user_id = p_user and bot_id = p_bot;
    if cid is null then
      insert into public.ln_chats(user_id, bot_id, title) values (p_user, p_bot, left(p_user_msg, 60)) returning id into cid;
    end if;
    insert into public.ln_messages(chat_id, role, content) values (cid, 'user', left(p_user_msg, 4000));
    insert into public.ln_messages(chat_id, role, content, files, credits) values (cid, 'assistant', left(coalesce(p_reply, ''), 20000), p_files, actual);
    update public.ln_chats set msgs = msgs + 2, updated_at = now() where id = cid;
  end if;
  return jsonb_build_object('credits', u.credits, 'charged', actual, 'chat_id', cid);
end $$;
