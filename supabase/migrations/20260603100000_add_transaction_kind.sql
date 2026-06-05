-- Тип операции: расход или доход (одна таблица transactions)

alter table public.transactions
  add column if not exists kind text not null default 'expense';

alter table public.transactions
  drop constraint if exists transactions_kind_check;

alter table public.transactions
  add constraint transactions_kind_check
  check (kind in ('expense', 'income'));

comment on column public.transactions.kind is 'expense | income';

create index if not exists transactions_user_kind_date_idx
  on public.transactions (user_id, kind, "date" desc);
