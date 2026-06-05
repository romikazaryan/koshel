-- Капитал: вклады, крипта, недвижимость и другие активы

create table if not exists public.capital_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(14, 2) not null check (amount > 0),
  asset_type text not null default 'other'
    check (asset_type in ('deposit', 'crypto', 'real_estate', 'stocks', 'cash', 'other')),
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.capital_assets is 'Активы пользователя (капитал), не смешиваются с ежемесячными расходами';
comment on column public.capital_assets.amount is 'Текущая оценка стоимости в рублях';
comment on column public.capital_assets.asset_type is 'deposit | crypto | real_estate | stocks | cash | other';

create index if not exists capital_assets_user_active_idx
  on public.capital_assets (user_id, is_active);

create or replace function public.handle_capital_asset_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  elsif new.user_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;
  return new;
end;
$$;

create or replace function public.touch_capital_asset_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists capital_assets_set_user_id on public.capital_assets;
create trigger capital_assets_set_user_id
  before insert or update on public.capital_assets
  for each row
  execute function public.handle_capital_asset_user_id();

drop trigger if exists capital_assets_touch_updated_at on public.capital_assets;
create trigger capital_assets_touch_updated_at
  before update on public.capital_assets
  for each row
  execute function public.touch_capital_asset_updated_at();

alter table public.capital_assets enable row level security;

drop policy if exists "capital_assets_select_own" on public.capital_assets;
drop policy if exists "capital_assets_insert_own" on public.capital_assets;
drop policy if exists "capital_assets_update_own" on public.capital_assets;
drop policy if exists "capital_assets_delete_own" on public.capital_assets;

create policy "capital_assets_select_own"
  on public.capital_assets for select to authenticated
  using (auth.uid() = user_id);

create policy "capital_assets_insert_own"
  on public.capital_assets for insert to authenticated
  with check (auth.uid() = user_id);

create policy "capital_assets_update_own"
  on public.capital_assets for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "capital_assets_delete_own"
  on public.capital_assets for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.capital_assets to authenticated;
