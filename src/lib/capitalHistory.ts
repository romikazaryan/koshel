import type { AssetValuation } from './capitalValuation';
import { fetchHistoricalMarketRateRub } from './marketRates';
import type { CapitalAsset } from '../types';
import { supabase } from './supabase';

const SNAPSHOT_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
const HISTORY_DAYS = 7;

export type RateHistoryInsight = {
  daysAgo: number;
  pastValueRub: number;
  currentValueRub: number;
  changeRub: number;
  changePercent: number;
  source: 'snapshot' | 'market';
};

type SnapshotRow = {
  asset_id: string;
  rate_rub: number;
  value_rub: number;
  quantity: number;
  recorded_at: string;
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

function buildInsight(
  pastValueRub: number,
  currentValueRub: number,
  source: RateHistoryInsight['source']
): RateHistoryInsight {
  const changeRub = currentValueRub - pastValueRub;
  const changePercent =
    pastValueRub > 0 ? Math.round((changeRub / pastValueRub) * 1000) / 10 : 0;
  return {
    daysAgo: HISTORY_DAYS,
    pastValueRub,
    currentValueRub,
    changeRub,
    changePercent,
    source,
  };
}

async function fetchPastSnapshots(assetIds: string[]): Promise<Record<string, SnapshotRow>> {
  if (!supabase || assetIds.length === 0) return {};

  const target = new Date();
  target.setDate(target.getDate() - HISTORY_DAYS);
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (HISTORY_DAYS + 4));

  const { data, error } = await supabase
    .from('capital_valuation_snapshots')
    .select('asset_id,rate_rub,value_rub,quantity,recorded_at')
    .in('asset_id', assetIds)
    .gte('recorded_at', windowStart.toISOString())
    .lte('recorded_at', target.toISOString())
    .order('recorded_at', { ascending: false });

  if (error) {
    console.warn('fetchPastSnapshots error', error.message);
    return {};
  }

  const result: Record<string, SnapshotRow> = {};
  for (const row of data ?? []) {
    const assetId = String(row.asset_id);
    if (result[assetId]) continue;
    result[assetId] = {
      asset_id: assetId,
      rate_rub: Number(row.rate_rub ?? 0),
      value_rub: Number(row.value_rub ?? 0),
      quantity: Number(row.quantity ?? 0),
      recorded_at: String(row.recorded_at),
    };
  }
  return result;
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

function isLiveMarketAsset(item: CapitalAsset) {
  if (!item.isActive || !item.quantity || !item.unit) return false;
  if (item.valuationMode === 'market') return true;
  return item.assetType === 'crypto' || item.assetType === 'cash' || item.assetType === 'stocks';
}

export async function buildRateHistoryInsights(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>
): Promise<Record<string, RateHistoryInsight>> {
  const marketAssets = assets.filter(isLiveMarketAsset);
  if (marketAssets.length === 0) return {};

  const pastSnapshots = await fetchPastSnapshots(marketAssets.map((item) => item.id));
  const result: Record<string, RateHistoryInsight> = {};

  await Promise.all(
    marketAssets.map(async (asset) => {
      const valuation = valuations[asset.id];
      const currentValueRub = valuation?.valueRub ?? asset.marketValueRub ?? asset.amount;
      if (!currentValueRub || currentValueRub <= 0) return;

      const snapshot = pastSnapshots[asset.id];
      if (snapshot && snapshot.value_rub > 0) {
        const pastValueRub =
          asset.quantity && snapshot.rate_rub > 0
            ? Math.round(asset.quantity * snapshot.rate_rub * 100) / 100
            : snapshot.value_rub;
        result[asset.id] = buildInsight(pastValueRub, currentValueRub, 'snapshot');
        return;
      }

      if (!asset.unit) return;
      const pastRate = await fetchHistoricalMarketRateRub(
        asset.unit,
        asset.assetType,
        HISTORY_DAYS
      );
      if (pastRate == null || pastRate <= 0 || !asset.quantity) return;

      const pastValueRub = Math.round(asset.quantity * pastRate * 100) / 100;
      result[asset.id] = buildInsight(pastValueRub, currentValueRub, 'market');
    })
  );

  return result;
}
