import type { AssetValuation } from './capitalValuation';
import {
  buildHistoryInsightsFromCache,
  fetchCapitalPeriodMetrics,
  fillMissingHistoryInsights,
  invokeCapitalMetricsSync,
  loadCapitalHistoryInsights,
  mergePeriodMetricsWithValuations,
  shouldRefreshPeriodMetrics,
} from './capitalPeriodMetrics';
import type { CapitalAsset } from '../types';
import { supabase } from './supabase';

const SNAPSHOT_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type RateHistoryInsight = {
  daysAgo: number;
  pastValueRub: number;
  currentValueRub: number;
  changeRub: number;
  changePercent: number;
  source: 'snapshot' | 'market';
};

export type BuildHistoryOptions = {
  skipSnapshots?: boolean;
  chartsReady?: boolean;
  onPartial?: (insights: Record<string, RateHistoryInsight>) => void;
  /** Не ждать Edge Function — только чтение из БД. */
  dbOnly?: boolean;
};

export function formatRateHistoryInsight(insight: RateHistoryInsight) {
  const sign = insight.changePercent > 0 ? '+' : '';
  const past = insight.pastValueRub.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  const current = insight.currentValueRub.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  const pct = insight.changePercent.toLocaleString('ru-RU', {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
  return `${insight.daysAgo} дн назад: ₽${past} → ₽${current} (${sign}${pct}%)`;
}

export async function recordValuationSnapshotsIfDue(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>
): Promise<void> {
  if (!supabase) return;

  const marketAssets = assets.filter(
    (item) => item.valuationMode === 'market' && item.quantity && item.unit
  );
  if (marketAssets.length === 0) return;

  const ids = marketAssets.map((item) => item.id);
  const { data: recent } = await supabase
    .from('capital_valuation_snapshots')
    .select('asset_id,recorded_at')
    .in('asset_id', ids)
    .order('recorded_at', { ascending: false });

  const lastByAsset = new Map<string, number>();
  for (const row of recent ?? []) {
    const assetId = String(row.asset_id);
    if (!lastByAsset.has(assetId)) {
      lastByAsset.set(assetId, new Date(String(row.recorded_at)).getTime());
    }
  }

  const now = Date.now();
  const toInsert = marketAssets
    .map((asset) => {
      const valuation = valuations[asset.id];
      if (!valuation?.rateRubPerUnit || !valuation.fetchedAt || !asset.quantity) return null;

      const lastAt = lastByAsset.get(asset.id) ?? 0;
      if (now - lastAt < SNAPSHOT_MIN_INTERVAL_MS) return null;

      return {
        asset_id: asset.id,
        rate_rub: valuation.rateRubPerUnit,
        value_rub: valuation.valueRub,
        quantity: asset.quantity,
        recorded_at: valuation.fetchedAt,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (toInsert.length === 0) return;

  const { error } = await supabase.from('capital_valuation_snapshots').insert(toInsert);
  if (error) console.warn('recordValuationSnapshotsIfDue error', error.message);
}

/** Читает готовые метрики из Supabase (как T-Invest). При необходимости — фоновый пересчёт на сервере. */
export async function buildRateHistoryInsights(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>,
  daysAgo = 7,
  options: BuildHistoryOptions = {}
): Promise<Record<string, RateHistoryInsight>> {
  const { insights, needsServerRefresh } = await loadCapitalHistoryInsights(
    assets,
    valuations,
    daysAgo
  );

  if (Object.keys(insights).length > 0) {
    options.onPartial?.(insights);
  }

  if (options.dbOnly) {
    return insights;
  }

  const shouldSync = needsServerRefresh || Object.keys(insights).length === 0;

  if (shouldSync) {
    const syncResult = await invokeCapitalMetricsSync({
      force: needsServerRefresh || Object.keys(insights).length === 0,
    });

    if (syncResult.ok) {
      const refreshed = await fetchCapitalPeriodMetrics(daysAgo);
      const merged = mergePeriodMetricsWithValuations(refreshed, valuations);
      const filled = await fillMissingHistoryInsights(assets, valuations, daysAgo, merged);
      options.onPartial?.(filled);
      return filled;
    }
  }

  return insights;
}

/** Мгновенное переключение периода — из локального кэша + уже загруженных метрик. */
export function rebuildRateHistoryInsightsFromCache(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>,
  daysAgo: number,
  existing: Record<string, RateHistoryInsight> = {}
): Record<string, RateHistoryInsight> {
  return buildHistoryInsightsFromCache(assets, valuations, daysAgo, existing);
}

/** Фоновое обновление метрик на сервере + перечитать из БД. */
export async function refreshServerPeriodMetrics(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>,
  daysAgo: number
): Promise<Record<string, RateHistoryInsight>> {
  const cached = await fetchCapitalPeriodMetrics(daysAgo);
  const merged = mergePeriodMetricsWithValuations(cached, valuations);
  const force = shouldRefreshPeriodMetrics(assets, merged);
  await invokeCapitalMetricsSync({ force });
  const refreshed = await fetchCapitalPeriodMetrics(daysAgo);
  const fromDb = mergePeriodMetricsWithValuations(refreshed, valuations);
  return fillMissingHistoryInsights(assets, valuations, daysAgo, fromDb);
}
