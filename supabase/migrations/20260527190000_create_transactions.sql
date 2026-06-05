-- Таблица расходов для приложения koshel
-- Поля совпадают с тем, что ожидают DashboardScreen и AddExpenseScreen.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Расход',
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  note text,
  "date" date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now()
);

comment on table public.transactions is 'Расходы пользователя (кошелёк koshel)';

create index if not exists transactions_date_desc_idx
  on public.transactions ("date" desc);

-- Доступ для клиента с anon-ключом (сейчас в приложении нет привязки к user_id).
-- Для продакшена: добавить user_id, включить auth и заменить политики на user-scoped.
alter table public.transactions enable row level security;

drop policy if exists "transactions_allow_anon_all" on public.transactions;
create policy "transactions_allow_anon_all"
  on public.transactions
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on table public.transactions to anon, authenticated;
