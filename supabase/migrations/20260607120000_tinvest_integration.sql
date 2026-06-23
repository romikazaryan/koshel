-- T-Invest: source broker, связь capital_assets с подключением

alter table public.transactions
  drop constraint if exists transactions_source_check;

alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual', 'voice', 'receipt', 'bank', 'broker'));

comment on column public.transactions.source is
  'manual | voice | receipt | bank | broker (T-Invest и др.)';

create or replace function public.guard_transaction_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source in ('bank', 'broker')
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'synced transactions can only be created by sync service';
  end if;
  return new;
end;
$$;

alter table public.capital_assets
  add column if not exists financial_connection_id uuid
    references public.financial_connections (id) on delete set null;

alter table public.capital_assets
  add column if not exists external_position_id text;

comment on column public.capital_assets.external_position_id is
  'ID позиции у брокера (accountId:figi) для дедупликации при синке';

create unique index if not exists capital_assets_broker_position_uidx
  on public.capital_assets (user_id, financial_connection_id, external_position_id)
  where external_position_id is not null and financial_connection_id is not null;

-- Синхронизированные активы брокера — только сервер
create or replace function public.guard_capital_asset_broker_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.external_position_id is not null
     and new.financial_connection_id is not null
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'broker-synced capital assets can only be modified by sync service';
  end if;
  return new;
end;
$$;

drop trigger if exists capital_assets_guard_broker_sync on public.capital_assets;
create trigger capital_assets_guard_broker_sync
  before insert or update on public.capital_assets
  for each row
  execute function public.guard_capital_asset_broker_sync();
