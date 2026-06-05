import { withNetworkRetries, withTimeout } from './asyncUtils';
import { refreshSessionOnce } from './authSession';
import {
  buildCapitalValuations,
  collectMarketSnapshots,
  getAssetRubValue,
  type AssetValuation,
} from './capitalValuation';
import { buildRateHistoryInsights, recordValuationSnapshotsIfDue } from './capitalHistory';
import type { CapitalAsset, CapitalAssetType, CapitalValuationMode } from '../types';
import { supabase } from './supabase';

const QUERY_TIMEOUT_MS = 12_000;
const MUTATION_TIMEOUT_MS = 10_000;

const SELECT_FIELDS =
  'id,name,amount,asset_type,valuation_mode,quantity,unit,market_rate_rub,market_value_rub,market_fetched_at,is_active,note,created_at,updated_at';

function mapAssetType(value: string): CapitalAssetType {
  const allowed: CapitalAssetType[] = [
    'deposit',
    'crypto',
    'real_estate',
    'stocks',
    'cash',
    'other',
  ];
  return allowed.includes(value as CapitalAssetType) ? (value as CapitalAssetType) : 'other';
}

function mapRow(row: Record<string, unknown>): CapitalAsset {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Актив'),
    amount: Number(row.amount ?? 0),
    assetType: mapAssetType(String(row.asset_type ?? 'other')),
    valuationMode: row.valuation_mode === 'market' ? 'market' : 'manual',
    quantity: row.quantity != null ? Number(row.quantity) : undefined,
    unit: row.unit ? String(row.unit) : undefined,
    marketRateRub: row.market_rate_rub != null ? Number(row.market_rate_rub) : undefined,
    marketValueRub: row.market_value_rub != null ? Number(row.market_value_rub) : undefined,
    marketFetchedAt: row.market_fetched_at ? String(row.market_fetched_at) : undefined,
    isActive: row.is_active !== false,
    note: row.note ? String(row.note) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

export function getCapitalTotal(
  assets: CapitalAsset[],
  valuations?: Record<string, AssetValuation>
): number {
  return assets
    .filter((item) => item.isActive)
    .reduce(
      (sum, item) => sum + getAssetRubValue(item, valuations?.[item.id]),
      0
    );
}

export function getActiveCapitalAssets(assets: CapitalAsset[]): CapitalAsset[] {
  return assets.filter((item) => item.isActive);
}

function mergeValuationsIntoAssets(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>
): CapitalAsset[] {
  return assets.map((row) => {
    const valuation = valuations[row.id];
    if (row.valuationMode !== 'market' || !valuation) return row;
    return {
      ...row,
      amount: valuation.valueRub,
      marketValueRub: valuation.valueRub,
      marketRateRub: valuation.rateRubPerUnit ?? row.marketRateRub,
      marketFetchedAt: valuation.fetchedAt ?? row.marketFetchedAt,
    };
  });
}

export async function fetchCapitalAssetsValued(): Promise<{
  assets: CapitalAsset[];
  valuations: Record<string, AssetValuation>;
  historyInsights: Awaited<ReturnType<typeof buildRateHistoryInsights>>;
}> {
  const assets = await fetchCapitalAssets();
  try {
    const valuations = await buildCapitalValuations(assets);
    const snapshots = collectMarketSnapshots(assets, valuations);
    await persistCapitalMarketSnapshots(snapshots);
    await recordValuationSnapshotsIfDue(assets, valuations);
    const historyInsights = await buildRateHistoryInsights(assets, valuations);
    return {
      assets: mergeValuationsIntoAssets(assets, valuations),
      valuations,
      historyInsights,
    };
  } catch (error) {
    console.warn('fetchCapitalAssetsValued market refresh failed', error);
    return { assets, valuations: {}, historyInsights: {} };
  }
}

export async function fetchCapitalAssets(): Promise<CapitalAsset[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await withTimeout(
      supabase.from('capital_assets').select(SELECT_FIELDS).order('created_at', { ascending: false }),
      QUERY_TIMEOUT_MS,
      'Сервер не ответил вовремя'
    );
    if (error) {
      console.warn('fetchCapitalAssets error', error.message);
      return [];
    }
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  } catch (error) {
    console.warn('fetchCapitalAssets failed', error);
    return [];
  }
}

export type UpsertCapitalAssetInput = {
  name: string;
  assetType: CapitalAssetType;
  valuationMode: CapitalValuationMode;
  amount: number;
  quantity?: number;
  unit?: string;
  marketRateRub?: number;
  marketValueRub?: number;
  marketFetchedAt?: string;
  note?: string;
};

export async function insertCapitalAsset(input: UpsertCapitalAssetInput): Promise<CapitalAsset> {
  const client = supabase;
  if (!client) throw new Error('Supabase не настроен.');

  const row = {
    name: input.name.trim(),
    amount: input.amount,
    asset_type: input.assetType,
    valuation_mode: input.valuationMode,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    market_rate_rub: input.marketRateRub ?? null,
    market_value_rub: input.marketValueRub ?? null,
    market_fetched_at: input.marketFetchedAt ?? null,
    note: input.note?.trim() || null,
    is_active: true,
  };

  const data = await withNetworkRetries(
    async () => {
      const result = await withTimeout(
        client.from('capital_assets').insert(row).select(SELECT_FIELDS).single(),
        MUTATION_TIMEOUT_MS,
        'Сервер не ответил вовремя'
      );
      if (result.error) throw result.error;
      if (!result.data) throw new Error('Сервер не вернул актив.');
      return result.data;
    },
    { attempts: 3, baseDelayMs: 250, onAuthRetry: refreshSessionOnce }
  );

  return mapRow(data as Record<string, unknown>);
}

export async function setCapitalAssetActive(id: string, isActive: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен.');

  const { error } = await supabase
    .from('capital_assets')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function updateCapitalAssetAmount(id: string, amount: number): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен.');
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Укажите корректную сумму больше нуля.');
  }

  const { error } = await supabase.from('capital_assets').update({ amount }).eq('id', id);

  if (error) throw new Error(error.message);
}

export async function updateCapitalAssetQuantity(id: string, quantity: number): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен.');
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Укажите корректное количество больше нуля.');
  }

  const { error } = await supabase.from('capital_assets').update({ quantity }).eq('id', id);

  if (error) throw new Error(error.message);
}

export type MarketSnapshotInput = {
  id: string;
  marketRateRub: number;
  marketValueRub: number;
  marketFetchedAt: string;
  amount: number;
};

export async function persistCapitalMarketSnapshots(
  snapshots: MarketSnapshotInput[]
): Promise<void> {
  if (!supabase || snapshots.length === 0) return;

  await Promise.all(
    snapshots.map((snapshot) =>
      supabase!
        .from('capital_assets')
        .update({
          market_rate_rub: snapshot.marketRateRub,
          market_value_rub: snapshot.marketValueRub,
          market_fetched_at: snapshot.marketFetchedAt,
          amount: snapshot.amount,
        })
        .eq('id', snapshot.id)
    )
  );
}

export async function deleteCapitalAsset(id: string): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Supabase не настроен.');

  await withNetworkRetries(
    async () => {
      const result = await withTimeout(
        client.from('capital_assets').delete().eq('id', id),
        MUTATION_TIMEOUT_MS,
        'Сервер не ответил вовремя'
      );
      if (result.error) throw result.error;
    },
    { attempts: 3, baseDelayMs: 250, onAuthRetry: refreshSessionOnce }
  );
}
