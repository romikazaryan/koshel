-- История импортов банковских выписок и связь с операциями.

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.financial_connections (id) on delete cascade,
  account_id uuid not null references public.financial_accounts (id) on delete cascade,
  file_name text not null,
  imported_at timestamptz not null default now(),
  row_count integer not null default 0 check (row_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  account_kind text,
  card_last4 text,
  created_at timestamptz not null default now()
);

create index if not exists bank_statement_imports_user_idx
  on public.bank_statement_imports (user_id, imported_at desc);

comment on table public.bank_statement_imports is
  'Загруженные CSV/PDF выписки. Удаление записи удаляет связанные операции.';

alter table public.transactions
  add column if not exists statement_import_id uuid
    references public.bank_statement_imports (id) on delete cascade;

create index if not exists transactions_statement_import_idx
  on public.transactions (statement_import_id)
  where statement_import_id is not null;

alter table public.bank_statement_imports enable row level security;

drop policy if exists "bank_statement_imports_select_own" on public.bank_statement_imports;
create policy "bank_statement_imports_select_own"
  on public.bank_statement_imports for select to authenticated
  using (user_id = auth.uid());

grant select on public.bank_statement_imports to authenticated;
grant all on public.bank_statement_imports to service_role;
