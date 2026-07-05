import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from './asyncUtils';
import { saveMonthlyBudget } from './userSettings';
import { supabase } from './supabase';
import type { OnboardingAnswers, OnboardingProfile } from '../types/onboarding';
import {
  GOAL_LABELS,
  INCOME_OPTIONS,
  SAVINGS_LABELS,
  spendingOptionsForIncome,
} from '../constants/onboardingFlow';

const QUERY_TIMEOUT_MS = 15_000;
const LOCAL_KEY_PREFIX = 'koshel_onboarding_v1';
const LOCAL_DEVICE_KEY = 'koshel_onboarding_device_v1';
const FIRST_EXPENSE_KEY_PREFIX = 'koshel_first_expense_v1';
const FIRST_EXPENSE_DEVICE_KEY = 'koshel_first_expense_device_v1';

function firstExpenseKey(userId: string) {
  return `${FIRST_EXPENSE_KEY_PREFIX}:${userId}`;
}

export async function setFirstExpensePrompt(userId?: string | null): Promise<void> {
  if (userId) {
    await AsyncStorage.setItem(firstExpenseKey(userId), '1');
  } else {
    await AsyncStorage.setItem(FIRST_EXPENSE_DEVICE_KEY, '1');
  }
}

export async function consumeFirstExpensePrompt(userId?: string | null): Promise<boolean> {
  const key = userId ? firstExpenseKey(userId) : FIRST_EXPENSE_DEVICE_KEY;
  const value = await AsyncStorage.getItem(key);
  if (value !== '1') return false;
  await AsyncStorage.removeItem(key);
  return true;
}

export const EMPTY_ONBOARDING_ANSWERS: OnboardingAnswers = {
  incomeRange: null,
  spendingPreset: null,
  customBudget: '',
  savingsCushion: null,
  primaryGoal: null,
};

function localKey(userId: string) {
  return `${LOCAL_KEY_PREFIX}:${userId}`;
}

export function resolveMonthlyBudgetFromAnswers(answers: OnboardingAnswers): number | null {
  if (answers.spendingPreset === 'skip') return null;

  if (answers.spendingPreset === 'custom') {
    const raw = answers.customBudget.replace(/\s/g, '').replace(',', '.');
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
  }

  const options = spendingOptionsForIncome(answers.incomeRange);
  const picked = options.find((o) => o.value === answers.spendingPreset);
  return picked?.budgetRub ?? null;
}

export function buildOnboardingProfile(answers: OnboardingAnswers): OnboardingProfile {
  return {
    incomeRange: answers.incomeRange && answers.incomeRange !== 'skip' ? answers.incomeRange : undefined,
    spendingPreset:
      answers.spendingPreset && answers.spendingPreset !== 'skip' ? answers.spendingPreset : undefined,
    monthlyBudget: resolveMonthlyBudgetFromAnswers(answers),
    savingsCushion:
      answers.savingsCushion && answers.savingsCushion !== 'skip' ? answers.savingsCushion : undefined,
    primaryGoal: answers.primaryGoal && answers.primaryGoal !== 'skip' ? answers.primaryGoal : undefined,
    completedAt: new Date().toISOString(),
  };
}

export async function fetchOnboardingCompleted(userId?: string | null): Promise<boolean> {
  // Локальный кэш — главный источник «опрос уже пройден» (работает без миграции Supabase).
  if (userId) {
    const local = await AsyncStorage.getItem(localKey(userId));
    if (local === '1') return true;
  } else {
    const device = await AsyncStorage.getItem(LOCAL_DEVICE_KEY);
    if (device === '1') return true;
  }

  if (userId && supabase) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('user_settings')
          .select('onboarding_completed_at, monthly_budget')
          .eq('user_id', userId)
          .maybeSingle(),
        QUERY_TIMEOUT_MS,
        'Не удалось проверить опрос'
      );
      if (!error) {
        if (data?.onboarding_completed_at) {
          await AsyncStorage.setItem(localKey(userId), '1');
          return true;
        }
        // Пока нет колонки onboarding_* — считаем пройденным, если уже есть бюджет.
        if (data?.monthly_budget != null && Number(data.monthly_budget) > 0) {
          await AsyncStorage.setItem(localKey(userId), '1');
          return true;
        }
      }
    } catch {
      // offline / timeout — полагаемся на локальный кэш выше
    }
  }

  return false;
}

