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
import {
  normalizeStockTicker,
  canonicalizeCryptoUnit,
  resolveTinvestCurrencyUnit,
} from '../constants/marketUnits';
import { supabase } from './supabase';

const QUERY_TIMEOUT_MS = 12_000;
const MUTATION_TIMEOUT_MS = 10_000;

const SELECT_FIELDS =
  'id,name,amount,asset_type,valuation_mode,quantity,unit,market_rate_rub,market_value_rub,avg_purchase_rate_rub,market_fetched_at,is_active,note,financial_connection_id,external_position_id,created_at,updated_at';

export function isBrokerSyncedAsset(item: Pick<CapitalAsset, 'note' | 'name' | 'financialConnectionId' | 'externalPositionId'>): boolean {
  return (
    Boolean(item.financialConnectionId && item.externalPositionId) ||
    item.note === 'Синхронизация T-Invest' ||
    item.name.includes('· T-Invest')
  );
}

function mapAssetType(value: string): CapitalAssetType {
  const allowed: CapitalAssetType[] = [
    'deposit',
    'crypto',
    'real_estate',
    'stocks',
    'cash',
    'bonds',
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
    unit: row.unit
      ? normalizeCapitalUnit(
          mapAssetType(String(row.asset_type ?? 'other')),
          String(row.unit)
        )
      : undefined,
    marketRateRub: row.market_rate_rub != null ? Number(row.market_rate_rub) : undefined,
    marketValueRub: row.market_value_rub != null ? Number(row.market_value_rub) : undefined,
    avgPurchaseRateRub:
      row.avg_purchase_rate_rub != null ? Number(row.avg_purchase_rate_rub) : undefined,
    marketFetchedAt: row.market_fetched_at ? String(row.market_fetched_at) : undefined,
    isActive: row.is_active !== false,
    note: row.note ? String(row.note) : undefined,
    financialConnectionId: row.financial_connection_id
      ? String(row.financial_connection_id)
      : undefined,
    externalPositionId: row.external_position_id ? String(row.external_position_id) : undefined,
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
    const valuations = await buildCapitalValuations(assets, { forceMoex: true });
    const snapshots = collectMarketSnapshots(assets, valuations);
    void persistCapitalMarketSnapshots(snapshots).catch((error) => {
      console.warn('persistCapitalMarketSnapshots failed', error);
    });
    void recordValuationSnapshotsIfDue(assets, valuations).catch((error) => {
      console.warn('recordValuationSnapshotsIfDue failed', error);
    });
    return {
      assets: mergeValuationsIntoAssets(assets, valuations),
      valuations,
      historyInsights: {},
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

export function normalizeCapitalUnit(assetType: CapitalAssetType, unit: string): string {
  if (assetType === 'stocks' || assetType === 'bonds') return normalizeStockTicker(unit);
  if (assetType === 'crypto') return canonicalizeCryptoUnit(unit);
  if (assetType === 'cash') return resolveTinvestCurrencyUnit(unit);
  return unit.trim().toLowerCase();
}

export function getBrokerConnectionIds(assets: CapitalAsset[]): string[] {
  return [
    ...new Set(
      assets
        .filter(isBrokerSyncedAsset)
        .map((item) => item.financialConnectionId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
}

function isBrokerManagedAsset(item: CapitalAsset): boolean {
  return isBrokerSyncedAsset(item);
}

function isMergeableMarketAsset(item: CapitalAsset, assetType: CapitalAssetType, unit: string) {
  if (!item.isActive || item.valuationMode !== 'market' || item.assetType !== assetType) {
    return false;
  }
  if (!item.unit || isBrokerManagedAsset(item)) return false;
  return normalizeCapitalUnit(assetType, item.unit) === normalizeCapitalUnit(assetType, unit);
}

function findLocalMergeTarget(
  items: CapitalAsset[],
  assetType: CapitalAssetType,
  unit: string
): CapitalAsset | undefined {
  return items.find((item) => isMergeableMarketAsset(item, assetType, unit));
}

async function findRemoteMergeTarget(
  assetType: CapitalAssetType,
  unit: string
): Promise<CapitalAsset | null> {
  const client = supabase;
  if (!client) return null;

  const normalizedUnit = normalizeCapitalUnit(assetType, unit);
  const result = await withTimeout(
    client
      .from('capital_assets')
      .select(SELECT_FIELDS)
      .eq('asset_type', assetType)
      .eq('valuation_mode', 'market')
      .eq('unit', normalizedUnit)
      .eq('is_active', true)
      .is('external_position_id', null)
      .is('financial_connection_id', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    QUERY_TIMEOUT_MS,
    'Не удалось проверить существующий актив'
  );

  if (result.error || !result.data) return null;
  return mapRow(result.data as Record<string, unknown>);
}

function buildMarketAssetRow(input: UpsertCapitalAssetInput) {
  const unit =
    input.valuationMode === 'market' && input.unit
      ? normalizeCapitalUnit(input.assetType, input.unit)
      : input.unit ?? null;

  return {
    name: input.name.trim(),
    amount: input.amount,
    asset_type: input.assetType,
    valuation_mode: input.valuationMode,
    quantity: input.quantity ?? null,
    unit,
    market_rate_rub: input.marketRateRub ?? null,
    market_value_rub: input.marketValueRub ?? null,
    market_fetched_at: input.marketFetchedAt ?? null,
    note: input.note?.trim() || null,
    is_active: true,
  };
}

export async function updateCapitalAssetMarket(
  id: string,
  patch: {
    quantity: number;
    amount: number;
    marketRateRub: number;
    marketValueRub: number;
    marketFetchedAt: string;
    name?: string;
  }
): Promise<CapitalAsset> {
  const client = supabase;
  if (!client) throw new Error('Supabase не настроен.');

  const row = {
    quantity: patch.quantity,
    amount: patch.amount,
    market_rate_rub: patch.marketRateRub,
    market_value_rub: patch.marketValueRub,
    market_fetched_at: patch.marketFetchedAt,
    ...(patch.name ? { name: patch.name.trim() } : {}),
  };

  const data = await withNetworkRetries(
    async () => {
      const result = await withTimeout(
        client.from('capital_assets').update(row).eq('id', id).select(SELECT_FIELDS).single(),
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

export async function insertOrMergeCapitalAsset(
  input: UpsertCapitalAssetInput,
  existingItems: CapitalAsset[] = []
): Promise<{ asset: CapitalAsset; merged: boolean }> {
  const canMerge =
    input.valuationMode === 'market' &&
    input.unit &&
    input.quantity != null &&
    input.quantity > 0;

  if (canMerge) {
    const normalizedUnit = normalizeCapitalUnit(input.assetType, input.unit!);
    const localTarget = findLocalMergeTarget(existingItems, input.assetType, normalizedUnit);
    const remoteTarget =
      localTarget ?? (await findRemoteMergeTarget(input.assetType, normalizedUnit));

    if (remoteTarget) {
      const nextQuantity = (remoteTarget.quantity ?? 0) + input.quantity!;
      const rate = input.marketRateRub ?? remoteTarget.marketRateRub ?? 0;
      const valueRub =
        input.marketValueRub != null && input.quantity != null && rate > 0
          ? Math.round(nextQuantity * rate * 100) / 100
          : Math.round((remoteTarget.amount + input.amount) * 100) / 100;
      const fetchedAt = input.marketFetchedAt ?? new Date().toISOString();

      const asset = await updateCapitalAssetMarket(remoteTarget.id, {
        quantity: nextQuantity,
        amount: valueRub,
        marketRateRub: rate,
        marketValueRub: valueRub,
        marketFetchedAt: fetchedAt,
        name: remoteTarget.name || input.name,
      });

      return { asset, merged: true };
    }
  }

  const asset = await insertCapitalAsset({
    ...input,
    unit:
      input.valuationMode === 'market' && input.unit
        ? normalizeCapitalUnit(input.assetType, input.unit)
        : input.unit,
  });

  return { asset, merged: false };
}

export async function insertCapitalAsset(input: UpsertCapitalAssetInput): Promise<CapitalAsset> {
  const client = supabase;
  if (!client) throw new Error('Supabase не настроен.');

  const row = buildMarketAssetRow(input);

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
