-- Cached AI translations of the interface (keys i18n_<lang> only).
create or replace function public.ln_kv_get(p_secret text, p_key text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if p_key not like 'i18n\_%' then return null; end if;
  return (select value from public.ln_config where key = p_key);
end $$;

create or replace function public.ln_kv_set(p_secret text, p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ln_check(p_secret);
  if p_key not like 'i18n\_%' then raise exception 'key not allowed'; end if;
  insert into public.ln_config(key, value) values (p_key, p_value)
    on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
grant execute on function public.ln_kv_get(text, text) to anon;
grant execute on function public.ln_kv_set(text, text, jsonb) to anon;
