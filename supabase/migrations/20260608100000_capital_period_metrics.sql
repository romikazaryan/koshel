-- Готовая динамика % за период (считается на сервере, клиент только читает).

create table if not exists public.capital_asset_period_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references public.capital_assets (id) on delete cascade,
  period_days int not null check (period_days in (7, 30, 90, 365)),
  past_rate_rub numeric(20, 8),
  past_value_rub numeric(20, 2),
  current_value_rub numeric(20, 2),
  change_rub numeric(20, 2),
  change_percent numeric(10, 2),
  computed_at timestamptz not null default now(),
  unique (asset_id, period_days)
);

comment on table public.capital_asset_period_metrics is
  'Динамика капитала за период — рассчитывается Edge Function (MOEX / CoinGecko)';

create index if not exists capital_asset_period_metrics_user_period_idx
  on public.capital_asset_period_metrics (user_id, period_days);

create index if not exists capital_asset_period_metrics_asset_idx
  on public.capital_asset_period_metrics (asset_id);

alter table public.capital_asset_period_metrics enable row level security;

drop policy if exists "capital_period_metrics_select_own" on public.capital_asset_period_metrics;
create policy "capital_period_metrics_select_own"
  on public.capital_asset_period_metrics for select to authenticated
  using (user_id = auth.uid());

grant select on table public.capital_asset_period_metrics to authenticated;
grant all on table public.capital_asset_period_metrics to service_role;