export function profileToAnswers(
  profile: Partial<OnboardingProfile> | null,
  monthlyBudget: number | null
): OnboardingAnswers {
  if (!profile && (monthlyBudget == null || !Number.isFinite(monthlyBudget))) {
    return { ...EMPTY_ONBOARDING_ANSWERS };
  }

  let spendingPreset = profile?.spendingPreset ?? null;
  let customBudget = '';
  const budget =
    profile?.monthlyBudget ??
    (monthlyBudget != null && Number.isFinite(Number(monthlyBudget))
      ? Math.round(Number(monthlyBudget))
      : null);

  if (spendingPreset && spendingPreset !== 'skip' && spendingPreset !== 'custom') {
    // сохранённый пресет — как есть
  } else if (budget != null && budget > 0) {
    const options = spendingOptionsForIncome(profile?.incomeRange ?? null);
    const match = options.find(
      (o) => o.budgetRub === budget && o.value !== 'custom' && o.value !== 'skip'
    );
    if (match) {
      spendingPreset = match.value;
    } else {
      spendingPreset = 'custom';
      customBudget = String(budget);
    }
  }

  return {
    incomeRange: profile?.incomeRange ?? null,
    spendingPreset,
    customBudget,
    savingsCushion: profile?.savingsCushion ?? null,
    primaryGoal: profile?.primaryGoal ?? null,
  };
}

export async function fetchOnboardingAnswers(userId?: string | null): Promise<OnboardingAnswers> {
  if (!userId || !supabase) return { ...EMPTY_ONBOARDING_ANSWERS };

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('user_settings')
        .select('onboarding_profile, monthly_budget')
        .eq('user_id', userId)
        .maybeSingle(),
      QUERY_TIMEOUT_MS,
      'Не удалось загрузить ответы опроса'
    );
    if (error || !data) return { ...EMPTY_ONBOARDING_ANSWERS };

    const profile = (data.onboarding_profile as Partial<OnboardingProfile> | null) ?? null;
    const budget =
      data.monthly_budget != null && Number.isFinite(Number(data.monthly_budget))
        ? Math.round(Number(data.monthly_budget))
        : null;

    return profileToAnswers(profile, budget);
  } catch {
    return { ...EMPTY_ONBOARDING_ANSWERS };
  }
}

export async function completeOnboarding(
  userId: string | null,
  answers: OnboardingAnswers
): Promise<OnboardingProfile> {
  const profile = buildOnboardingProfile(answers);

  // Сразу помечаем локально — чтобы после перезапуска опрос не всплывал снова.
  if (userId) {
    await AsyncStorage.setItem(localKey(userId), '1');
  } else {
    await AsyncStorage.setItem(LOCAL_DEVICE_KEY, '1');
  }

  if (profile.monthlyBudget != null) {
    try {
      await saveMonthlyBudget(profile.monthlyBudget);
    } catch (error) {
      console.warn('onboarding saveMonthlyBudget failed', error);
    }
  }

  if (userId && supabase) {
    const row: Record<string, unknown> = {
      user_id: userId,
      onboarding_profile: profile,
      onboarding_completed_at: profile.completedAt,
    };
    if (profile.monthlyBudget != null) {
      row.monthly_budget = profile.monthlyBudget;
    }

    const { error } = await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' });
    if (error) {
      // Миграция onboarding_* могла ещё не быть применена — сохраняем хотя бы бюджет.
      console.warn('onboarding profile upsert failed', error.message);
      if (profile.monthlyBudget != null) {
        try {
          await saveMonthlyBudget(profile.monthlyBudget);
        } catch (budgetError) {
          console.warn('onboarding budget retry failed', budgetError);
        }
      }
    }
  }

  return profile;
}

export function formatOnboardingSummary(profile: OnboardingProfile): string[] {
  const lines: string[] = [];

  if (profile.monthlyBudget != null) {
    lines.push(`Лимит трат: ${profile.monthlyBudget.toLocaleString('ru-RU')} ₽/мес`);
  }

  if (profile.incomeRange && profile.incomeRange !== 'skip') {
    const incomeLabel = INCOME_OPTIONS.find((o) => o.value === profile.incomeRange)?.label;
    if (incomeLabel) lines.push(`Доход: ${incomeLabel}`);
  }

  if (profile.savingsCushion && profile.savingsCushion !== 'skip') {
    lines.push(`Подушка: ${SAVINGS_LABELS[profile.savingsCushion]}`);
  }

  if (profile.primaryGoal && profile.primaryGoal !== 'skip') {
    lines.push(`Фокус: ${GOAL_LABELS[profile.primaryGoal]}`);
  }

  if (lines.length === 0) {
    lines.push('Дашборд настроен — можно добавлять операции');
  }

  return lines;
}
