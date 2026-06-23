-- Облигации из брокерского импорта
alter table public.capital_assets drop constraint if exists capital_assets_asset_type_check;

alter table public.capital_assets add constraint capital_assets_asset_type_check
  check (asset_type in ('deposit', 'crypto', 'real_estate', 'stocks', 'cash', 'bonds', 'other'));

comment on column public.capital_assets.asset_type is
  'deposit | crypto | real_estate | stocks | cash | bonds | other';
