import {
  canonicalizeCryptoUnit,
  isCryptoMarketUnit,
  normalizeStockTicker,
  resolveCoingeckoId,
  resolveMoexTicker,
} from '../constants/marketUnits';
import type { RateHistoryInsight } from './capitalHistory';
import type { AssetValuation } from './capitalValuation';
import { getEdgeFunctionErrorMessage } from './edgeFunctionErrors';
import {
  fetchHistoricalMarketRateRub,
  fetchMoexStockRatesRub,
  prefetchCryptoHistoryCharts,
  prefetchMarketHistoryForPeriod,
  readCryptoIntradayPastRateRub,
  readHistoricalCryptoRatesRub,
  readHistoricalStockRatesRub,
  readMoexPrevCloseRub,
} from './marketRates';
import { supabase, hasSupabase } from './supabase';
import type { CapitalAsset } from '../types';

type PeriodMetricRow = {
  asset_id: string;
  period_days: number;
  past_rate_rub: number | null;
  past_value_rub: number | null;
  current_value_rub: number | null;
  change_rub: number | null;
  change_percent: number | null;
  computed_at: string;
};

export function metricsRowToInsight(
  row: PeriodMetricRow,
  valuations?: Record<string, AssetValuation>
): RateHistoryInsight {
  const currentValueRub =
    valuations?.[row.asset_id]?.valueRub ??
    Number(row.current_value_rub ?? 0);
  const pastValueRub = Number(row.past_value_rub ?? 0);
  const changeRub =
    row.change_rub != null
      ? Number(row.change_rub)
      : Math.round((currentValueRub - pastValueRub) * 100) / 100;
  const changePercent =
    row.change_percent != null
      ? Number(row.change_percent)
      : pastValueRub > 0
        ? Math.round((changeRub / pastValueRub) * 1000) / 10
        : 0;

  return {
    daysAgo: row.period_days,
    pastValueRub,
    currentValueRub,
    changeRub,
    changePercent,
    source: 'market',
  };
}

export async function fetchCapitalPeriodMetrics(
  periodDays: number
): Promise<Record<string, RateHistoryInsight>> {
  if (!hasSupabase || !supabase) return {};

  const { data, error } = await supabase
    .from('capital_asset_period_metrics')
    .select(
      'asset_id,period_days,past_rate_rub,past_value_rub,current_value_rub,change_rub,change_percent,computed_at'
    )
    .eq('period_days', periodDays);

  if (error) {
    console.warn('fetchCapitalPeriodMetrics error', error.message);
    return {};
  }

  const result: Record<string, RateHistoryInsight> = {};
  for (const row of data ?? []) {
    result[String(row.asset_id)] = metricsRowToInsight(row as PeriodMetricRow);
  }
  return result;
}

export function mergePeriodMetricsWithValuations(
  metrics: Record<string, RateHistoryInsight>,
  valuations: Record<string, AssetValuation>
): Record<string, RateHistoryInsight> {
  const result: Record<string, RateHistoryInsight> = {};
  for (const [assetId, insight] of Object.entries(metrics)) {
    const valuation = valuations[assetId];
    if (!valuation?.valueRub) {
      result[assetId] = insight;
      continue;
    }
    const currentValueRub = valuation.valueRub;
    const pastValueRub = insight.pastValueRub;
    const changeRub = Math.round((currentValueRub - pastValueRub) * 100) / 100;
    const changePercent =
      pastValueRub > 0 ? Math.round((changeRub / pastValueRub) * 1000) / 10 : 0;
    result[assetId] = {
      ...insight,
      currentValueRub,
      changeRub,
      changePercent,
    };
  }
  return result;
}

function listMarketAssetsForMetrics(assets: CapitalAsset[]) {
  return assets.filter(
    (item) =>
      item.isActive &&
      item.valuationMode === 'market' &&
      item.quantity &&
      item.unit &&
      (item.assetType === 'stocks' ||
        item.assetType === 'crypto' ||
        item.assetType === 'bonds')
  );
}

export function mergeHistoryInsights(
  base: Record<string, RateHistoryInsight>,
  incoming: Record<string, RateHistoryInsight>
): Record<string, RateHistoryInsight> {
  const result = { ...base };
  for (const [assetId, insight] of Object.entries(incoming)) {
    if (insight) result[assetId] = insight;
  }
  return result;
}

function resolvePastRateRub(
  asset: CapitalAsset,
  unit: string,
  periodDays: number,
  currentRateRub?: number | null
): number | null {
  if (asset.assetType === 'crypto' || isCryptoMarketUnit(unit)) {
    const pastRate =
      periodDays <= 1
        ? readCryptoIntradayPastRateRub(unit)
        : readHistoricalCryptoRatesRub([canonicalizeCryptoUnit(unit)], periodDays)[
            canonicalizeCryptoUnit(unit)
          ] ?? null;
    if (pastRate == null || pastRate <= 0) return null;
    return pastRate;
  }

  if (asset.assetType === 'stocks' || asset.assetType === 'bonds') {
    const ticker = resolveMoexTicker(unit);
    const normalized = normalizeStockTicker(ticker);
    let pastRate: number | null = null;
    if (periodDays <= 1) {
      pastRate = readMoexPrevCloseRub(ticker);
    }
    if (pastRate == null || pastRate <= 0) {
      pastRate = readHistoricalStockRatesRub([ticker], periodDays)[normalized] ?? null;
    }
    if (pastRate == null || pastRate <= 0) return null;
    return pastRate;
  }

  return null;
}

