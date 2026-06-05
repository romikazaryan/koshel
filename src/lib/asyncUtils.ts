export class TimeoutError extends Error {
  constructor(message = 'Превышено время ожидания') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function isRetryableError(error: unknown) {
  if (error instanceof TimeoutError) return true;

  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  return (
    message.includes('network connection was lost') ||
    message.includes('fetch failed') ||
    message.includes('network request failed') ||
    message.includes('timed out') ||
    message.includes('превышено время ожидания') ||
    message.includes('сервер не ответил')
  );
}

export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  message = 'Превышено время ожидания'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(message)), ms);
    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function withOneRetry<T>(
  operation: () => PromiseLike<T>,
  delayMs = 700
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryableError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return await operation();
  }
}

type NetworkRetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  onAuthRetry?: () => Promise<void>;
};

/** Несколько попыток при обрыве сети — типично для iPhone + Supabase. */
export async function withNetworkRetries<T>(
  operation: () => PromiseLike<T>,
  options?: NetworkRetryOptions
): Promise<T> {
  const attempts = options?.attempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 280;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (options?.onAuthRetry && isAuthRetryable(error)) {
        await options.onAuthRetry();
        continue;
      }
      if (!isRetryableError(error) || attempt >= attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
    }
  }

  throw lastError;
}

function isAuthRetryable(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  return (
    message.includes('jwt') ||
    message.includes('not authenticated') ||
    message.includes('401') ||
    message.includes('row-level security')
  );
}
