import { getReadableErrorMessage } from './apiErrors';
import { supabase } from './supabase';

export function isAuthError(error: unknown) {
  const message = getReadableErrorMessage(error, '').toLowerCase();
  return (
    message.includes('jwt') ||
    message.includes('not authenticated') ||
    message.includes('invalid claim') ||
    message.includes('session') ||
    message.includes('401')
  );
}

/** Сессия из локального хранилища — без лишнего запроса к серверу. */
export async function requireLocalSession() {
  if (!supabase) throw new Error('Supabase не настроен.');

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session) {
    throw new Error('Сессия истекла. Выйдите из аккаунта и войдите снова.');
  }
  return data.session;
}

let refreshInFlight: Promise<void> | null = null;

/** Одно обновление токена на все параллельные запросы (избегаем гонок на iOS). */
export async function refreshSessionOnce() {
  if (!supabase) throw new Error('Supabase не настроен.');

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw new Error('Сессия истекла. Выйдите из аккаунта и войдите снова.');
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  await refreshInFlight;
}
