-- Настройки пользователя: плановый лимит трат на месяц

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  monthly_budget numeric(12, 2) check (monthly_budget is null or monthly_budget > 0),
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is 'Настройки koshel на пользователя';
comment on column public.user_settings.monthly_budget is 'Плановый лимит расходов за месяц (₽)';

alter table public.user_settings enable row level security;

create or replace function public.handle_user_settings_user_id()
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
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_settings_set_user_id on public.user_settings;
create trigger user_settings_set_user_id
  before insert or update on public.user_settings
  for each row
  execute function public.handle_user_settings_user_id();

drop policy if exists "user_settings_select_own" on public.user_settings;
drop policy if exists "user_settings_insert_own" on public.user_settings;
drop policy if exists "user_settings_update_own" on public.user_settings;

create policy "user_settings_select_own"
  on public.user_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_settings_insert_own"
  on public.user_settings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_settings_update_own"
  on public.user_settings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on table public.user_settings to authenticated;
