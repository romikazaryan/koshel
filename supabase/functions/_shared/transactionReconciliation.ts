import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export const QUICK_CAPTURE_SOURCES = ['manual', 'voice', 'receipt'] as const

export type ReconciliationCandidate = {
  id: string
  date: string
  amount: number
  kind: 'expense' | 'income'
  title: string
  source: string
}

export type ReconciliationMatch = {
  quickId: string
  bankId: string
}

const DAY_MS = 86_400_000

function parseIsoDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1)
}

function datesWithinDays(a: string, b: string, days: number): boolean {
  return Math.abs(parseIsoDate(a) - parseIsoDate(b)) <= days * DAY_MS
}

function amountsMatch(a: number, b: number): boolean {
  const left = Math.round(a * 100)
  const right = Math.round(b * 100)
  const diff = Math.abs(left - right)
  if (diff <= 100) return true
  const max = Math.max(left, right)
  return max > 0 && diff / max <= 0.02
}

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3)
}

function latinizeForMatch(text: string): string {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ы: 'y',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  }
  return text
    .toLowerCase()
    .split('')
    .map((char) => map[char] ?? char)
    .join('')
}

function compactMerchantKey(text: string): string {
  return latinizeForMatch(text).replace(/[^a-z0-9]/g, '')
}

function titlesSimilar(a: string, b: string): boolean {
  const compactA = compactMerchantKey(a)
  const compactB = compactMerchantKey(b)
  if (compactA.length >= 4 && compactB.length >= 4) {
    if (compactA.includes(compactB) || compactB.includes(compactA)) return true
  }

  const tokensA = normalizeTokens(a)
  const tokensB = normalizeTokens(b)
  if (tokensA.length === 0 || tokensB.length === 0) return true
  const setB = new Set(tokensB)
  return tokensA.some((token) => setB.has(token))
}

function isQuickCaptureSource(source?: string | null): boolean {
  return QUICK_CAPTURE_SOURCES.includes((source ?? 'manual') as (typeof QUICK_CAPTURE_SOURCES)[number])
}

export function findReconciliationMatches(
  bankRows: ReconciliationCandidate[],
  quickRows: ReconciliationCandidate[]
): ReconciliationMatch[] {
  const usedQuick = new Set<string>()
  const matches: ReconciliationMatch[] = []

  for (const bank of bankRows) {
    let best: { quick: ReconciliationCandidate; distance: number } | null = null

    for (const quick of quickRows) {
      if (usedQuick.has(quick.id)) continue
      if (!isQuickCaptureSource(quick.source)) continue
      if (quick.kind !== bank.kind) continue
      if (!datesWithinDays(quick.date, bank.date, 3)) continue
      if (!amountsMatch(quick.amount, bank.amount)) continue
      if (!titlesSimilar(quick.title, bank.title)) continue

      const distance = Math.abs(parseIsoDate(quick.date) - parseIsoDate(bank.date))
      if (!best || distance < best.distance) {
        best = { quick, distance }
      }
    }

    if (best) {
      usedQuick.add(best.quick.id)
      matches.push({ quickId: best.quick.id, bankId: bank.id })
    }
  }

  return matches
}

function shiftIsoDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function reconcileQuickCapturesForImport(
  admin: SupabaseClient,
  input: { userId: string; statementImportId: string; dateFrom: string; dateTo: string }
): Promise<number> {
  const { data: bankRows, error: bankError } = await admin
    .from('transactions')
    .select('id,date,amount,kind,title,source')
    .eq('statement_import_id', input.statementImportId)

  if (bankError || !bankRows?.length) return 0

  const rangeStart = shiftIsoDate(input.dateFrom, -3)
  const rangeEnd = shiftIsoDate(input.dateTo, 3)

  const { data: quickRows, error: quickError } = await admin
    .from('transactions')
    .select('id,date,amount,kind,title,source')
    .eq('user_id', input.userId)
    .is('reconciled_with_id', null)
    .gte('date', rangeStart)
    .lte('date', rangeEnd)
    .in('source', [...QUICK_CAPTURE_SOURCES])

  if (quickError || !quickRows?.length) return 0

  const matches = findReconciliationMatches(
    bankRows as ReconciliationCandidate[],
    quickRows as ReconciliationCandidate[]
  )
  if (matches.length === 0) return 0

  let reconciled = 0
  for (const match of matches) {
    const { error } = await admin
      .from('transactions')
      .update({ reconciled_with_id: match.bankId })
      .eq('id', match.quickId)
      .eq('user_id', input.userId)
      .is('reconciled_with_id', null)
      .in('source', [...QUICK_CAPTURE_SOURCES])

    if (!error) reconciled += 1
  }

  return reconciled
}
