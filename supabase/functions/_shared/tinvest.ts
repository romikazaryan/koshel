const TINVEST_REST_BASE = 'https://invest-public-api.tbank.ru/rest'

import { getTinvestHttpClient } from './russianCaCerts.ts'

export type TinvestMoney = {
  currency?: string
  units?: string
  nano?: number
}

export type TinvestAccount = {
  id?: string
  name?: string
  type?: string
  status?: string
}

export type TinvestPortfolioPosition = {
  figi?: string
  ticker?: string
  instrumentType?: string
  instrumentUid?: string
  quantity?: TinvestMoney | { units?: string; nano?: number }
  currentPrice?: TinvestMoney
  averagePositionPrice?: TinvestMoney
  currentNkd?: TinvestMoney
}

/** REST может отдавать camelCase или snake_case. */
export function normalizePortfolioPosition(raw: Record<string, unknown>): TinvestPortfolioPosition {
  return {
    figi: (raw.figi as string | undefined) ?? undefined,
    ticker: (raw.ticker as string | undefined) ?? undefined,
    instrumentType: (raw.instrumentType ?? raw.instrument_type) as string | undefined,
    instrumentUid: (raw.instrumentUid ?? raw.instrument_uid) as string | undefined,
    quantity: (raw.quantity ?? raw.quantity_lots) as TinvestPortfolioPosition['quantity'],
    currentPrice: (raw.currentPrice ?? raw.current_price) as TinvestMoney | undefined,
    averagePositionPrice: (raw.averagePositionPrice ??
      raw.average_position_price) as TinvestMoney | undefined,
    currentNkd: (raw.currentNkd ?? raw.current_nkd) as TinvestMoney | undefined,
  }
}

export function normalizePortfolioResponse(raw: Record<string, unknown>): {
  totalAmount?: TinvestMoney
  positions?: TinvestPortfolioPosition[]
} {
  const totalAmount = (raw.totalAmount ?? raw.total_amount) as TinvestMoney | undefined
  const rawPositions = raw.positions
  const positions = Array.isArray(rawPositions)
    ? rawPositions.map((p) => normalizePortfolioPosition(p as Record<string, unknown>))
    : []
  return { totalAmount, positions }
}

export type TinvestOperation = {
  id?: string
  parentOperationId?: string
  date?: string
  type?: string
  operationType?: string
  state?: string
  payment?: TinvestMoney
  price?: TinvestMoney
  quantity?: number
  figi?: string
  instrumentType?: string
  description?: string
  name?: string
}

export function moneyToNumber(value?: TinvestMoney | null): number {
  if (!value) return 0
  const units = Number(value.units ?? 0)
  const nano = Number(value.nano ?? 0)
  if (!Number.isFinite(units) || !Number.isFinite(nano)) return 0
  return units + nano / 1_000_000_000
}

export function quantityToNumber(value?: TinvestPortfolioPosition['quantity']): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  return moneyToNumber(value as TinvestMoney)
}

export async function tinvestPost<T>(
  token: string,
  method: string,
  body: Record<string, unknown> = {},
  timeoutMs = 12_000
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${TINVEST_REST_BASE}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      client: getTinvestHttpClient(),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`T-Invest ${response.status}: ${text.slice(0, 240)}`)
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('T-Invest API timeout')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchTinvestAccounts(token: string): Promise<TinvestAccount[]> {
  const data = await tinvestPost<{ accounts?: TinvestAccount[] }>(
    token,
    'tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts',
    { status: 'ACCOUNT_STATUS_OPEN' }
  )
  return data.accounts ?? []
}

export async function fetchTinvestPortfolio(
  token: string,
  accountId: string
): Promise<{ totalAmount?: TinvestMoney; positions?: TinvestPortfolioPosition[] }> {
  const raw = await tinvestPost<Record<string, unknown>>(
    token,
    'tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio',
    { accountId, currency: 'RUB' }
  )
  return normalizePortfolioResponse(raw)
}

export async function fetchTinvestOperations(
  token: string,
  accountId: string,
  fromIso: string,
  cursor?: string
): Promise<{ items?: TinvestOperation[]; nextCursor?: string; hasNext?: boolean }> {
  const data = await tinvestPost<{
    items?: TinvestOperation[]
    nextCursor?: string
    hasNext?: boolean
  }>(token, 'tinkoff.public.invest.api.contract.v1.OperationsService/GetOperationsByCursor', {
    accountId,
    from: fromIso,
    to: new Date().toISOString(),
    limit: 500,
    cursor: cursor ?? undefined,
    state: 'OPERATION_STATE_EXECUTED',
    withoutTrades: true,
    withoutOvernights: true,
  })
  return data
}

const TINVEST_CURRENCY_TICKERS: Record<string, string> = {
  rub: 'rub',
  usd000utstom: 'usd',
  usd000utstm: 'usd',
  eur000utstom: 'eur',
  eur000utstm: 'eur',
  cny000000rub: 'cny',
  cnyrub_tom: 'cny',
  gbp000utstom: 'gbp',
  chf000utstom: 'chf',
  hkd000utstom: 'hkd',
  jpy000utstom: 'jpy',
}

