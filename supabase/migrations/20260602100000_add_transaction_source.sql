-- Источник расхода (подготовка к синхронизации с банком через API)

alter table public.transactions
  add column if not exists source text not null default 'manual';

alter table public.transactions
  drop constraint if exists transactions_source_check;

alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual', 'voice', 'receipt', 'bank'));

comment on column public.transactions.source is 'manual | voice | receipt | bank (API банка)';

create index if not exists transactions_user_source_idx
  on public.transactions (user_id, source);
