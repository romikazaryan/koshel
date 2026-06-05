-- Привязка расходов к пользователю Supabase Auth

alter table public.transactions
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists transactions_user_id_date_idx
  on public.transactions (user_id, "date" desc);

create or replace function public.handle_transaction_user_id()
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

drop trigger if exists transactions_set_user_id on public.transactions;
create trigger transactions_set_user_id
  before insert on public.transactions
  for each row
  execute function public.handle_transaction_user_id();

drop policy if exists "transactions_allow_anon_all" on public.transactions;
drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

create policy "transactions_select_own"
  on public.transactions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on public.transactions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "transactions_update_own"
  on public.transactions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_delete_own"
  on public.transactions
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.transactions from anon;
grant select, insert, update, delete on table public.transactions to authenticated;
