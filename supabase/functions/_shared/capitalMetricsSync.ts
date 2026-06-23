import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  canonicalizeCryptoUnit,
  METRIC_PERIODS_DAYS,
  prefetchHistoricalRates,
  prefetchMoexSpotRates,
  readCachedHistoricalRate,
  readCachedMoexPrevClose,
  readCachedMoexSpotRate,
  type HistoricalRateKey,
} from './marketHistory.ts'

const METRICS_STALE_MS = 30 * 60 * 1000

type CapitalAssetRow = {
  id: string
  user_id: string
  asset_type: string
  valuation_mode: string
  quantity: number | null
  unit: string | null
  market_rate_rub: number | null
  market_value_rub: number | null
  is_active: boolean
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10
}

export async function syncCapitalPeriodMetricsForUser(
  admin: SupabaseClient,
  userId: string,
  options: { force?: boolean } = {}
): Promise<{ updated: number; skipped: boolean }> {
  const { data: assets, error: assetsError } = await admin
    .from('capital_assets')
    .select(
      'id,user_id,asset_type,valuation_mode,quantity,unit,market_rate_rub,market_value_rub,is_active'
    )
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('valuation_mode', 'market')
    .in('asset_type', ['stocks', 'crypto'])

  if (assetsError) throw assetsError

  const marketAssets = (assets ?? []).filter(
    (row) =>
      row.quantity != null &&
      Number(row.quantity) > 0 &&
      row.unit &&
      (row.asset_type === 'stocks' || row.asset_type === 'crypto')
  ) as CapitalAssetRow[]

  if (marketAssets.length === 0) {
    return { updated: 0, skipped: false }
  }

  const assetIds = marketAssets.map((row) => row.id)

  if (!options.force) {
    const { data: existing } = await admin
      .from('capital_asset_period_metrics')
      .select('asset_id, period_days, computed_at')
      .in('asset_id', assetIds)

    const rows = existing ?? []
    const allAssetsFresh = marketAssets.every((asset) => {
      const assetRows = rows.filter((row) => String(row.asset_id) === asset.id)
      if (assetRows.length < METRIC_PERIODS_DAYS.length) return false
      return assetRows.every(
        (row) => Date.now() - new Date(String(row.computed_at)).getTime() < METRICS_STALE_MS
      )
    })

    if (allAssetsFresh) {
      return { updated: 0, skipped: true }
    }
  }

  const rateKeys: HistoricalRateKey[] = []
  const stockTickers: string[] = []
  for (const asset of marketAssets) {
    const unit =
      asset.asset_type === 'crypto'
        ? canonicalizeCryptoUnit(String(asset.unit))
        : String(asset.unit)
    const kind = asset.asset_type === 'crypto' ? 'crypto' : 'stock'
    if (kind === 'stock') stockTickers.push(unit)
    for (const days of METRIC_PERIODS_DAYS) {
      rateKeys.push({ kind, unit, daysAgo: days })
    }
  }

  await Promise.all([prefetchHistoricalRates(rateKeys), prefetchMoexSpotRates(stockTickers)])

  const now = new Date().toISOString()
  const upsertRows: Record<string, unknown>[] = []

  for (const asset of marketAssets) {
    const quantity = Number(asset.quantity)
    const unit =
      asset.asset_type === 'crypto'
        ? canonicalizeCryptoUnit(String(asset.unit))
        : String(asset.unit)
    const kind = asset.asset_type === 'crypto' ? 'crypto' : 'stock'
    let currentValueRub = 0

    if (kind === 'stock') {
      const moexRate = readCachedMoexSpotRate(unit)
      if (moexRate != null && moexRate > 0) {
        currentValueRub = round2(quantity * moexRate)
      }
    }

    if (currentValueRub <= 0) {
      const rateNow = Number(asset.market_rate_rub ?? 0)
      currentValueRub =
        Number(asset.market_value_rub ?? 0) > 0
          ? Number(asset.market_value_rub)
          : rateNow > 0
            ? round2(quantity * rateNow)
            : 0
    }

    if (currentValueRub <= 0) continue

    for (const periodDays of METRIC_PERIODS_DAYS) {
      let pastRate: number | null = null
      if (periodDays <= 1 && kind === 'stock') {
        pastRate = readCachedMoexPrevClose(unit)
      }
      if (pastRate == null || pastRate <= 0) {
        pastRate = readCachedHistoricalRate(kind, unit, periodDays)
      }
      if (pastRate == null || pastRate <= 0) continue

      const pastValueRub = round2(quantity * pastRate)
      const changeRub = round2(currentValueRub - pastValueRub)
      const changePercent =
        pastValueRub > 0 ? roundPercent((changeRub / pastValueRub) * 100) : 0

      upsertRows.push({
        user_id: userId,
        asset_id: asset.id,
        period_days: periodDays,
        past_rate_rub: pastRate,
        past_value_rub: pastValueRub,
        current_value_rub: currentValueRub,
        change_rub: changeRub,
        change_percent: changePercent,
        computed_at: now,
      })
    }
  }

  if (upsertRows.length === 0) {
    return { updated: 0, skipped: false }
  }

  const { error: upsertError } = await admin
    .from('capital_asset_period_metrics')
    .upsert(upsertRows, { onConflict: 'asset_id,period_days' })

  if (upsertError) throw upsertError

  return { updated: upsertRows.length, skipped: false }
}
