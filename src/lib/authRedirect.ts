import * as Linking from 'expo-linking';

/** Должен совпадать с Redirect URLs в Supabase Dashboard. */
export const AUTH_CALLBACK_PATH = 'auth/callback';

export function getEmailRedirectUrl() {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

/** Парсит access/refresh token из deep link после подтверждения email. */
export function parseAuthTokensFromUrl(url: string) {
  const fragment = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?').slice(1).join('?').split('#')[0] : '';
  const raw = fragment || query;
  if (!raw) return null;

  const params = Object.fromEntries(new URLSearchParams(raw));
  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  const error = params.error;
  const error_description = params.error_description;

  if (error) {
    throw new Error(error_description || error);
  }
  if (!access_token || !refresh_token) return null;

  return { access_token, refresh_token };
}
