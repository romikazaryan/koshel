-- Сверка быстрых записей (голос/ручной/чек) с операциями из выписки.

alter table public.transactions
  add column if not exists reconciled_with_id uuid references public.transactions (id) on delete set null;

comment on column public.transactions.reconciled_with_id is
  'Если задано — быстрая запись скрыта, т.к. подтверждена операцией из банка (выписка).';

create index if not exists transactions_active_user_date_idx
  on public.transactions (user_id, "date" desc)
  where reconciled_with_id is null;
