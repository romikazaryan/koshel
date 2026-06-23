import {
  type FxUnit,
  CRYPTO_UNITS,
  canonicalizeCryptoUnit,
  getCbrCode,
  getCoingeckoId,
  isCryptoMarketUnit,
  isFxUnit,
  normalizeStockTicker,
  normalizeCryptoUnit,
  resolveMoexTicker,
  resolveCoingeckoId,
} from '../constants/marketUnits';
import {
  ensureHistoricalCacheHydrated,
  historicalCacheKey,
  readPersistedHistoricalRate,
  writePersistedHistoricalRate,
  clearPersistedHistoricalCache,
} from './marketHistoricalCache';

const CACHE_TTL_MS = 10 * 60 * 1000;
/** MOEX spot — короткий кэш; на экране капитала обновляем принудительно каждые 2 мин. */
const STOCK_CACHE_TTL_MS = 30 * 1000;
/** CoinGecko spot — тот же интервал, что и авто-обновление на экране капитала. */
const CRYPTO_CACHE_TTL_MS = 2 * 60 * 1000;
/** При 429 можно отдать чуть устаревший курс, чтобы не блокировать добавление актива. */
const CRYPTO_STALE_OK_MS = 2 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;
const MOEX_PRICE_FIELDS = ['LAST', 'LCURRENTPRICE', 'MARKETPRICE', 'PREVLEGALCLOSE'] as const;
const MOEX_SPOT_BOARDS = ['TQBR', 'TQTF'] as const;
const MOEX_SPOT_CONCURRENCY = 8;
const COINGECKO_MIN_GAP_MS = 1_200;
const COINGECKO_SPOT_MIN_GAP_MS = 400;
const COINGECKO_MAX_RETRIES = 5;
const COINGECKO_SPOT_MAX_RETRIES = 2;

type RateCache = {
  fetchedAt: number;
  cryptoRub: Record<string, number>;
  fxRub: Partial<Record<FxUnit, number>>;
  stockRub: Record<string, number>;
};

let cache: RateCache = { fetchedAt: 0, cryptoRub: {}, fxRub: {}, stockRub: {} };
const cryptoCachedAt: Record<string, number> = {};
const stockCachedAt: Record<string, number> = {};
const stockPrevCloseRub: Record<string, number> = {};

let coingeckoChain: Promise<unknown> = Promise.resolve();
let coingeckoLastCallAt = 0;
let coingeckoSpotChain: Promise<unknown> = Promise.resolve();
let coingeckoSpotLastCallAt = 0;

type ChartCacheEntry = {
  fetchedAt: number;
  prices: [number, number][];
};

const chartCache: Record<string, ChartCacheEntry> = {};
const moexHistoryCache: Record<string, { fetchedAt: number; rows: MoexHistoryRow[] }> = {};
const historicalRateMemory: Record<string, { rate: number; fetchedAt: number }> = {};
const CHART_CACHE_TTL_MS = 30 * 60 * 1000;
/** CoinGecko market_chart: один запрос days=365 покрывает все периоды. */
export const COINGECKO_CHART_MAX_DAYS = 365;
const PREFETCH_CONCURRENCY = 3;
const COINGECKO_SPOT_BATCH_SIZE = 15;
/** Лёгкие точечные запросы «цена N дней назад» — можно параллелить. */
const HISTORICAL_FETCH_CONCURRENCY = 10;
const IN_MEMORY_HISTORICAL_TTL_MS = 6 * 60 * 60 * 1000;

type MoexHistoryRow = { tradeDate: string; close: number };

type CoinGeckoPrice = Record<string, { rub?: number; usd?: number }>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  if (items.length === 0) return;
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function chartCacheKey(coingeckoId: string) {
  return `${coingeckoId}:${COINGECKO_CHART_MAX_DAYS}`;
}

function getCachedCryptoChartPrices(coingeckoId: string): [number, number][] | null {
  const cached = chartCache[chartCacheKey(coingeckoId)];
  if (cached && Date.now() - cached.fetchedAt < CHART_CACHE_TTL_MS) {
    return cached.prices;
  }
  return null;
}

