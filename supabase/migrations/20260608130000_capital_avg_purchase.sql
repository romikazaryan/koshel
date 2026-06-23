-- Средняя цена покупки с брокера (T-Invest averagePositionPrice), ₽ за 1 шт.
alter table public.capital_assets
  add column if not exists avg_purchase_rate_rub numeric(18, 6);

comment on column public.capital_assets.avg_purchase_rate_rub is
  'Средняя цена покупки с брокера, ₽ за единицу';