export function shouldRefreshPeriodMetrics(
  assets: CapitalAsset[],
  metrics: Record<string, RateHistoryInsight>
): boolean {
  const marketAssets = listMarketAssetsForMetrics(assets);
  if (marketAssets.length === 0) return false;
  return marketAssets.some((item) => !metrics[item.id]);
}

function buildInsightFromRates(
  daysAgo: number,
  quantity: number,
  currentValueRub: number,
  pastRate: number
): RateHistoryInsight {
  const pastValueRub = Math.round(quantity * pastRate * 100) / 100;
  const changeRub = Math.round((currentValueRub - pastValueRub) * 100) / 100;
  const changePercent =
    pastValueRub > 0 ? Math.round((changeRub / pastValueRub) * 1000) / 10 : 0;
  return {
    daysAgo,
    pastValueRub,
    currentValueRub,
    changeRub,
    changePercent,
    source: 'market',
  };
}

/** Дневная динамика: текущая цена vs вчерашнее закрытие MOEX (не метрики из БД). */
function buildIntradayInsightsFromCache(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>
): Record<string, RateHistoryInsight> {
  const result: Record<string, RateHistoryInsight> = {};

  for (const asset of listMarketAssetsForMetrics(assets)) {
    const quantity = Number(asset.quantity);
    const unit = asset.unit!;
    const valuation = valuations[asset.id];
    const currentValueRub =
      valuation?.valueRub ?? Number(asset.marketValueRub ?? asset.amount ?? 0);
    if (!Number.isFinite(currentValueRub) || currentValueRub <= 0) continue;

    const currentRateRub =
      valuation?.rateRubPerUnit ?? asset.marketRateRub ?? currentValueRub / quantity;

    const pastRate = resolvePastRateRub(asset, unit, 1, currentRateRub);
    if (pastRate == null || pastRate <= 0) continue;

    result[asset.id] = buildInsightFromRates(1, quantity, currentValueRub, pastRate);
  }

  return result;
}

/** Мгновенный расчёт динамики из локального кэша (без сети) — для переключения периода. */
export function buildHistoryInsightsFromCache(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>,
  periodDays: number,
  existing: Record<string, RateHistoryInsight> = {}
): Record<string, RateHistoryInsight> {
  if (periodDays <= 1) {
    const fresh = buildIntradayInsightsFromCache(assets, valuations);
    return mergePeriodMetricsWithValuations(mergeHistoryInsights(existing, fresh), valuations);
  }

  const result = mergePeriodMetricsWithValuations({ ...existing }, valuations);
  const missing = listMarketAssetsForMetrics(assets).filter((item) => !result[item.id]);

  for (const asset of missing) {
    const quantity = Number(asset.quantity);
    const unit = asset.unit!;
    const valuation = valuations[asset.id];
    const currentValueRub =
      valuation?.valueRub ?? Number(asset.marketValueRub ?? asset.amount ?? 0);
    if (!Number.isFinite(currentValueRub) || currentValueRub <= 0) continue;

    const pastRate = resolvePastRateRub(asset, unit, periodDays);
    if (pastRate == null || pastRate <= 0) continue;
    result[asset.id] = buildInsightFromRates(periodDays, quantity, currentValueRub, pastRate);
  }

  return result;
}

export function collectMarketAssetsForHistory(assets: CapitalAsset[]) {
  return listMarketAssetsForMetrics(assets);
}

/** Быстрый prefetch prevClose MOEX для «за сегодня». */
export async function prefetchIntradayStockPrevClose(assets: CapitalAsset[]): Promise<void> {
  const stockTickers = [
    ...new Set(
      listMarketAssetsForMetrics(assets)
        .filter((item) => item.assetType === 'stocks' || item.assetType === 'bonds')
        .map((item) => resolveMoexTicker(item.unit!))
    ),
  ];
  if (stockTickers.length === 0) return;
  await fetchMoexStockRatesRub(stockTickers, { force: false });
}

