-- Стартовый опрос: профиль пользователя и отметка прохождения

alter table public.user_settings
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_profile jsonb;

comment on column public.user_settings.onboarding_completed_at is 'Когда пользователь прошёл стартовый опрос';
comment on column public.user_settings.onboarding_profile is 'Ответы стартового опроса: доход, лимит трат, подушка, цель';

-- Триггер handle_user_settings_user_id требует auth.uid() = user_id;
-- при db push uid пустой → «forbidden». Временно отключаем на backfill.
alter table public.user_settings disable trigger user_settings_set_user_id;

update public.user_settings
set onboarding_completed_at = coalesce(onboarding_completed_at, updated_at)
where monthly_budget is not null
  and onboarding_completed_at is null;

alter table public.user_settings enable trigger user_settings_set_user_id;