const FX_DISPLAY_NAMES: Record<string, string> = {
  usd: 'Доллар США',
  eur: 'Евро',
  cny: 'Юань',
  rub: 'Рубли',
  gbp: 'Фунт стерлингов',
  chf: 'Швейцарский франк',
  hkd: 'Гонконгский доллар',
  jpy: 'Иена',
}

export function resolveTinvestCurrencyUnit(
  ticker: string,
  moneyCurrency?: string
): string {
  const lower = ticker.trim().toLowerCase()
  if (lower in TINVEST_CURRENCY_TICKERS) return TINVEST_CURRENCY_TICKERS[lower]

  const fromMoney = moneyCurrency?.trim().toLowerCase()
  if (fromMoney && fromMoney in FX_DISPLAY_NAMES) return fromMoney

  const prefix = lower.match(/^(usd|eur|cny|gbp|chf|hkd|jpy|rub)/)?.[1]
  if (prefix) return prefix

  return lower
}

export function getFxDisplayName(unit: string): string {
  const normalized = unit.trim().toLowerCase()
  return FX_DISPLAY_NAMES[normalized] ?? normalized.toUpperCase()
}

export function mapInstrumentAssetType(
  instrumentType?: string
): 'stocks' | 'cash' | 'bonds' | 'other' {
  const t = (instrumentType ?? '').toLowerCase()
  if (t.includes('bond')) return 'bonds'
  if (t.includes('share') || t.includes('etf') || t === 'stock') return 'stocks'
  if (t.includes('currency')) return 'cash'
  return 'other'
}

export type TinvestInstrument = {
  figi?: string
  ticker?: string
  name?: string
  instrumentType?: string
}

export async function fetchTinvestInstrumentByFigi(
  token: string,
  figi: string
): Promise<TinvestInstrument | null> {
  if (!figi) return null
  try {
    const data = await tinvestPost<{ instrument?: TinvestInstrument }>(
      token,
      'tinkoff.public.invest.api.contract.v1.InstrumentsService/GetInstrumentBy',
      { idType: 'INSTRUMENT_ID_TYPE_FIGI', id: figi }
    )
    return data.instrument ?? null
  } catch (error) {
    console.warn('fetchTinvestInstrumentByFigi failed', figi, error)
    return null
  }
}

export function buildCapitalAssetName(symbol: string, humanName: string): string {
  const cleanSymbol = symbol.trim().toUpperCase()
  const cleanName = humanName.trim()
  if (!cleanName || cleanName.toLowerCase() === cleanSymbol.toLowerCase()) {
    return cleanSymbol
  }
  return `${cleanSymbol} · ${cleanName}`
}

export function resolveAveragePurchaseRateRub(pos: TinvestPortfolioPosition): number | null {
  const avg = moneyToNumber(pos.averagePositionPrice)
  return avg > 0 ? avg : null
}

export function resolvePositionValueRub(pos: TinvestPortfolioPosition): {
  rateRub: number
  valueRub: number
} {
  const qty = quantityToNumber(pos.quantity)
  if (qty <= 0) return { rateRub: 0, valueRub: 0 }

  const rateRub =
    moneyToNumber(pos.currentPrice) || moneyToNumber(pos.averagePositionPrice)
  const nkd = moneyToNumber(pos.currentNkd)
  let valueRub = rateRub > 0 ? rateRub * qty : 0
  if (nkd > 0) valueRub += nkd

  if (valueRub <= 0 && rateRub > 0) {
    valueRub = rateRub * qty
  }

  const effectiveRate = qty > 0 && valueRub > 0 ? valueRub / qty : rateRub
  return { rateRub: effectiveRate, valueRub }
}

const INCOME_OPS = new Set([
  'OPERATION_TYPE_DIVIDEND',
  'OPERATION_TYPE_COUPON',
  'OPERATION_TYPE_DIV_EXT',
  'OPERATION_TYPE_DIVIDEND_TRANSFER',
])

const EXPENSE_OPS = new Set([
  'OPERATION_TYPE_BROKER_FEE',
  'OPERATION_TYPE_SERVICE_FEE',
  'OPERATION_TYPE_MARGIN_FEE',
  'OPERATION_TYPE_TRACK_MFEE',
  'OPERATION_TYPE_TRACK_PFEE',
  'OPERATION_TYPE_SUCCESS_FEE',
  'OPERATION_TYPE_ADVICE_FEE',
  'OPERATION_TYPE_OUT_FEE',
  'OPERATION_TYPE_CASH_FEE',
  'OPERATION_TYPE_OTHER_FEE',
])

export function mapOperationToTransaction(op: TinvestOperation): {
  externalId: string
  kind: 'income' | 'expense'
  amount: number
  title: string
  category: string
  date: string
} | null {
  const opType = op.operationType ?? op.type ?? ''
  const amount = Math.abs(moneyToNumber(op.payment))
  if (amount <= 0) return null

  let kind: 'income' | 'expense' | null = null
  let category = 'Другое'
  if (INCOME_OPS.has(opType)) {
    kind = 'income'
    category = 'Дивиденды'
  } else if (EXPENSE_OPS.has(opType)) {
    kind = 'expense'
    category = 'Комиссия'
  } else {
    return null
  }

  const externalId = op.id ?? op.parentOperationId
  if (!externalId) return null

  const date = op.date ? op.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  const title = op.name || op.description || category

  return { externalId, kind, amount, title, category, date }
}
