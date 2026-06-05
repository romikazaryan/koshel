import { TimeoutError, isRetryableError } from './asyncUtils';

export function getReadableErrorMessage(error: unknown, fallback = 'Неизвестная ошибка') {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;

  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const direct =
      (typeof e.message === 'string' && e.message) ||
      (typeof e.error_description === 'string' && e.error_description) ||
      (typeof e.error === 'string' && e.error) ||
      (typeof e.details === 'string' && e.details) ||
      (typeof e.hint === 'string' && e.hint);

    if (direct) return direct;

    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export function isTransientNetworkError(error: unknown) {
  return isRetryableError(error);
}

export function formatTransactionSaveError(error: unknown, fallback: string) {
  if (error instanceof TimeoutError) {
    return 'Сервер не ответил вовремя. Проверьте интернет и попробуйте снова.';
  }

  const message = getReadableErrorMessage(error, '').toLowerCase();
  if (
    message.includes('row-level security') ||
    message.includes('jwt') ||
    message.includes('not authenticated') ||
    message.includes('сессия истекла') ||
    message.includes('не удалось проверить вход') ||
    message.includes('не удалось обновить сессию')
  ) {
    return 'Сессия истекла. Выйдите из аккаунта и войдите снова.';
  }

  if (isTransientNetworkError(error)) {
    return 'Проблема с сетью. Проверьте интернет на iPhone и попробуйте ещё раз.';
  }

  const text = getReadableErrorMessage(error, fallback);
  return text.replace(/^error:\s*/i, '').trim() || fallback;
}
