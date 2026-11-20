-- Phase 4: conversation compaction. Older turns are folded into a short summary so long chats stay cheap.
alter table public.ln_chats add column if not exists summary text not null default '';
alter table public.ln_chats add column if not exists summary_upto bigint not null default 0;

-- What the model needs: the running summary plus the messages after it (newest 40).
create or replace function public.ln_chat_context(p_secret text, p_user uuid, p_chat uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare c public.ln_chats;
begin
  perform public.ln_check(p_secret);
  select * into c from public.ln_chats where id = p_chat and user_id = p_user;
  if c.id is null then return null; end if;
  return jsonb_build_object('summary', c.summary, 'upto', c.summary_upto,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'role', m.role, 'content', m.content, 'files', m.files) order by m.id)
      from (select * from public.ln_messages where chat_id = p_chat and id > c.summary_upto order by id desc limit 40) m), '[]'::jsonb));
end $$;

create or replace function public.ln_chat_set_summary(p_secret text, p_user uuid, p_chat uuid, p_summary text, p_upto bigint)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  update public.ln_chats set summary = left(coalesce(p_summary, ''), 6000), summary_upto = greatest(summary_upto, p_upto)
   where id = p_chat and user_id = p_user;
end $$;

grant execute on function public.ln_chat_context(text, uuid, uuid) to anon;
grant execute on function public.ln_chat_set_summary(text, uuid, uuid, text, bigint) to anon;
