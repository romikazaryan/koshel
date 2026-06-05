import { withTimeout } from './asyncUtils';
import { supabase } from './supabase';

const QUERY_TIMEOUT_MS = 15_000;

export async function fetchMonthlyBudget(userId?: string | null): Promise<number | null> {
  if (!supabase) return null;

  try {
    let resolvedUserId = userId?.trim() || '';
    if (!resolvedUserId) {
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError || !authData.session?.user) return null;
      resolvedUserId = authData.session.user.id;
    }

    const { data, error } = await withTimeout(
      supabase
        .from('user_settings')
        .select('monthly_budget')
        .eq('user_id', resolvedUserId)
        .maybeSingle(),
      QUERY_TIMEOUT_MS,
      'Сервер не ответил вовремя'
    );

    if (error) {
      console.warn('fetchMonthlyBudget error', error.message);
      return null;
    }

    const value = data?.monthly_budget;
    if (value == null) return null;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  } catch (error) {
    console.warn('fetchMonthlyBudget failed', error);
    return null;
  }
}

export async function saveMonthlyBudget(amount: number | null): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен.');

  const { data: authData, error: authError } = await supabase.auth.getSession();
  if (authError || !authData.session?.user) throw new Error('Войдите в аккаунт.');

  if (amount != null && (!Number.isFinite(amount) || amount <= 0)) {
    throw new Error('Введите сумму больше нуля.');
  }

  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: authData.session.user.id,
      monthly_budget: amount,
    },
    { onConflict: 'user_id' }
  );

  if (error) throw new Error(error.message);
}
