import {
  type FxUnit,
  getCbrCode,
  isCryptoMarketUnit,
  isFxUnit,
  normalizeStockTicker,
  resolveCoingeckoId,
} from '../constants/marketUnits';

const CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;
const MOEX_PRICE_FIELDS = ['LAST', 'LCURRENTPRICE', 'MARKETPRICE', 'PREVLEGALCLOSE'] as const;

type RateCache = {
  fetchedAt: number;
  cryptoRub: Record<string, number>;
  fxRub: Partial<Record<FxUnit, number>>;
  stockRub: Record<string, number>;
};

let cache: RateCache = { fetchedAt: 0, cryptoRub: {}, fxRub: {}, stockRub: {} };

function isCacheFresh() {
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
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

type CoinGeckoPrice = Record<string, { rub?: number }>;

export async function fetchCryptoRatesRub(units: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(units.filter(isCryptoMarketUnit))];
  if (unique.length === 0) return {};

  const missing = unique.filter((unit) => cache.cryptoRub[unit] == null);
  if (missing.length === 0 && isCacheFresh()) {
    return pickCrypto(unique);
  }

  const toResolve = missing.length > 0 ? missing : unique;
  const ids = [...new Set(toResolve.map((unit) => resolveCoingeckoId(unit)).filter(Boolean))].join(
    ','
  );
  if (!ids) return pickCrypto(unique);

  const data = await fetchJson<CoinGeckoPrice>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=rub`
  );

  for (const unit of toResolve) {
    const id = resolveCoingeckoId(unit);
    if (!id) continue;
    const rub = data[id]?.rub;
    if (rub != null && rub > 0) {
      cache.cryptoRub[unit] = rub;
    }
  }

  cache.fetchedAt = Date.now();
  return pickCrypto(unique);
}

function pickCrypto(units: string[]) {
  const result: Record<string, number> = {};
  for (const unit of units) {
    if (cache.cryptoRub[unit] != null) result[unit] = cache.cryptoRub[unit];
  }
  return result;
}

type MoexMarketData = {
  marketdata?: {
    columns: string[];
    data: (string | number | null)[][];
  };
};

function parseMoexPrice(data: MoexMarketData, ticker: string): number | null {
  const columns = data.marketdata?.columns ?? [];
  const rows = data.marketdata?.data ?? [];
  const secIdx = columns.indexOf('SECID');
  const normalized = normalizeStockTicker(ticker);

  const readRow = (row: (string | number | null)[]) => {
    for (const field of MOEX_PRICE_FIELDS) {
      const idx = columns.indexOf(field);
      if (idx < 0) continue;
      const value = Number(row[idx]);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
  };

  for (const row of rows) {
    const sec = normalizeStockTicker(String(row[secIdx] ?? ''));
    if (sec === normalized) {
      const price = readRow(row);
      if (price != null) return price;
    }
  }

  for (const row of rows) {
    const price = readRow(row);
    if (price != null) return price;
  }

  return null;
}

export async function fetchMoexStockRatesRub(
  tickers: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(tickers.map(normalizeStockTicker).filter(Boolean))];
  if (unique.length === 0) return {};

  const missing = unique.filter((ticker) => cache.stockRub[ticker] == null);
  const toFetch = missing.length > 0 ? missing : isCacheFresh() ? [] : unique;

  await Promise.all(
    toFetch.map(async (ticker) => {
      try {
        const symbol = ticker.toUpperCase();
        const data = await fetchJson<MoexMarketData>(
          `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${symbol}.json?iss.meta=off&iss.only=marketdata`
        );
        const price = parseMoexPrice(data, ticker);
        if (price != null && price > 0) {
          cache.stockRub[ticker] = price;
        }
      } catch (error) {
        console.warn(`fetchMoexStockRatesRub ${ticker} failed`, error);
      }
    })
  );

  if (toFetch.length > 0) {
    cache.fetchedAt = Date.now();
  }

  const result: Record<string, number> = {};
  for (const ticker of unique) {
    if (cache.stockRub[ticker] != null) result[ticker] = cache.stockRub[ticker];
  }
  return result;
}

export async function fetchMarketRateRub(
  unit: string,
  assetType?: string
): Promise<number | null> {
  if (isCryptoMarketUnit(unit)) {
    const rates = await fetchCryptoRatesRub([unit]);
    return rates[unit] ?? null;
  }
  if (isFxUnit(unit)) {
    const rates = await fetchFxRatesRub([unit]);
    return rates[unit] ?? null;
  }
  if (assetType === 'stocks') {
    const ticker = normalizeStockTicker(unit);
    const rates = await fetchMoexStockRatesRub([ticker]);
    return rates[ticker] ?? null;
  }
  return null;
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

type CoingeckoHistory = {
  market_data?: {
    current_price?: { rub?: number };
  };
};

type MoexHistory = {
  history?: {
    columns: string[];
    data: (string | number | null)[][];
  };
};

const MOEX_HISTORY_FIELDS = ['CLOSE', 'LEGALCLOSE', 'MARKETPRICE', 'WAPRICE'] as const;

function parseMoexHistoryClose(data: MoexHistory): number | null {
  const columns = data.history?.columns ?? [];
  const rows = data.history?.data ?? [];
  if (rows.length === 0) return null;

  const row = rows[rows.length - 1];
  for (const field of MOEX_HISTORY_FIELDS) {
    const idx = columns.indexOf(field);
    if (idx < 0) continue;
    const value = Number(row[idx]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

async function fetchHistoricalMarketRateRubForDate(
  unit: string,
  assetType: string | undefined,
  date: Date
): Promise<number | null> {
  if (isCryptoMarketUnit(unit)) {
    const id = resolveCoingeckoId(unit);
    if (!id) return null;
    const historyDate = formatCoingeckoHistoryDate(date);
    const data = await fetchJson<CoingeckoHistory>(
      `https://api.coingecko.com/api/v3/coins/${id}/history?date=${historyDate}`
    );
    const rub = data.market_data?.current_price?.rub;
    return rub != null && rub > 0 ? rub : null;
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
    const ticker = normalizeStockTicker(unit).toUpperCase();
    const day = date.toISOString().slice(0, 10);
    const data = await fetchJson<MoexHistory>(
      `https://iss.moex.com/iss/history/engines/stock/markets/shares/securities/${ticker}.json?from=${day}&till=${day}&iss.meta=off`
    );
    return parseMoexHistoryClose(data);
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
}
