-- Подключения к банкам / брокерам / крипто (Open Finance, этап 1).
-- Токены доступа — только через service role (Edge Functions), не из клиента.

create table if not exists public.financial_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_kind text not null check (provider_kind in ('bank', 'broker', 'crypto')),
  provider_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'error', 'revoked', 'expired')),
  display_name text,
  external_connection_id text,
  last_sync_at timestamptz,
  last_sync_error text,
  sync_cursor jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.financial_connections is
  'OAuth/API-подключения пользователя к банку, брокеру или криптосервису';

create unique index if not exists financial_connections_user_provider_uidx
  on public.financial_connections (user_id, provider_kind, provider_id, coalesce(external_connection_id, ''));

create index if not exists financial_connections_user_status_idx
  on public.financial_connections (user_id, status);

-- Секреты: клиент не имеет доступа (только Edge Functions с service role).
create table if not exists public.financial_connection_secrets (
  connection_id uuid primary key references public.financial_connections (id) on delete cascade,
  token_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.financial_connection_secrets is
  'Access/refresh tokens. Читать и писать только service role. В проде — Supabase Vault.';

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.financial_connections (id) on delete cascade,
  external_account_id text not null,
  name text not null default 'Счёт',
  account_kind text not null default 'checking'
    check (account_kind in ('checking', 'savings', 'credit', 'brokerage', 'crypto_wallet', 'other')),
  currency text not null default 'RUB',
  balance numeric(16, 2),
  balance_updated_at timestamptz,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_account_id)
);

create index if not exists financial_accounts_user_idx
  on public.financial_accounts (user_id, is_active);

alter table public.transactions
  add column if not exists financial_connection_id uuid references public.financial_connections (id) on delete set null;

alter table public.transactions
  add column if not exists financial_account_id uuid references public.financial_accounts (id) on delete set null;

alter table public.transactions
  add column if not exists external_id text;

comment on column public.transactions.external_id is
  'ID операции у провайдера (банк/брокер). Для дедупликации при синхронизации.';

create unique index if not exists transactions_bank_dedup_uidx
  on public.transactions (user_id, financial_account_id, external_id)
  where external_id is not null and financial_account_id is not null;

-- Банковские транзакции создаёт только синхронизация (Edge Function), не клиент.
create or replace function public.guard_transaction_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'bank' and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'bank transactions can only be created by sync service';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_guard_bank_source on public.transactions;
create trigger transactions_guard_bank_source
  before insert or update on public.transactions
  for each row
  execute function public.guard_transaction_source();

create or replace function public.touch_financial_connection_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists financial_connections_touch_updated_at on public.financial_connections;
create trigger financial_connections_touch_updated_at
  before update on public.financial_connections
  for each row
  execute function public.touch_financial_connection_updated_at();

alter table public.financial_connections enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.financial_connection_secrets enable row level security;

drop policy if exists "financial_connections_select_own" on public.financial_connections;
create policy "financial_connections_select_own"
  on public.financial_connections for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "financial_connections_insert_own" on public.financial_connections;
create policy "financial_connections_insert_own"
  on public.financial_connections for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "financial_connections_update_own" on public.financial_connections;
create policy "financial_connections_update_own"
  on public.financial_connections for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "financial_connections_delete_own" on public.financial_connections;
create policy "financial_connections_delete_own"
  on public.financial_connections for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "financial_accounts_select_own" on public.financial_accounts;
create policy "financial_accounts_select_own"
  on public.financial_accounts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "financial_accounts_all_own" on public.financial_accounts;
create policy "financial_accounts_all_own"
  on public.financial_accounts for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Секреты: deny all для authenticated/anon
revoke all on table public.financial_connection_secrets from anon, authenticated;

grant select, insert, update, delete on public.financial_connections to authenticated;
grant select, insert, update, delete on public.financial_accounts to authenticated;
