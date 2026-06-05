-- Ежемесячные подписки (Netflix, Spotify и т.д.)

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null default 'Другое',
  billing_day smallint not null default 1 check (billing_day between 1 and 28),
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.subscriptions is 'Ежемесячные подписки пользователя';
comment on column public.subscriptions.billing_day is 'День списания 1–28';

create index if not exists subscriptions_user_active_idx
  on public.subscriptions (user_id, is_active);

create or replace function public.handle_subscription_user_id()
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

drop trigger if exists subscriptions_set_user_id on public.subscriptions;
create trigger subscriptions_set_user_id
  before insert or update on public.subscriptions
  for each row
  execute function public.handle_subscription_user_id();

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
drop policy if exists "subscriptions_insert_own" on public.subscriptions;
drop policy if exists "subscriptions_update_own" on public.subscriptions;
drop policy if exists "subscriptions_delete_own" on public.subscriptions;

create policy "subscriptions_select_own"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

create policy "subscriptions_insert_own"
  on public.subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "subscriptions_update_own"
  on public.subscriptions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "subscriptions_delete_own"
  on public.subscriptions for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.subscriptions to authenticated;
