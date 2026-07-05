export function mapAuthErrorMessage(error: unknown) {
  const message = extractAuthErrorText(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('fetch failed') ||
    lower.includes('hostname could not be found') ||
    lower.includes('network request failed') ||
    lower.includes('enotfound') ||
    lower.includes('the internet connection appears to be offline')
  ) {
    const host = getSupabaseHostLabel();
    return host
      ? `Нет связи с сервером (${host}). Проверьте интернет на iPhone (Wi‑Fi или LTE). Откройте этот адрес в Safari — если не открывается, проект Supabase может быть приостановлен или сеть блокирует доступ.`
      : 'Нет связи с сервером. Проверьте интернет на iPhone и настройки Supabase в .env.';
  }

  if (lower.includes('network connection was lost') || lower.includes('timed out')) {
    return 'Сервер не ответил вовремя. Проверьте интернет и попробуйте снова.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'Неверный email или пароль.';
  }
  if (lower.includes('user already registered')) {
    return 'Пользователь с таким email уже зарегистрирован.';
  }
  if (lower.includes('password should be at least')) {
    return 'Пароль слишком короткий (минимум 6 символов).';
  }
  if (lower.includes('unable to validate email address')) {
    return 'Некорректный email.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Подтвердите email по ссылке из письма, затем войдите снова.';
  }
  if (lower.includes('invalid phone number') || lower.includes('phone number is invalid')) {
    return 'Некорректный номер телефона. Введите 10 цифр после +7.';
  }
  if (lower.includes('token has expired') || lower.includes('otp_expired')) {
    return 'Код устарел. Запросите новый.';
  }
  if (lower.includes('invalid token') || lower.includes('otp')) {
    return 'Неверный код из SMS.';
  }
  if (lower.includes('sms') && lower.includes('rate')) {
    return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  }
  return message;
}

function extractAuthErrorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const causeText =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : '';
    return [error.message, causeText].filter(Boolean).join(': ');
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message ?? '');
  }
  return String(error ?? '');
}

function getSupabaseHostLabel(): string | null {
  try {
    const Constants = require('expo-constants').default as {
      expoConfig?: { extra?: { SUPABASE_URL?: string } };
      manifest?: { extra?: { SUPABASE_URL?: string } };
    };
    const extra =
      Constants.expoConfig?.extra ?? (Constants.manifest as { extra?: { SUPABASE_URL?: string } })?.extra;
    const url = String(extra?.SUPABASE_URL ?? '').trim();
    if (!url) return null;
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
