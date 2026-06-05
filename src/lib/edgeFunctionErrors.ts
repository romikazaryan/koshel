import { FunctionsHttpError } from '@supabase/supabase-js';

function readErrorField(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  return (
    (typeof record.error === 'string' && record.error) ||
    (typeof record.message === 'string' && record.message) ||
    (typeof record.reason === 'string' && record.reason) ||
    null
  );
}

/** Понятное сообщение после supabase.functions.invoke (в т.ч. 400/500 от Edge Function). */
export async function getEdgeFunctionErrorMessage(
  error: unknown,
  data: unknown,
  fallback = 'Не удалось выполнить запрос.'
): Promise<string> {
  const fromData = readErrorField(data);
  if (fromData) return fromData;

  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      const fromBody = readErrorField(body);
      if (fromBody) return fromBody;
    } catch {
      // ignore
    }
    if (error.message) return error.message;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
