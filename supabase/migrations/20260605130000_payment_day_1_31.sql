-- День платежа/списания: 1–31 (в коротких месяцах напоминание сработает в последний день)

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_day_check;

alter table public.subscriptions
  add constraint subscriptions_billing_day_check
  check (billing_day between 1 and 31);

comment on column public.subscriptions.billing_day is 'День списания 1–31';

alter table public.debts
  drop constraint if exists debts_payment_day_check;

alter table public.debts
  add constraint debts_payment_day_check
  check (payment_day between 1 and 31);

comment on column public.debts.payment_day is 'День ежемесячного платежа 1–31';