/** Дозаполняет динамику на клиенте, если в БД ещё нет метрик (новые активы). */
export async function fillMissingHistoryInsights(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>,
  periodDays: number,
  existing: Record<string, RateHistoryInsight>
): Promise<Record<string, RateHistoryInsight>> {
  if (periodDays <= 1) {
    const stockTickers = [
      ...new Set(
        listMarketAssetsForMetrics(assets)
          .filter((item) => item.assetType === 'stocks' || item.assetType === 'bonds')
          .map((item) => resolveMoexTicker(item.unit!))
      ),
    ];
    const coingeckoIds = [
      ...new Set(
        listMarketAssetsForMetrics(assets)
          .filter((item) => item.assetType === 'crypto' || isCryptoMarketUnit(item.unit!))
          .map((item) => resolveCoingeckoId(canonicalizeCryptoUnit(item.unit!)))
          .filter((id): id is string => Boolean(id))
      ),
    ];
    await Promise.all([
      stockTickers.length > 0 ? fetchMoexStockRatesRub(stockTickers, { force: false }) : null,
      coingeckoIds.length > 0 ? prefetchCryptoHistoryCharts(coingeckoIds) : null,
    ]);
  }

  const base =
    periodDays <= 1
      ? buildIntradayInsightsFromCache(assets, valuations)
      : { ...existing };

  const missing = listMarketAssetsForMetrics(assets).filter((item) => !base[item.id]);
  if (missing.length === 0) return base;

  const cryptoUnits = [
    ...new Set(
      missing
        .filter((item) => item.assetType === 'crypto' || isCryptoMarketUnit(item.unit!))
        .map((item) => canonicalizeCryptoUnit(item.unit!))
    ),
  ];
  const stockTickers = [
    ...new Set(
      missing
        .filter((item) => item.assetType === 'stocks' || item.assetType === 'bonds')
        .map((item) => resolveMoexTicker(item.unit!))
    ),
  ];

  await Promise.all([
    prefetchMarketHistoryForPeriod(cryptoUnits, stockTickers, periodDays),
    periodDays <= 1 && cryptoUnits.length > 0
      ? prefetchCryptoHistoryCharts(
          [
            ...new Set(
              cryptoUnits
                .map((unit) => resolveCoingeckoId(unit))
                .filter((id): id is string => Boolean(id))
            ),
          ]
        )
      : null,
  ]);

  const result = { ...base };
  for (const asset of missing) {
    const quantity = Number(asset.quantity);
    const unit = asset.unit!;
    const valuation = valuations[asset.id];
    const currentValueRub =
      valuation?.valueRub ?? Number(asset.marketValueRub ?? asset.amount ?? 0);
    if (!Number.isFinite(currentValueRub) || currentValueRub <= 0) continue;

    let pastRate = resolvePastRateRub(
      asset,
      unit,
      periodDays,
      valuation?.rateRubPerUnit ?? asset.marketRateRub ?? currentValueRub / quantity
    );
    if (pastRate == null || pastRate <= 0) {
      if (asset.assetType === 'crypto' || isCryptoMarketUnit(unit)) {
        const canonical = canonicalizeCryptoUnit(unit);
        pastRate = await fetchHistoricalMarketRateRub(canonical, 'crypto', periodDays);
      } else if (asset.assetType === 'stocks' || asset.assetType === 'bonds') {
        const ticker = resolveMoexTicker(unit);
        pastRate = await fetchHistoricalMarketRateRub(ticker, 'stocks', periodDays);
      }
    }

    if (pastRate == null || pastRate <= 0) continue;
    result[asset.id] = buildInsightFromRates(periodDays, quantity, currentValueRub, pastRate);
  }

  return result;
}

export async function invokeCapitalMetricsSync(options?: {
  force?: boolean;
}): Promise<{ ok: boolean; message?: string }> {
  if (!hasSupabase || !supabase) {
    return { ok: false, message: 'Supabase не настроен' };
  }

  const { data, error } = await supabase.functions.invoke('capital-metrics-sync', {
    body: { force: options?.force === true },
  });

  if (error) {
    const message = await getEdgeFunctionErrorMessage(
      error,
      data,
      'Не удалось обновить динамику'
    );
    return { ok: false, message };
  }

  const payload = data as { ok?: boolean; message?: string } | null;
  return { ok: payload?.ok !== false, message: payload?.message };
}

export async function loadCapitalHistoryInsights(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>,
  periodDays: number,
  options?: { skipClientFill?: boolean }
): Promise<{
  insights: Record<string, RateHistoryInsight>;
  needsServerRefresh: boolean;
}> {
  if (periodDays <= 1) {
    const fromCache = buildIntradayInsightsFromCache(assets, valuations);
    const insights = options?.skipClientFill
      ? fromCache
      : await fillMissingHistoryInsights(assets, valuations, periodDays, fromCache);
    return {
      insights,
      needsServerRefresh: shouldRefreshPeriodMetrics(assets, insights),
    };
  }

  const metrics = await fetchCapitalPeriodMetrics(periodDays);
  const merged = mergePeriodMetricsWithValuations(metrics, valuations);
  const insights = options?.skipClientFill
    ? merged
    : await fillMissingHistoryInsights(assets, valuations, periodDays, merged);
  const needsServerRefresh = shouldRefreshPeriodMetrics(assets, insights);
  return { insights, needsServerRefresh };
}