function isCacheFresh() {
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

async function fetchJsonWithRetry<T>(url: string, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return url.includes('/simple/price')
        ? await coingeckoSpotFetch<T>(url)
        : isCoingeckoUrl(url)
          ? await coingeckoFetch<T>(url)
          : await fetchJson<T>(url);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = message.includes('HTTP 429') || message.includes('HTTP 5');
      if (!retryable || attempt === retries) break;
      await sleep(900 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function isCoingeckoUrl(url: string) {
  return url.includes('api.coingecko.com');
}

function isRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('HTTP 429');
}

async function coingeckoSpotFetch<T>(url: string): Promise<T> {
  const run = async () => {
    const gap = Date.now() - coingeckoSpotLastCallAt;
    if (gap < COINGECKO_SPOT_MIN_GAP_MS) {
      await sleep(COINGECKO_SPOT_MIN_GAP_MS - gap);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= COINGECKO_SPOT_MAX_RETRIES; attempt += 1) {
      coingeckoSpotLastCallAt = Date.now();
      try {
        return await fetchJson<T>(url);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const retryable = message.includes('HTTP 429') || message.includes('HTTP 5');
        if (!retryable || attempt === COINGECKO_SPOT_MAX_RETRIES) break;
        await sleep(700 * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  };

  const result = coingeckoSpotChain.then(run, run);
  coingeckoSpotChain = result.then(
    () => undefined,
    () => undefined
  );
  return result as Promise<T>;
}

async function coingeckoFetch<T>(url: string): Promise<T> {
  const run = async () => {
    const gap = Date.now() - coingeckoLastCallAt;
    if (gap < COINGECKO_MIN_GAP_MS) {
      await sleep(COINGECKO_MIN_GAP_MS - gap);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= COINGECKO_MAX_RETRIES; attempt += 1) {
      coingeckoLastCallAt = Date.now();
      try {
        return await fetchJson<T>(url);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const retryable = message.includes('HTTP 429') || message.includes('HTTP 5');
        if (!retryable || attempt === COINGECKO_MAX_RETRIES) break;
        await sleep(1_500 * 2 ** attempt);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  };

  const result = coingeckoChain.then(run, run);
  coingeckoChain = result.then(
    () => undefined,
    () => undefined
  );
  return result as Promise<T>;
}

function storeCryptoRate(unit: string, price: number, fetchedAt: number) {
  const normalized = normalizeCryptoUnit(unit);
  const canonical = canonicalizeCryptoUnit(unit);
  const id = resolveCoingeckoId(normalized) ?? resolveCoingeckoId(canonical);

  cache.cryptoRub[canonical] = price;
  cryptoCachedAt[canonical] = fetchedAt;

  if (normalized !== canonical) {
    cache.cryptoRub[normalized] = price;
    cryptoCachedAt[normalized] = fetchedAt;
  }

  if (id) {
    cache.cryptoRub[`$id:${id}`] = price;
    cryptoCachedAt[`$id:${id}`] = fetchedAt;
    for (const preset of CRYPTO_UNITS) {
      if (getCoingeckoId(preset.value) === id) {
        cache.cryptoRub[preset.value] = price;
        cryptoCachedAt[preset.value] = fetchedAt;
      }
    }
  }
}

export function getCryptoRateFromMap(
  unit: string,
  rates: Record<string, number>
): number | undefined {
  const normalized = normalizeCryptoUnit(unit);
  const canonical = canonicalizeCryptoUnit(unit);
  const direct =
    rates[canonical] ?? rates[normalized] ?? rates[unit] ?? rates[normalizeCryptoUnit(unit)];
  if (direct != null && direct > 0) return direct;

  const id = resolveCoingeckoId(canonical) ?? resolveCoingeckoId(normalized);
  if (id && rates[`$id:${id}`] != null && rates[`$id:${id}`] > 0) {
    return rates[`$id:${id}`];
  }

  if (!id) return undefined;
  for (const [key, rate] of Object.entries(rates)) {
    if (rate > 0 && resolveCoingeckoId(key) === id) return rate;
  }
  return undefined;
}

function readCachedCryptoRate(unit: string): number | null {
  const canonical = canonicalizeCryptoUnit(unit);
  const normalized = normalizeCryptoUnit(unit);
  const id = resolveCoingeckoId(canonical) ?? resolveCoingeckoId(normalized);

  const keys = new Set<string>([canonical, normalized, unit]);
  if (id) keys.add(`$id:${id}`);

  for (const key of keys) {
    const rate = cache.cryptoRub[key];
    if (rate != null && rate > 0) return rate;
  }

  if (id) {
    for (const preset of CRYPTO_UNITS) {
      if (getCoingeckoId(preset.value) !== id) continue;
      const rate = cache.cryptoRub[preset.value];
      if (rate != null && rate > 0) return rate;
    }
  }

  return null;
}

function readStaleCryptoRates(units: string[]) {
  const now = Date.now();
  const result: Record<string, number> = {};
  for (const unit of units) {
    const canonical = canonicalizeCryptoUnit(unit);
    const rate = readCachedCryptoRate(canonical);
    if (rate == null) continue;

    const cachedAt = getCryptoCachedAt(canonical);
    if (now - cachedAt < CRYPTO_STALE_OK_MS) {
      result[canonical] = rate;
    }
  }
  return expandCryptoRatesMap(result);
}

async function fetchCryptoSpotPrices(ids: string[]): Promise<CoinGeckoPrice> {
  return coingeckoSpotFetch<CoinGeckoPrice>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=rub,usd`
  );
}

async function fillCryptoRatesFromUsd(
  units: string[],
  data: CoinGeckoPrice
): Promise<void> {
  const needsUsd = units.filter((unit) => {
    const id = resolveCoingeckoId(unit);
    if (!id) return false;
    const rub = data[id]?.rub;
    const cached = cache.cryptoRub[normalizeCryptoUnit(unit)];
    if (cached != null && cached > 0) return false;
    return rub == null || rub <= 0;
  });
  if (needsUsd.length === 0) return;

  const fx = await fetchFxRatesRub(['usd']);
  const usdRub = fx.usd;
  if (usdRub == null || usdRub <= 0) return;

  for (const unit of needsUsd) {
    const id = resolveCoingeckoId(unit);
    if (!id) continue;
    const usd = data[id]?.usd;
    if (usd != null && usd > 0) {
      storeCryptoRate(unit, usd * usdRub, Date.now());
    }
  }
}

function applyCryptoSpotPayload(units: string[], data: CoinGeckoPrice, fetchedAt: number) {
  for (const unit of units) {
    const id = resolveCoingeckoId(unit);
    if (!id) continue;
    const rub = data[id]?.rub;
    if (rub != null && rub > 0) {
      storeCryptoRate(unit, rub, fetchedAt);
    }
  }
}

function missingCryptoUnits(units: string[]): string[] {
  return units.filter((unit) => {
    const canonical = canonicalizeCryptoUnit(unit);
    return readCachedCryptoRate(canonical) == null;
  });
}

async function fetchCryptoSpotPricesBatched(ids: string[]): Promise<CoinGeckoPrice> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const merged: CoinGeckoPrice = {};
  for (const chunk of chunkArray(unique, COINGECKO_SPOT_BATCH_SIZE)) {
    const data = await fetchCryptoSpotPrices(chunk);
    Object.assign(merged, data);
  }
  return merged;
}

async function hydrateCryptoRates(units: string[]): Promise<void> {
  const unique = [
    ...new Set(
      units
        .filter(isCryptoMarketUnit)
        .map((unit) => canonicalizeCryptoUnit(unit))
        .filter((unit) => isCryptoMarketUnit(unit))
    ),
  ];
  if (unique.length === 0) return;

  const ids = [
    ...new Set(
      unique.map((unit) => resolveCoingeckoId(unit)).filter((id): id is string => Boolean(id))
    ),
  ];
  if (ids.length === 0) return;

  const fetchedAt = Date.now();
  const data = await fetchCryptoSpotPricesBatched(ids);
  applyCryptoSpotPayload(unique, data, fetchedAt);
  await fillCryptoRatesFromUsd(unique, data);

  const stillMissing = missingCryptoUnits(unique);
  for (const unit of stillMissing) {
    const id = resolveCoingeckoId(unit);
    if (!id) continue;
    try {
      const single = await fetchCryptoSpotPrices([id]);
      applyCryptoSpotPayload([unit], single, Date.now());
      await fillCryptoRatesFromUsd([unit], single);
    } catch (error) {
      console.warn(`fetchCryptoRatesRub single ${unit} failed`, error);
    }
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

type CbrDailyJson = {
  Valute?: Record<
    string,
    {
      Value: number;
      Nominal: number;
    }
  >;
};

export async function fetchFxRatesRub(units: FxUnit[]): Promise<Partial<Record<FxUnit, number>>> {
  const unique = [...new Set(units)];
  if (unique.length === 0) return {};

  const missing = unique.filter((unit) => cache.fxRub[unit] == null);
  if (missing.length === 0 && isCacheFresh()) {
    return pickFx(unique);
  }

  const data = await fetchJson<CbrDailyJson>('https://www.cbr-xml-daily.ru/daily_json.js');
  const valute = data.Valute ?? {};

  for (const unit of missing.length > 0 ? missing : unique) {
    const code = getCbrCode(unit);
    const row = valute[code];
    if (!row || !row.Nominal) continue;
    cache.fxRub[unit] = row.Value / row.Nominal;
  }

  cache.fetchedAt = Date.now();
  return pickFx(unique);
}

function pickFx(units: FxUnit[]) {
  const result: Partial<Record<FxUnit, number>> = {};
  for (const unit of units) {
    if (cache.fxRub[unit] != null) result[unit] = cache.fxRub[unit];
  }
  return result;
}

export async function fetchCryptoRatesRub(
  units: string[],
  options?: { force?: boolean }
): Promise<Record<string, number>> {
  const unique = [
    ...new Set(
      units
        .filter(isCryptoMarketUnit)
        .map((unit) => canonicalizeCryptoUnit(unit))
        .filter((unit) => isCryptoMarketUnit(unit))
    ),
  ];
  if (unique.length === 0) return {};

  const now = Date.now();
  const toFetch = options?.force
    ? unique
    : unique.filter((unit) => {
        const cachedAt = cryptoCachedAt[unit] ?? 0;
        return cache.cryptoRub[unit] == null || now - cachedAt >= CRYPTO_CACHE_TTL_MS;
      });

  if (toFetch.length === 0) {
    return pickCrypto(unique);
  }

  const ids = [
    ...new Set(
      toFetch.map((unit) => resolveCoingeckoId(unit)).filter((id): id is string => Boolean(id))
    ),
  ];
  if (ids.length === 0) return pickCrypto(unique);

  try {
    await hydrateCryptoRates(toFetch);
    cache.fetchedAt = Date.now();
    return pickCrypto(unique);
  } catch (error) {
    console.warn('fetchCryptoRatesRub batch failed, retrying per unit', error);
    for (const unit of toFetch) {
      try {
        await hydrateCryptoRates([unit]);
      } catch (singleError) {
        console.warn(`fetchCryptoRatesRub retry ${unit} failed`, singleError);
      }
    }

    const stale = readStaleCryptoRates(unique);
    const cached = pickCrypto(unique);
    const merged = { ...cached, ...stale };
    if (Object.keys(merged).length > 0) {
      return merged;
    }
    console.warn('fetchCryptoRatesRub failed', error);
    return {};
  }
}

function pickCrypto(units: string[]) {
  const result: Record<string, number> = {};
  for (const unit of units) {
    const canonical = canonicalizeCryptoUnit(unit);
    const rate = readCachedCryptoRate(canonical) ?? readCachedCryptoRate(unit);
    if (rate != null && rate > 0) {
      result[canonical] = rate;
      if (unit !== canonical) result[unit] = rate;
    }
  }
  return expandCryptoRatesMap(result);
}

/** Дублирует курс на все unit-алиасы одной монеты (bnb, cg:binancecoin:bnb, …). */
export function expandCryptoRatesMap(rates: Record<string, number>): Record<string, number> {
  const expanded: Record<string, number> = { ...rates };

  for (const [key, rate] of Object.entries(rates)) {
    if (rate == null || rate <= 0) continue;
    const canonical = canonicalizeCryptoUnit(key);
    const id = resolveCoingeckoId(key) ?? resolveCoingeckoId(canonical);
    if (!id) continue;

    expanded[canonical] = rate;
    expanded[`$id:${id}`] = rate;
    for (const preset of CRYPTO_UNITS) {
      if (getCoingeckoId(preset.value) === id) {
        expanded[preset.value] = rate;
      }
    }
  }

  return expanded;
}

export async function ensureCryptoRatesForUnits(
  units: string[],
  options?: { force?: boolean }
): Promise<Record<string, number>> {
  const unique = [
    ...new Set(
      units
        .filter(isCryptoMarketUnit)
        .map((unit) => canonicalizeCryptoUnit(unit))
        .filter((unit) => isCryptoMarketUnit(unit))
    ),
  ];
  if (unique.length === 0) return {};

  let rates = expandCryptoRatesMap(
    await fetchCryptoRatesRub(unique, { force: options?.force === true })
  );

  const missing = unique.filter((unit) => getCryptoRateFromMap(unit, rates) == null);
  for (const unit of missing) {
    const rate = await fetchMarketRateRub(unit, 'crypto');
    if (rate != null && rate > 0) {
      rates = expandCryptoRatesMap({ ...rates, [canonicalizeCryptoUnit(unit)]: rate });
    }
  }

  return rates;
}

type MoexMarketData = {
  marketdata?: {
    columns: string[];
    data: (string | number | null)[][];
  };
};

function readMoexField(row: (string | number | null)[], columns: string[], field: string) {
  const idx = columns.indexOf(field);
  if (idx < 0) return null;
  const value = Number(row[idx]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseMoexQuote(
  data: MoexMarketData,
  ticker: string
): { last: number | null; prevClose: number | null } {
  const columns = data.marketdata?.columns ?? [];
  const rows = data.marketdata?.data ?? [];
  const secIdx = columns.indexOf('SECID');
  const normalized = resolveMoexTicker(ticker);

  for (const row of rows) {
    const sec = normalizeStockTicker(String(row[secIdx] ?? ''));
    if (sec !== normalized && sec !== normalizeStockTicker(ticker)) continue;

    const last =
      readMoexField(row, columns, 'LAST') ??
      readMoexField(row, columns, 'LCURRENTPRICE') ??
      readMoexField(row, columns, 'MARKETPRICE');
    const prevClose = readMoexField(row, columns, 'PREVLEGALCLOSE');
    if (last != null || prevClose != null) {
      return { last, prevClose };
    }
  }

  return { last: null, prevClose: null };
}

function parseMoexPrice(data: MoexMarketData, ticker: string): number | null {
  const quote = parseMoexQuote(data, ticker);
  return quote.last ?? quote.prevClose;
}

export function readMoexPrevCloseRub(ticker: string): number | null {
  const normalized = normalizeStockTicker(ticker);
  const moex = resolveMoexTicker(ticker);
  const fromMemory = stockPrevCloseRub[moex] ?? stockPrevCloseRub[normalized] ?? null;
  if (fromMemory != null && fromMemory > 0) return fromMemory;
  // Переживает перезапуск приложения: вчерашнее закрытие из персистентного кэша.
  return (
    readCachedHistoricalRate(historicalCacheKey('stock', normalized, 1)) ??
    readCachedHistoricalRate(historicalCacheKey('stock', moex, 1)) ??
    null
  );
}

async function fetchMoexSpotQuote(
  moexSymbol: string,
  force?: boolean
): Promise<{ last: number | null; prevClose: number | null }> {
  const symbol = resolveMoexTicker(moexSymbol).toUpperCase();
  const bust = force ? `&_=${Date.now()}` : '';

  for (const board of MOEX_SPOT_BOARDS) {
    try {
      const data = await fetchJson<MoexMarketData>(
        `https://iss.moex.com/iss/engines/stock/markets/shares/boards/${board}/securities/${symbol}.json?iss.meta=off&iss.only=marketdata${bust}`
      );
      const quote = parseMoexQuote(data, symbol);
      if (quote.last != null && quote.last > 0) return quote;
    } catch (error) {
      console.warn(`fetchMoexSpotQuote ${board}/${symbol} failed`, error);
    }
  }

  try {
    const data = await fetchJson<MoexMarketData>(
      `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${symbol}.json?iss.meta=off&iss.only=marketdata${bust}`
    );
    return parseMoexQuote(data, symbol);
  } catch (error) {
    console.warn(`fetchMoexSpotQuote securities/${symbol} failed`, error);
    return { last: null, prevClose: null };
  }
}

async function fetchMoexSpotPrice(moexSymbol: string, force?: boolean): Promise<number | null> {
  const quote = await fetchMoexSpotQuote(moexSymbol, force);
  return quote.last ?? quote.prevClose;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function fetchMoexStockRatesRub(
  tickers: string[],
  options?: { force?: boolean }
): Promise<Record<string, number>> {
  const unique = [...new Set(tickers.map(normalizeStockTicker).filter(Boolean))];
  if (unique.length === 0) return {};

  const now = Date.now();
  const toFetch = options?.force
    ? unique
    : unique.filter((ticker) => {
        const cachedAt = stockCachedAt[ticker] ?? 0;
        const spotStale = cache.stockRub[ticker] == null || now - cachedAt >= STOCK_CACHE_TTL_MS;
        const prevMissing = readMoexPrevCloseRub(ticker) == null;
        return spotStale || prevMissing;
      });

  await mapWithConcurrency(toFetch, MOEX_SPOT_CONCURRENCY, async (unitTicker) => {
    try {
      const quote = await fetchMoexSpotQuote(unitTicker, options?.force);
      const fetchedAt = Date.now();
      const moexTicker = resolveMoexTicker(unitTicker);

      // Спот (LAST) обновляем только при наличии валидной цены.
      if (quote.last != null && quote.last > 0) {
        cache.stockRub[unitTicker] = quote.last;
        stockCachedAt[unitTicker] = fetchedAt;
        if (moexTicker !== unitTicker) {
          cache.stockRub[moexTicker] = quote.last;
          stockCachedAt[moexTicker] = fetchedAt;
        }
      }

      // Закрытие прошлого дня сохраняем ВСЕГДА, даже при закрытом рынке (нет LAST),
      // — это база для динамики «за сегодня».
      if (quote.prevClose != null && quote.prevClose > 0) {
        stockPrevCloseRub[unitTicker] = quote.prevClose;
        if (moexTicker !== unitTicker) {
          stockPrevCloseRub[moexTicker] = quote.prevClose;
        }
        storeHistoricalRate(historicalCacheKey('stock', unitTicker, 1), quote.prevClose);
        if (moexTicker !== unitTicker) {
          storeHistoricalRate(historicalCacheKey('stock', moexTicker, 1), quote.prevClose);
        }
      }
    } catch (error) {
      console.warn(`fetchMoexStockRatesRub ${unitTicker} failed`, error);
    }
  });

  if (toFetch.length > 0) {
    cache.fetchedAt = Date.now();
  }

  const result: Record<string, number> = {};
  for (const ticker of unique) {
    if (cache.stockRub[ticker] != null) result[ticker] = cache.stockRub[ticker];
  }
  return result;
}

function getCryptoCachedAt(unit: string): number {
  const canonical = canonicalizeCryptoUnit(unit);
  const normalized = normalizeCryptoUnit(unit);
  const id = resolveCoingeckoId(canonical) ?? resolveCoingeckoId(normalized);
  const keys = new Set<string>([canonical, normalized, unit]);
  if (id) keys.add(`$id:${id}`);

  let best = 0;
  for (const key of keys) {
    best = Math.max(best, cryptoCachedAt[key] ?? 0);
  }
  return best;
}

export function peekMarketRateRub(unit: string, assetType?: string): number | null {
  if (isCryptoMarketUnit(unit)) {
    const canonical = canonicalizeCryptoUnit(unit);
    const cachedAt = getCryptoCachedAt(unit);
    const rate = readCachedCryptoRate(canonical);
    if (rate != null && rate > 0 && Date.now() - cachedAt < CRYPTO_CACHE_TTL_MS) {
      return rate;
    }
    return null;
  }
  if (isFxUnit(unit)) {
    const rate = cache.fxRub[unit];
    if (rate != null && rate > 0 && isCacheFresh()) return rate;
    return null;
  }
  if (assetType === 'stocks') {
    const ticker = resolveMoexTicker(unit);
    const normalized = normalizeStockTicker(unit);
    const rate = cache.stockRub[ticker] ?? cache.stockRub[normalized];
    const cachedAt = stockCachedAt[ticker] ?? stockCachedAt[normalized] ?? 0;
    if (rate != null && rate > 0 && Date.now() - cachedAt < STOCK_CACHE_TTL_MS) {
      return rate;
    }
    return null;
  }
  return null;
}

export async function fetchMarketRateRub(
  unit: string,
  assetType?: string
): Promise<number | null> {
  const cached = peekMarketRateRub(unit, assetType);
  if (cached != null) return cached;

  if (isCryptoMarketUnit(unit)) {
    const canonical = canonicalizeCryptoUnit(unit);
    const rates = await fetchCryptoRatesRub([canonical]);
    return getCryptoRateFromMap(canonical, rates) ?? null;
  }
  if (isFxUnit(unit)) {
    const rates = await fetchFxRatesRub([unit]);
    return rates[unit] ?? null;
  }
  if (assetType === 'stocks') {
    const ticker = resolveMoexTicker(unit);
    const rates = await fetchMoexStockRatesRub([ticker], { force: true });
    return rates[ticker] ?? rates[normalizeStockTicker(unit)] ?? null;
  }
  return null;
}

function formatIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function formatCbrArchivePath(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

function formatCoingeckoHistoryDate(date: Date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

type CoingeckoMarketChart = {
  prices: [number, number][];
};

type CoingeckoHistory = {
  market_data?: {
    current_price?: { rub?: number; usd?: number };
  };
};

export function pickPriceAtDaysAgo(prices: [number, number][], daysAgo: number): number | null {
  if (prices.length === 0) return null;

  const targetMs = Date.now() - daysAgo * 86_400_000;
  let bestPrice: number | null = null;
  let bestDiff = Infinity;

  for (const [timestamp, price] of prices) {
    if (!Number.isFinite(price) || price <= 0) continue;
    const diff = Math.abs(timestamp - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestPrice = price;
    }
  }

  return bestPrice;
}

export async function fetchCryptoChartPricesRub(coingeckoId: string): Promise<[number, number][]> {
  const cached = getCachedCryptoChartPrices(coingeckoId);
  if (cached) return cached;

  const data = await fetchJsonWithRetry<CoingeckoMarketChart>(
    `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=rub&days=${COINGECKO_CHART_MAX_DAYS}`
  );
  const prices = data.prices ?? [];
  chartCache[chartCacheKey(coingeckoId)] = { fetchedAt: Date.now(), prices };
  return prices;
}

export async function prefetchCryptoHistoryCharts(coingeckoIds: string[]): Promise<void> {
  const unique = [...new Set(coingeckoIds.filter(Boolean))];
  const missing = unique.filter((id) => !getCachedCryptoChartPrices(id));
  await mapWithConcurrency(missing, PREFETCH_CONCURRENCY, async (id) => {
    try {
      await fetchCryptoChartPricesRub(id);
    } catch (error) {
      console.warn('prefetchCryptoHistoryCharts failed', id, error);
    }
  });
}

export function readHistoricalCryptoRatesRub(
  units: string[],
  daysAgo: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const unit of units) {
    const canonical = canonicalizeCryptoUnit(unit);
    const key = historicalCacheKey('crypto', canonical, daysAgo);
    const rate = readCachedHistoricalRate(key);
    if (rate != null && rate > 0) result[canonical] = rate;
  }
  return result;
}

/** Цена ~24 ч назад по графику CoinGecko — база для «за сегодня» у крипты. */
export function readCryptoIntradayPastRateRub(unit: string): number | null {
  const canonical = canonicalizeCryptoUnit(unit);
  const id = resolveCoingeckoId(canonical);
  if (id) {
    const chart = getCachedCryptoChartPrices(id);
    if (chart) {
      const fromChart = pickPriceAtDaysAgo(chart, 1);
      if (fromChart != null && fromChart > 0) {
        // Сохраняем базу «за сегодня», чтобы пережить перезапуск приложения.
        storeHistoricalRate(historicalCacheKey('crypto', canonical, 1), fromChart);
        return fromChart;
      }
    }
  }
  return readHistoricalCryptoRatesRub([canonical], 1)[canonical] ?? null;
}

export async function fetchHistoricalCryptoRatesRub(
  units: string[],
  daysAgo: number
): Promise<Record<string, number>> {
  await prefetchMarketHistoryForPeriod(units, [], daysAgo);
  return readHistoricalCryptoRatesRub(units, daysAgo);
}

type MoexCandles = {
  candles?: {
    columns: string[];
    data: (string | number | null)[][];
  };
};

function parseMoexCandlesRows(data: MoexCandles): MoexHistoryRow[] {
  const columns = data.candles?.columns ?? [];
  const rows = data.candles?.data ?? [];
  const beginIdx = columns.indexOf('begin');
  const closeIdx = columns.indexOf('close');
  const result: MoexHistoryRow[] = [];

  for (const row of rows) {
    const begin = String(row[beginIdx] ?? '');
    const tradeDate = begin.slice(0, 10);
    const close = Number(row[closeIdx]);
    if (tradeDate && Number.isFinite(close) && close > 0) {
      result.push({ tradeDate, close });
    }
  }

  return result;
}

function dedupeMoexRowsSorted(rows: MoexHistoryRow[]): MoexHistoryRow[] {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    byDate.set(row.tradeDate, row.close);
  }
  return [...byDate.entries()]
    .map(([tradeDate, close]) => ({ tradeDate, close }))
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
}

function pickMoexPriceAtDaysAgo(rows: MoexHistoryRow[], daysAgo: number): number | null {
  if (rows.length === 0) return null;

  const targetDate = formatIsoDateLocal(dateDaysAgo(daysAgo));
  let best: MoexHistoryRow | null = null;

  for (const row of rows) {
    if (row.tradeDate <= targetDate) {
      best = row;
    } else {
      break;
    }
  }

  return best?.close ?? null;
}

function readCachedHistoricalRate(key: string): number | null {
  const mem = historicalRateMemory[key];
  if (mem && Date.now() - mem.fetchedAt < IN_MEMORY_HISTORICAL_TTL_MS) {
    return mem.rate;
  }
  return readPersistedHistoricalRate(key);
}

function storeHistoricalRate(key: string, rate: number) {
  historicalRateMemory[key] = { rate, fetchedAt: Date.now() };
  writePersistedHistoricalRate(key, rate);
}

type MoexIssHistory = {
  history?: {
    columns: string[];
    data: (string | number | null)[][];
  };
};

function parseMoexHistoryCloseRows(data: MoexIssHistory): MoexHistoryRow[] {
  const columns = data.history?.columns ?? [];
  const rows = data.history?.data ?? [];
  const dateIdx = columns.indexOf('TRADEDATE');
  const closeIdx = columns.indexOf('CLOSE');
  const legalIdx = columns.indexOf('LEGALCLOSEPRICE');
  const result: MoexHistoryRow[] = [];

  for (const row of rows) {
    const tradeDate = String(row[dateIdx] ?? '').slice(0, 10);
    const close = Number(row[closeIdx] ?? row[legalIdx]);
    if (tradeDate && Number.isFinite(close) && close > 0) {
      result.push({ tradeDate, close });
    }
  }

  return dedupeMoexRowsSorted(result);
}

async function fetchMoexHistoricalRateForDaysAgo(
  ticker: string,
  daysAgo: number
): Promise<number | null> {
  const normalized = normalizeStockTicker(ticker);
  const cacheKey = historicalCacheKey('stock', normalized, daysAgo);
  const cached = readCachedHistoricalRate(cacheKey);
  if (cached != null) return cached;

  const target = dateDaysAgo(daysAgo);
  const from = dateDaysAgo(daysAgo + 12);
  const till = dateDaysAgo(Math.max(0, daysAgo - 1));

  try {
    const data = await fetchJson<MoexIssHistory>(
      `https://iss.moex.com/iss/history/engines/stock/markets/shares/securities/${normalized.toUpperCase()}.json?from=${formatIsoDateLocal(from)}&till=${formatIsoDateLocal(till)}&iss.meta=off`
    );
    const rows = parseMoexHistoryCloseRows(data);
    const rate = pickMoexPriceAtDaysAgo(rows, daysAgo);
    if (rate != null && rate > 0) {
      storeHistoricalRate(cacheKey, rate);
      return rate;
    }
  } catch (error) {
    console.warn('fetchMoexHistoricalRateForDaysAgo failed', normalized, daysAgo, error);
  }

  return null;
}

async function fetchCryptoHistoricalRateForDaysAgo(
  unit: string,
  daysAgo: number
): Promise<number | null> {
  const canonical = canonicalizeCryptoUnit(unit);
  const cacheKey = historicalCacheKey('crypto', canonical, daysAgo);
  const cached = readCachedHistoricalRate(cacheKey);
  if (cached != null) return cached;

  const id = resolveCoingeckoId(canonical);
  if (!id) return null;

  const historyDate = formatCoingeckoHistoryDate(dateDaysAgo(daysAgo));
  try {
    const data = await fetchJsonWithRetry<CoingeckoHistory>(
      `https://api.coingecko.com/api/v3/coins/${id}/history?date=${historyDate}`
    );
    const rub = data.market_data?.current_price?.rub;
    if (rub != null && rub > 0) {
      storeHistoricalRate(cacheKey, rub);
      return rub;
    }

    const usd = data.market_data?.current_price?.usd;
    if (usd != null && usd > 0) {
      const fx = await fetchFxRatesRub(['usd']);
      const usdRub = fx.usd;
      if (usdRub != null && usdRub > 0) {
        const rate = usd * usdRub;
        storeHistoricalRate(cacheKey, rate);
        return rate;
      }
    }
  } catch (error) {
    console.warn('fetchCryptoHistoricalRateForDaysAgo failed', unit, daysAgo, error);
  }

  return null;
}

export async function prefetchMarketHistoryForPeriod(
  cryptoUnits: string[],
  stockTickers: string[],
  daysAgo: number,
  onProgress?: () => void
): Promise<void> {
  await ensureHistoricalCacheHydrated();

  const crypto = [...new Set(cryptoUnits.filter(isCryptoMarketUnit))];
  const stocks = [...new Set(stockTickers.map(normalizeStockTicker).filter(Boolean))];

  const jobs: Array<{ kind: 'crypto' | 'stock'; id: string }> = [
    ...crypto.map((unit) => ({ kind: 'crypto' as const, id: unit })),
    ...stocks.map((ticker) => ({ kind: 'stock' as const, id: ticker })),
  ].filter((job) => {
    const key = historicalCacheKey(job.kind, job.id, daysAgo);
    return readCachedHistoricalRate(key) == null;
  });

  if (jobs.length === 0) return;

  await mapWithConcurrency(jobs, HISTORICAL_FETCH_CONCURRENCY, async (job) => {
    try {
      if (job.kind === 'crypto') {
        await fetchCryptoHistoricalRateForDaysAgo(job.id, daysAgo);
      } else {
        await fetchMoexHistoricalRateForDaysAgo(job.id, daysAgo);
      }
    } catch (error) {
      console.warn('prefetchMarketHistoryForPeriod failed', job, error);
    } finally {
      onProgress?.();
    }
  });
}

async function fetchMoexHistoryChart(ticker: string): Promise<MoexHistoryRow[]> {
  const normalized = normalizeStockTicker(ticker);
  const cached = moexHistoryCache[normalized];
  if (cached && Date.now() - cached.fetchedAt < CHART_CACHE_TTL_MS) {
    return cached.rows;
  }

  const from = dateDaysAgo(COINGECKO_CHART_MAX_DAYS + 10);
  const till = new Date();
  const collected: MoexHistoryRow[] = [];
  let start = 0;
  const pageSize = 500;

  while (start < 2000) {
    const data = await fetchJson<MoexCandles>(
      `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${normalized.toUpperCase()}/candles.json?from=${formatIsoDateLocal(from)}&till=${formatIsoDateLocal(till)}&interval=24&iss.meta=off&start=${start}`
    );
    const batch = parseMoexCandlesRows(data);
    if (batch.length === 0) break;
    collected.push(...batch);
    if (batch.length < pageSize) break;
    start += batch.length;
  }

  const rows = dedupeMoexRowsSorted(collected);
  moexHistoryCache[normalized] = { fetchedAt: Date.now(), rows };
  return rows;
}

export async function prefetchMoexHistoryCharts(tickers: string[]): Promise<void> {
  const unique = [...new Set(tickers.map(normalizeStockTicker).filter(Boolean))];
  const missing = unique.filter((ticker) => {
    const cached = moexHistoryCache[ticker];
    return !cached || Date.now() - cached.fetchedAt >= CHART_CACHE_TTL_MS;
  });

  await mapWithConcurrency(missing, HISTORICAL_FETCH_CONCURRENCY, async (ticker) => {
    try {
      await fetchMoexHistoryChart(ticker);
    } catch (error) {
      console.warn('prefetchMoexHistoryCharts failed', ticker, error);
    }
  });
}

export function readHistoricalStockRatesRub(
  tickers: string[],
  daysAgo: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const ticker of tickers) {
    const normalized = normalizeStockTicker(ticker);
    const key = historicalCacheKey('stock', normalized, daysAgo);
    const rate = readCachedHistoricalRate(key);
    if (rate != null && rate > 0) result[normalized] = rate;
  }
  return result;
}

/** @deprecated Используйте prefetchMarketHistoryForPeriod — один лёгкий запрос на период. */
export async function prefetchMarketHistoryCharts(
  cryptoUnits: string[],
  stockTickers: string[],
  daysAgo = 7
): Promise<void> {
  await prefetchMarketHistoryForPeriod(cryptoUnits, stockTickers, daysAgo);
}

async function fetchHistoricalMarketRateRubForDate(
  unit: string,
  assetType: string | undefined,
  date: Date
): Promise<number | null> {
  if (isCryptoMarketUnit(unit)) {
    const daysAgo = Math.max(1, Math.round((Date.now() - date.getTime()) / 86_400_000));
    try {
      const rate = await fetchCryptoHistoricalRateForDaysAgo(unit, daysAgo);
      if (rate != null && rate > 0) return rate;
    } catch {
      // legacy chart fallback below
    }

    const id = resolveCoingeckoId(unit);
    if (!id) return null;
    const cached = getCachedCryptoChartPrices(id);
    if (cached) {
      const fromChart = pickPriceAtDaysAgo(cached, daysAgo);
      if (fromChart != null && fromChart > 0) return fromChart;
    }

    const historyDate = formatCoingeckoHistoryDate(date);
    const data = await fetchJsonWithRetry<CoingeckoHistory>(
      `https://api.coingecko.com/api/v3/coins/${id}/history?date=${historyDate}`
    );
    const rub = data.market_data?.current_price?.rub;
    if (rub != null && rub > 0) return rub;

    const usd = data.market_data?.current_price?.usd;
    if (usd != null && usd > 0) {
      const fx = await fetchFxRatesRub(['usd']);
      const usdRub = fx.usd;
      if (usdRub != null && usdRub > 0) return usd * usdRub;
    }

    return null;
  }

  if (isFxUnit(unit)) {
    const path = formatCbrArchivePath(date);
    const data = await fetchJson<CbrDailyJson>(
      `https://www.cbr-xml-daily.ru/archive/${path}/daily_json.js`
    );
    const code = getCbrCode(unit);
    const row = data.Valute?.[code];
    if (!row?.Nominal) return null;
    return row.Value / row.Nominal;
  }

  if (assetType === 'stocks') {
    const normalized = normalizeStockTicker(unit);
    try {
      const rate = await fetchMoexHistoricalRateForDaysAgo(
        normalized,
        Math.max(1, Math.round((Date.now() - date.getTime()) / 86_400_000))
      );
      if (rate != null && rate > 0) return rate;
    } catch (error) {
      console.warn('fetchHistoricalMarketRateRubForDate stocks failed', normalized, error);
    }
  }

  return null;
}

export async function fetchHistoricalMarketRateRub(
  unit: string,
  assetType: string | undefined,
  daysAgo = 7
): Promise<number | null> {
  const offsets = [daysAgo, daysAgo + 1, daysAgo - 1, daysAgo + 2, daysAgo - 2, daysAgo + 3];

  for (const offset of offsets) {
    if (offset < 1) continue;
    try {
      const rate = await fetchHistoricalMarketRateRubForDate(
        unit,
        assetType,
        dateDaysAgo(offset)
      );
      if (rate != null && rate > 0) return rate;
    } catch (error) {
      console.warn('fetchHistoricalMarketRateRub failed', unit, offset, error);
    }
  }

  return null;
}

export function clearMarketRatesCache() {
  cache = { fetchedAt: 0, cryptoRub: {}, fxRub: {}, stockRub: {} };
  for (const key of Object.keys(cryptoCachedAt)) {
    delete cryptoCachedAt[key];
  }
  for (const key of Object.keys(stockCachedAt)) {
    delete stockCachedAt[key];
  }
  for (const key of Object.keys(chartCache)) {
    delete chartCache[key];
  }
  for (const key of Object.keys(moexHistoryCache)) {
    delete moexHistoryCache[key];
  }
  for (const key of Object.keys(historicalRateMemory)) {
    delete historicalRateMemory[key];
  }
  clearPersistedHistoricalCache();
}
