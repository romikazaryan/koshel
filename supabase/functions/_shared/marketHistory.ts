/** Исторические цены MOEX / CoinGecko для Edge Functions. */

export const METRIC_PERIODS_DAYS = [1, 365] as const

const COINGECKO_IDS: Record<string, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  usdt: 'tether',
  ton: 'the-open-network',
  sol: 'solana',
  bnb: 'binancecoin',
  xrp: 'ripple',
  ada: 'cardano',
  doge: 'dogecoin',
  avax: 'avalanche-2',
  link: 'chainlink',
  render: 'render-token',
  ltc: 'litecoin',
  trx: 'tron',
  uni: 'uniswap',
  shib: 'shiba-inu',
  dot: 'polkadot',
  near: 'near',
}

const COINGECKO_ID_TO_CRYPTO = Object.fromEntries(
  Object.entries(COINGECKO_IDS).map(([unit, id]) => [id, unit])
) as Record<string, string>

type MoexHistoryRow = { tradeDate: string; close: number }

function normalizeStockTicker(value: string) {
  return value.trim().toLowerCase().replace(/\.me$/i, '')
}

function normalizeCryptoUnit(unit: string): string {
  const trimmed = unit.trim().toLowerCase()
  if (trimmed in COINGECKO_IDS) return trimmed
  if (trimmed.startsWith('cg:')) return trimmed
  if (trimmed in COINGECKO_ID_TO_CRYPTO) return COINGECKO_ID_TO_CRYPTO[trimmed]
  return trimmed
}

export function canonicalizeCryptoUnit(unit: string): string {
  const normalized = normalizeCryptoUnit(unit)
  if (normalized in COINGECKO_IDS) return normalized
  const id = resolveCoingeckoId(normalized)
  if (id && id in COINGECKO_ID_TO_CRYPTO) return COINGECKO_ID_TO_CRYPTO[id]
  return normalized
}

function resolveCoingeckoId(unit: string): string | null {
  const normalized = normalizeCryptoUnit(unit)
  if (normalized in COINGECKO_IDS) return COINGECKO_IDS[normalized]
  if (!normalized.startsWith('cg:')) return null
  const body = normalized.slice(3)
  const [id] = body.split(':')
  return id || null
}

function formatIsoDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dateDaysAgo(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date
}

function formatCoingeckoHistoryDate(date: Date) {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}-${m}-${y}`
}

async function fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

function dedupeMoexRowsSorted(rows: MoexHistoryRow[]): MoexHistoryRow[] {
  const byDate = new Map<string, number>()
  for (const row of rows) {
    byDate.set(row.tradeDate, row.close)
  }
  return [...byDate.entries()]
    .map(([tradeDate, close]) => ({ tradeDate, close }))
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
}

function pickMoexPriceAtDaysAgo(rows: MoexHistoryRow[], daysAgo: number): number | null {
  if (rows.length === 0) return null
  const targetDate = formatIsoDateLocal(dateDaysAgo(daysAgo))
  let best: MoexHistoryRow | null = null
  for (const row of rows) {
    if (row.tradeDate <= targetDate) best = row
    else break
  }
  return best?.close ?? null
}

type MoexIssHistory = {
  history?: {
    columns: string[]
    data: (string | number | null)[][]
  }
}

function parseMoexHistoryCloseRows(data: MoexIssHistory): MoexHistoryRow[] {
  const columns = data.history?.columns ?? []
  const rows = data.history?.data ?? []
  const dateIdx = columns.indexOf('TRADEDATE')
  const closeIdx = columns.indexOf('CLOSE')
  const legalIdx = columns.indexOf('LEGALCLOSEPRICE')
  const result: MoexHistoryRow[] = []

  for (const row of rows) {
    const tradeDate = String(row[dateIdx] ?? '').slice(0, 10)
    const close = Number(row[closeIdx] ?? row[legalIdx])
    if (tradeDate && Number.isFinite(close) && close > 0) {
      result.push({ tradeDate, close })
    }
  }
  return dedupeMoexRowsSorted(result)
}

const moexRateCache = new Map<string, number>()
const moexSpotCache = new Map<string, number>()
const moexPrevCloseCache = new Map<string, number>()


type MoexMarketData = {
  marketdata?: {
    columns: string[]
    data: (string | number | null)[][]
  }
}

function parseMoexSpotQuote(
  data: MoexMarketData,
  ticker: string
): { last: number | null; prevClose: number | null } {
  const columns = data.marketdata?.columns ?? []
  const rows = data.marketdata?.data ?? []
  const secIdx = columns.indexOf('SECID')
  const normalized = normalizeStockTicker(ticker)

  const readField = (row: (string | number | null)[], field: string) => {
    const idx = columns.indexOf(field)
    if (idx < 0) return null
    const value = Number(row[idx])
    return Number.isFinite(value) && value > 0 ? value : null
  }

  const readRow = (row: (string | number | null)[]) => {
    const last =
      readField(row, 'LAST') ??
      readField(row, 'LCURRENTPRICE') ??
      readField(row, 'MARKETPRICE')
    const prevClose = readField(row, 'PREVLEGALCLOSE')
    return { last, prevClose }
  }

  for (const row of rows) {
    const sec = normalizeStockTicker(String(row[secIdx] ?? ''))
    if (sec === normalized) {
      const quote = readRow(row)
      if (quote.last != null || quote.prevClose != null) return quote
    }
  }

  for (const row of rows) {
    const quote = readRow(row)
    if (quote.last != null || quote.prevClose != null) return quote
  }

  return { last: null, prevClose: null }
}

function parseMoexSpotPrice(data: MoexMarketData, ticker: string): number | null {
  const quote = parseMoexSpotQuote(data, ticker)
  return quote.last ?? quote.prevClose
}

export async function fetchMoexSpotRateRub(ticker: string): Promise<number | null> {
  const normalized = normalizeStockTicker(ticker)
  const cached = moexSpotCache.get(normalized)
  if (cached != null) return cached

  try {
    const data = await fetchJson<MoexMarketData>(
      `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${normalized.toUpperCase()}.json?iss.meta=off&iss.only=marketdata`
    )
    const quote = parseMoexSpotQuote(data, normalized)
    if (quote.last != null && quote.last > 0) {
      moexSpotCache.set(normalized, quote.last)
    }
    if (quote.prevClose != null && quote.prevClose > 0) {
      moexPrevCloseCache.set(normalized, quote.prevClose)
    }
    return quote.last ?? quote.prevClose
  } catch (error) {
    console.warn('fetchMoexSpotRateRub failed', normalized, error)
  }
  return null
}

export async function prefetchMoexSpotRates(tickers: string[]): Promise<void> {
  const unique = [...new Set(tickers.map(normalizeStockTicker).filter(Boolean))]
  await mapWithConcurrency(unique, 12, async (ticker) => {
    await fetchMoexSpotRateRub(ticker)
  })
}

export function readCachedMoexSpotRate(ticker: string): number | null {
  return moexSpotCache.get(normalizeStockTicker(ticker)) ?? null
}

export function readCachedMoexPrevClose(ticker: string): number | null {
  return moexPrevCloseCache.get(normalizeStockTicker(ticker)) ?? null
}

export async function fetchMoexHistoricalRateRub(
  ticker: string,
  daysAgo: number
): Promise<number | null> {
  const normalized = normalizeStockTicker(ticker)
  const cacheKey = `${normalized}:${daysAgo}`
  const cached = moexRateCache.get(cacheKey)
  if (cached != null) return cached

  const from = dateDaysAgo(daysAgo + 12)
  const till = dateDaysAgo(Math.max(0, daysAgo - 1))

  try {
    const data = await fetchJson<MoexIssHistory>(
      `https://iss.moex.com/iss/history/engines/stock/markets/shares/securities/${normalized.toUpperCase()}.json?from=${formatIsoDateLocal(from)}&till=${formatIsoDateLocal(till)}&iss.meta=off`
    )
    const rate = pickMoexPriceAtDaysAgo(parseMoexHistoryCloseRows(data), daysAgo)
    if (rate != null && rate > 0) {
      moexRateCache.set(cacheKey, rate)
      return rate
    }
  } catch (error) {
    console.warn('fetchMoexHistoricalRateRub failed', normalized, daysAgo, error)
  }
  return null
}

