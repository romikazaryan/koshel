-- История оценок рыночных активов (для сравнения «неделю назад → сейчас»)

create table if not exists public.capital_valuation_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.capital_assets (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  rate_rub numeric(18, 6) not null,
  value_rub numeric(14, 2) not null,
  quantity numeric(20, 8) not null,
  recorded_at timestamptz not null default now()
);

comment on table public.capital_valuation_snapshots is 'Снимки рыночной оценки активов';

create index if not exists capital_valuation_snapshots_asset_recorded_idx
  on public.capital_valuation_snapshots (asset_id, recorded_at desc);

create or replace function public.handle_capital_snapshot_user_id()
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

drop trigger if exists capital_valuation_snapshots_set_user_id on public.capital_valuation_snapshots;
create trigger capital_valuation_snapshots_set_user_id
  before insert on public.capital_valuation_snapshots
  for each row
  execute function public.handle_capital_snapshot_user_id();

alter table public.capital_valuation_snapshots enable row level security;

drop policy if exists "capital_valuation_snapshots_select_own" on public.capital_valuation_snapshots;
drop policy if exists "capital_valuation_snapshots_insert_own" on public.capital_valuation_snapshots;
drop policy if exists "capital_valuation_snapshots_delete_own" on public.capital_valuation_snapshots;

create policy "capital_valuation_snapshots_select_own"
  on public.capital_valuation_snapshots for select to authenticated
  using (auth.uid() = user_id);

create policy "capital_valuation_snapshots_insert_own"
  on public.capital_valuation_snapshots for insert to authenticated
  with check (auth.uid() = user_id);

create policy "capital_valuation_snapshots_delete_own"
  on public.capital_valuation_snapshots for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on table public.capital_valuation_snapshots to authenticated;
