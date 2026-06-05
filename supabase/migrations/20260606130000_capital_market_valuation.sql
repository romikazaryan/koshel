-- Живая оценка: крипта и валюта (quantity + unit)

alter table public.capital_assets
  add column if not exists valuation_mode text not null default 'manual'
    check (valuation_mode in ('manual', 'market')),
  add column if not exists quantity numeric(20, 8),
  add column if not exists unit text,
  add column if not exists market_rate_rub numeric(18, 6),
  add column if not exists market_value_rub numeric(14, 2),
  add column if not exists market_fetched_at timestamptz;

comment on column public.capital_assets.valuation_mode is 'manual — сумма в amount; market — quantity × курс';
comment on column public.capital_assets.quantity is 'Количество единиц (0.5 BTC, 1000 USD)';
comment on column public.capital_assets.unit is 'Код единицы: btc, eth, usd, eur…';
comment on column public.capital_assets.market_rate_rub is 'Последний курс: ₽ за 1 единицу';
comment on column public.capital_assets.market_value_rub is 'Последняя оценка в ₽';

alter table public.capital_assets
  drop constraint if exists capital_assets_market_fields_check;

alter table public.capital_assets
  add constraint capital_assets_market_fields_check
  check (
    valuation_mode = 'manual'
    or (quantity is not null and quantity > 0 and unit is not null and length(trim(unit)) > 0)
  );
