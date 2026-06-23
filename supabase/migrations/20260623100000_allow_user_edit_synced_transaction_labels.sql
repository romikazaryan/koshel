-- Банк/брокер: создание — только sync service; правка подписи/категории — пользователю.

create or replace function public.guard_transaction_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    if new.source in ('bank', 'broker') then
      raise exception 'synced transactions can only be created by sync service';
    end if;
    return new;
  end if;

  if TG_OP = 'UPDATE' and old.source in ('bank', 'broker') then
    if new.source is distinct from old.source
       or new.amount is distinct from old.amount
       or new.date is distinct from old.date
       or new.kind is distinct from old.kind
       or new.external_id is distinct from old.external_id
       or new.financial_connection_id is distinct from old.financial_connection_id
       or new.financial_account_id is distinct from old.financial_account_id
       or new.statement_import_id is distinct from old.statement_import_id
       or new.user_id is distinct from old.user_id
       or new.reconciled_with_id is distinct from old.reconciled_with_id
    then
      raise exception 'synced transaction core fields can only be changed by sync service';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_transaction_source() is
  'INSERT bank/broker — только service_role. UPDATE — пользователь может менять title, category, note.';
