-- Кредиты и другие задолженности

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  monthly_payment numeric(12, 2) not null check (monthly_payment > 0),
  payment_day smallint not null default 1 check (payment_day between 1 and 28),
  end_date date not null,
  remind_enabled boolean not null default true,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.debts is 'Кредиты и ежемесячные долги пользователя';
comment on column public.debts.end_date is 'Дата последнего платежа по графику';
comment on column public.debts.payment_day is 'День ежемесячного платежа 1–28';

create index if not exists debts_user_active_idx
  on public.debts (user_id, is_active);

create or replace function public.handle_debt_user_id()
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

drop trigger if exists debts_set_user_id on public.debts;
create trigger debts_set_user_id
  before insert or update on public.debts
  for each row
  execute function public.handle_debt_user_id();

alter table public.debts enable row level security;

drop policy if exists "debts_select_own" on public.debts;
drop policy if exists "debts_insert_own" on public.debts;
drop policy if exists "debts_update_own" on public.debts;
drop policy if exists "debts_delete_own" on public.debts;

create policy "debts_select_own"
  on public.debts for select to authenticated
  using (auth.uid() = user_id);

create policy "debts_insert_own"
  on public.debts for insert to authenticated
  with check (auth.uid() = user_id);

create policy "debts_update_own"
  on public.debts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "debts_delete_own"
  on public.debts for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.debts to authenticated;
