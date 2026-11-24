-- One row per call to the AI model: tokens in/out and the cost at the model's price, so the admin can see profit per plan.
create table if not exists public.ln_ai_log (
  id bigserial primary key,
  user_id uuid,
  kind text not null,
  model text not null default '',
  input_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12,6) not null default 0,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ln_ai_log_created_idx on public.ln_ai_log(created_at desc);
alter table public.ln_ai_log enable row level security;

create or replace function public.ln_ai_log_add(p_secret text, p_user uuid, p_kind text, p_model text, p_in integer, p_cached integer, p_out integer, p_cost numeric, p_ok boolean) returns void
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  perform public.ln_check(p_secret);
  insert into public.ln_ai_log(user_id, kind, model, input_tokens, cached_tokens, output_tokens, cost_usd, ok)
  values (p_user, left(p_kind, 20), left(p_model, 40), greatest(p_in, 0), greatest(p_cached, 0), greatest(p_out, 0), greatest(p_cost, 0), p_ok);
end $$;

create or replace function public.ln_en_admin_ai(p_secret text, p_days integer) returns jsonb
language plpgsql security definer set search_path to 'public','extensions' as $$
declare since timestamptz := now() - make_interval(days => least(greatest(p_days, 1), 365));
begin
  perform public.ln_check(p_secret);
  return jsonb_build_object(
    'by_kind', coalesce((select jsonb_agg(x) from (
      select kind, count(*) filter (where ok) as n, count(*) filter (where not ok) as failed,
        round(avg(input_tokens) filter (where ok))::int as avg_in, round(avg(cached_tokens) filter (where ok))::int as avg_cached,
        round(avg(output_tokens) filter (where ok))::int as avg_out,
        coalesce(avg(cost_usd) filter (where ok), 0) as avg_cost, coalesce(max(cost_usd), 0) as max_cost,
        coalesce(sum(cost_usd), 0) as total_cost
      from public.ln_ai_log where created_at >= since group by kind order by kind) x), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(r) from (
      select l.created_at, l.kind, l.model, l.input_tokens, l.cached_tokens, l.output_tokens, l.cost_usd, l.ok, u.username
      from public.ln_ai_log l left join public.ln_users u on u.id = l.user_id order by l.id desc limit 60) r), '[]'::jsonb),
    'total_cost', coalesce((select sum(cost_usd) from public.ln_ai_log where created_at >= since), 0),
    'calls', (select count(*) from public.ln_ai_log where created_at >= since)
  );
end $$;
grant execute on function public.ln_ai_log_add(text, uuid, text, text, integer, integer, integer, numeric, boolean) to anon;
grant execute on function public.ln_en_admin_ai(text, integer) to anon;