type CoingeckoHistory = {
  market_data?: { current_price?: { rub?: number; usd?: number } }
}

type CbrDailyJson = {
  Valute?: Record<string, { Value: number; Nominal: number }>
}

async function fetchUsdRub(): Promise<number | null> {
  try {
    const data = await fetchJson<CbrDailyJson>('https://www.cbr-xml-daily.ru/daily_json.js')
    const row = data.Valute?.USD
    if (!row?.Nominal) return null
    return row.Value / row.Nominal
  } catch {
    return null
  }
}

const cryptoRateCache = new Map<string, number>()

export async function fetchCryptoHistoricalRateRub(
  unit: string,
  daysAgo: number
): Promise<number | null> {
  const canonical = canonicalizeCryptoUnit(unit)
  const cacheKey = `${canonical}:${daysAgo}`
  const cached = cryptoRateCache.get(cacheKey)
  if (cached != null) return cached

  const id = resolveCoingeckoId(canonical)
  if (!id) return null

  const historyDate = formatCoingeckoHistoryDate(dateDaysAgo(daysAgo))
  try {
    const data = await fetchJson<CoingeckoHistory>(
      `https://api.coingecko.com/api/v3/coins/${id}/history?date=${historyDate}`
    )
    const rub = data.market_data?.current_price?.rub
    if (rub != null && rub > 0) {
      cryptoRateCache.set(cacheKey, rub)
      return rub
    }
    const usd = data.market_data?.current_price?.usd
    if (usd != null && usd > 0) {
      const usdRub = await fetchUsdRub()
      if (usdRub != null && usdRub > 0) {
        const rate = usd * usdRub
        cryptoRateCache.set(cacheKey, rate)
        return rate
      }
    }
  } catch (error) {
    console.warn('fetchCryptoHistoricalRateRub failed', unit, daysAgo, error)
  }
  return null
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  if (items.length === 0) return
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index]
      index += 1
      await worker(current)
    }
  })
  await Promise.all(runners)
}

export type HistoricalRateKey = {
  kind: 'stock' | 'crypto'
  unit: string
  daysAgo: number
}

export async function prefetchHistoricalRates(keys: HistoricalRateKey[]): Promise<void> {
  const unique = new Map<string, HistoricalRateKey>()
  for (const key of keys) {
    unique.set(`${key.kind}:${key.unit}:${key.daysAgo}`, key)
  }
  await mapWithConcurrency([...unique.values()], 12, async (key) => {
    if (key.kind === 'stock') {
      await fetchMoexHistoricalRateRub(key.unit, key.daysAgo)
    } else {
      await fetchCryptoHistoricalRateRub(key.unit, key.daysAgo)
    }
  })
}

export function readCachedHistoricalRate(
  kind: 'stock' | 'crypto',
  unit: string,
  daysAgo: number
): number | null {
  if (kind === 'stock') {
    return moexRateCache.get(`${normalizeStockTicker(unit)}:${daysAgo}`) ?? null
  }
  return cryptoRateCache.get(`${canonicalizeCryptoUnit(unit)}:${daysAgo}`) ?? null
}
