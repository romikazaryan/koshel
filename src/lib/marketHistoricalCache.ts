import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@koshel/market-historical-rates-v1';
/** Цена в прошлом не меняется — держим долго. */
const PERSIST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Entry = { rate: number; fetchedAt: number };

let memory: Record<string, Entry> = {};
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function isFresh(entry: Entry) {
  return Date.now() - entry.fetchedAt < PERSIST_TTL_MS;
}

export function historicalCacheKey(kind: 'stock' | 'crypto', id: string, daysAgo: number) {
  return `${kind}:${id}:${daysAgo}`;
}

export function ensureHistoricalCacheHydrated(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, Entry>;
      const now = Date.now();
      for (const [key, entry] of Object.entries(parsed)) {
        if (entry?.rate > 0 && now - entry.fetchedAt < PERSIST_TTL_MS) {
          memory[key] = entry;
        }
      }
    } catch (error) {
      console.warn('marketHistoricalCache hydrate failed', error);
    } finally {
      hydrated = true;
    }
  })();

  return hydratePromise;
}

export function readPersistedHistoricalRate(key: string): number | null {
  const entry = memory[key];
  if (!entry || !isFresh(entry)) return null;
  return entry.rate;
}

export function writePersistedHistoricalRate(key: string, rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return;
  memory[key] = { rate, fetchedAt: Date.now() };
  schedulePersist();
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory)).catch((error) => {
      console.warn('marketHistoricalCache persist failed', error);
    });
  }, 400);
}

export function clearPersistedHistoricalCache() {
  memory = {};
  hydrated = true;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}
