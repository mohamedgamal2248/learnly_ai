-- Learnly v4: explanation language per bot, Pi Browser–friendly downloads, richer community.
-- Additive only, safe to run more than once.

-- Teacher picks the default explanation language; students can override it per chat.
alter table public.ln_bots add column if not exists reply_lang text not null default 'auto';
do $$ begin
  alter table public.ln_bots add constraint ln_bots_reply_lang_chk check (reply_lang in ('auto','ar','en'));
exception when duplicate_object then null; end $$;

-- One pending download per user. Pi Browser's download manager re-requests the file URL on its own
-- (no cookies, no POST body), so the spec is parked here for a signed GET link.
create table if not exists public.ln_downloads (
  user_id uuid primary key references public.ln_users(id) on delete cascade,
  file_id uuid not null,
  spec jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ln_downloads enable row level security;

-- "Helpful" reactions on posts.
alter table public.ln_posts add column if not exists likes integer not null default 0;
create table if not exists public.ln_post_likes (
  post_id bigint not null references public.ln_posts(id) on delete cascade,
  user_id uuid not null references public.ln_users(id) on delete cascade,
  active boolean not null default true,
  primary key (post_id, user_id)
);
alter table public.ln_post_likes enable row level security;

create or replace function public.ln_list_bots(p_secret text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'name_en', name_en, 'subject', subject,
    'subject_en', subject_en, 'track', track, 'description', description, 'description_en', description_en,
    'fee', fee, 'official', official, 'teacher_name', teacher_name, 'has_knowledge', knowledge <> '', 'reply_lang', reply_lang)
    order by official desc, updated_at desc)
    from public.ln_bots where status = 'live'), '[]'::jsonb);
end $$;

create or replace function public.ln_save_bot2(p_secret text, p_user uuid, p_bot jsonb, p_files jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.ln_users; app_name text; bid uuid; keep uuid[]; f jsonb; k text; rl text;
begin
  perform public.ln_check(p_secret);
  select * into u from public.ln_users where id = p_user;
  if u.role not in ('teacher','admin') then raise exception 'not a teacher'; end if;
  select display_name into app_name from public.ln_teacher_apps where user_id = p_user and status = 'approved' order by decided_at desc limit 1;
  rl := case when p_bot->>'reply_lang' in ('ar','en') then p_bot->>'reply_lang' else 'auto' end;

  if (p_bot->>'id') is null then
    if (select count(*) from public.ln_bots where teacher_id = p_user) >= 10 then raise exception 'too many bots'; end if;
    insert into public.ln_bots(teacher_id, teacher_name, name, name_en, subject, subject_en, track, description, description_en,
      instructions, notes, fee, reply_lang, status)
    values (p_user, coalesce(app_name, u.username), left(p_bot->>'name', 80), left(coalesce(p_bot->>'name_en',''), 80),
      left(p_bot->>'subject', 80), left(coalesce(p_bot->>'subject_en',''), 80), coalesce(p_bot->>'track', 'school'),
      left(coalesce(p_bot->>'description',''), 400), left(coalesce(p_bot->>'description_en',''), 400),
      left(coalesce(p_bot->>'instructions',''), 4000), left(coalesce(p_bot->>'notes',''), 100000),
      least(greatest(coalesce((p_bot->>'fee')::int, 0), 0), 20), rl, 'review')
    returning id into bid;
  else
    update public.ln_bots set name = left(p_bot->>'name', 80), name_en = left(coalesce(p_bot->>'name_en',''), 80),
      subject = left(p_bot->>'subject', 80), subject_en = left(coalesce(p_bot->>'subject_en',''), 80),
      track = coalesce(p_bot->>'track', track),
      description = left(coalesce(p_bot->>'description',''), 400), description_en = left(coalesce(p_bot->>'description_en',''), 400),
      instructions = left(coalesce(p_bot->>'instructions',''), 4000), notes = left(coalesce(p_bot->>'notes',''), 100000),
      fee = least(greatest(coalesce((p_bot->>'fee')::int, 0), 0), 20), reply_lang = rl, status = 'review', updated_at = now()
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

  select left(concat_ws(E'\n\n', nullif(b.notes, ''), (
      select string_agg('### ' || x.name || E'\n' || x.body, E'\n\n' order by x.created_at)
      from public.ln_bot_files x where x.bot_id = bid and x.active)), 300000)
  into k from public.ln_bots b where b.id = bid;
  update public.ln_bots set knowledge = coalesce(k, '') where id = bid;
  return jsonb_build_object('id', bid, 'status', 'review');
end $$;

-- ---------- downloads ----------
create or replace function public.ln_dl_put(p_secret text, p_user uuid, p_file uuid, p_spec jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  insert into public.ln_downloads(user_id, file_id, spec, created_at) values (p_user, p_file, p_spec, now())
  on conflict (user_id) do update set file_id = excluded.file_id, spec = excluded.spec, created_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ln_dl_get(p_secret text, p_user uuid, p_file uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  return (select spec from public.ln_downloads where user_id = p_user and file_id = p_file and created_at > now() - interval '30 minutes');
end $$;

-- ---------- community ----------
create or replace function public.ln_posts_list2(p_secret text, p_user uuid, p_group text, p_parent bigint, p_before bigint, p_sort text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if p_parent is not null then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
      select p.id, p.username, p.body, p.created_at, p.likes, u.role, (p.user_id = p_user) as mine,
        exists (select 1 from public.ln_post_likes l where l.post_id = p.id and l.user_id = p_user and l.active) as liked
      from public.ln_posts p join public.ln_users u on u.id = p.user_id
      where p.parent_id = p_parent and not p.hidden order by p.id limit 100) x), '[]'::jsonb);
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select p.id, p.username, p.group_key, p.body, p.replies, p.likes, p.created_at, u.role, (p.user_id = p_user) as mine,
      exists (select 1 from public.ln_post_likes l where l.post_id = p.id and l.user_id = p_user and l.active) as liked
    from public.ln_posts p join public.ln_users u on u.id = p.user_id
    where p.parent_id is null and not p.hidden and (p_group is null or p.group_key = p_group)
      and (p_before is null or p.id < p_before)
    order by case when p_sort = 'top' then p.likes + p.replies else 0 end desc, p.id desc
    limit 20) x), '[]'::jsonb);
end $$;

create or replace function public.ln_post_like(p_secret text, p_user uuid, p_post bigint)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare now_active boolean;
begin
  perform public.ln_check(p_secret);
  insert into public.ln_post_likes(post_id, user_id, active) values (p_post, p_user, true)
  on conflict (post_id, user_id) do update set active = not ln_post_likes.active
  returning active into now_active;
  update public.ln_posts set likes = greatest(0, likes + case when now_active then 1 else -1 end) where id = p_post;
  return jsonb_build_object('liked', now_active, 'likes', (select likes from public.ln_posts where id = p_post));
end $$;

-- Authors can take their own post down (hidden, not erased, so reports stay auditable).
create or replace function public.ln_post_hide_own(p_secret text, p_user uuid, p_post bigint)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare parent bigint; ok boolean;
begin
  perform public.ln_check(p_secret);
  update public.ln_posts set hidden = true where id = p_post and user_id = p_user and not hidden returning parent_id into parent;
  ok := found;
  if ok and parent is not null then
    update public.ln_posts set replies = greatest(0, replies - 1) where id = parent;
  end if;
  return jsonb_build_object('ok', ok);
end $$;
