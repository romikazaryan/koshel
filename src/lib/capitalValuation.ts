import {
  canonicalizeCryptoUnit,
  getRateSourceLabel,
  getUnitSymbol,
  isCryptoMarketUnit,
  isFxUnit,
  normalizeStockTicker,
  resolveMoexTicker,
  type FxUnit,
} from '../constants/marketUnits';
import type { CapitalAsset } from '../types';
import {
  ensureCryptoRatesForUnits,
  fetchFxRatesRub,
  fetchMarketRateRub,
  fetchMoexStockRatesRub,
  getCryptoRateFromMap,
} from './marketRates';

export type AssetValuation = {
  valueRub: number;
  rateRubPerUnit?: number;
  quantity?: number;
  unit?: string;
  unitSymbol?: string;
  source?: 'coingecko' | 'cbr' | 'moex' | 'manual' | 'cached';
  fetchedAt?: string;
  error?: string;
};

export type BuildValuationsOptions = {
  /** Принудительно обновить рыночные котировки (MOEX + CoinGecko). */
  forceMoex?: boolean;
};

function hasSpotRate(valuation?: AssetValuation): boolean {
  return valuation?.rateRubPerUnit != null && valuation.rateRubPerUnit > 0;
}

function lookupCryptoRateRub(unit: string, cryptoRates: Record<string, number>): number | undefined {
  return getCryptoRateFromMap(unit, cryptoRates);
}

/** Не затираем котировку, если новый ответ API/кэша пришёл без курса. */
export function mergeFreshMoexValuations(
  prev: Record<string, AssetValuation>,
  next: Record<string, AssetValuation>
): Record<string, AssetValuation> {
  const merged: Record<string, AssetValuation> = { ...prev };

  for (const [id, valuation] of Object.entries(next)) {
    const previous = prev[id];

    if (hasSpotRate(valuation)) {
      if (!hasSpotRate(previous)) {
        merged[id] = valuation;
        continue;
      }

      const nextIsLive =
        valuation.source === 'coingecko' || valuation.source === 'moex';
      const prevIsLive =
        previous?.source === 'coingecko' || previous?.source === 'moex';

      if (nextIsLive || !prevIsLive) {
        merged[id] = valuation;
      }
      continue;
    }

    if (hasSpotRate(previous)) {
      continue;
    }

    merged[id] = valuation;
  }

  return merged;
}

export function getAssetRubValue(asset: CapitalAsset, valuation?: AssetValuation): number {
  if (valuation?.valueRub != null && valuation.valueRub > 0) return valuation.valueRub;
  if (asset.valuationMode === 'market' && asset.marketValueRub != null && asset.marketValueRub > 0) {
    return asset.marketValueRub;
  }
  return asset.amount;
}

export function getCapitalTotalWithValuations(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>
): number {
  return assets
    .filter((item) => item.isActive)
    .reduce((sum, item) => sum + getAssetRubValue(item, valuations[item.id]), 0);
}

export function formatQuantityLabel(quantity: number, unit: string) {
  const symbol = getUnitSymbol(unit);
  const formatted =
    quantity >= 1
      ? quantity.toLocaleString('ru-RU', { maximumFractionDigits: 6 })
      : quantity.toLocaleString('ru-RU', { maximumFractionDigits: 8 });
  return `${formatted} ${symbol}`;
}

export function formatRateLabel(rateRub: number, unit: string, assetType?: string) {
  const symbol = getUnitSymbol(unit);
  const source = getRateSourceLabel(unit, assetType);
  const shareHint = assetType === 'stocks' ? ' за акцию' : '';
  return `1 ${symbol}${shareHint} = ₽${rateRub.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}${source ? ` · ${source}` : ''}`;
}

export function formatValuationAge(fetchedAt?: string) {
  if (!fetchedAt) return '';
  const diffMs = Date.now() - new Date(fetchedAt).getTime();
  if (diffMs < 60_000) return 'только что';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

function resolveStoredMarketRate(asset: CapitalAsset): number | undefined {
  if (asset.marketRateRub != null && asset.marketRateRub > 0) {
    return asset.marketRateRub;
  }
  const quantity = asset.quantity;
  if (quantity == null || quantity <= 0) return undefined;

  const valueRub =
    asset.marketValueRub != null && asset.marketValueRub > 0
      ? asset.marketValueRub
      : asset.amount > 0
        ? asset.amount
        : undefined;
  if (valueRub == null || valueRub <= 0) return undefined;

  return Math.round((valueRub / quantity) * 100) / 100;
}

function collectCryptoUnits(assets: CapitalAsset[]): string[] {
  return [
    ...new Set(
      assets
        .filter(
          (asset) =>
            asset.unit &&
            (asset.assetType === 'crypto' || isCryptoMarketUnit(asset.unit))
        )
        .flatMap((asset) => {
          const canonical = canonicalizeCryptoUnit(asset.unit!);
          return canonical === asset.unit ? [canonical] : [canonical, asset.unit!];
        })
        .filter((unit) => isCryptoMarketUnit(unit))
        .map((unit) => canonicalizeCryptoUnit(unit))
    ),
  ];
}

function isCryptoHoldings(asset: CapitalAsset): boolean {
  return (
    asset.assetType === 'crypto' &&
    asset.quantity != null &&
    asset.quantity > 0 &&
    Boolean(asset.unit) &&
    isCryptoMarketUnit(asset.unit!)
  );
}

export async function buildCapitalValuations(
  assets: CapitalAsset[],
  options: BuildValuationsOptions = {}
): Promise<Record<string, AssetValuation>> {
  const marketAssets = assets.filter(
    (item) => item.valuationMode === 'market' && item.quantity && item.unit
  );
  const cryptoUnits = collectCryptoUnits(assets);
  const fxUnits = [...new Set(marketAssets.map((a) => a.unit!).filter(isFxUnit))] as FxUnit[];
  const stockTickers = [
    ...new Set(
      marketAssets
        .filter((a) => a.assetType === 'stocks' && a.unit)
        .flatMap((a) => {
          const normalized = normalizeStockTicker(a.unit!);
          const moex = resolveMoexTicker(a.unit!);
          return normalized === moex ? [normalized] : [normalized, moex];
        })
    ),
  ];

  let cryptoRates: Record<string, number> = {};
  let fxRates: Partial<Record<FxUnit, number>> = {};
  let stockRates: Record<string, number> = {};
  let fetchError: string | undefined;

  try {
    const forceSpot = options.forceMoex === true;
    [cryptoRates, fxRates, stockRates] = await Promise.all([
      ensureCryptoRatesForUnits(cryptoUnits, { force: forceSpot }),
      fetchFxRatesRub(fxUnits),
      fetchMoexStockRatesRub(stockTickers, { force: forceSpot }),
    ]);
  } catch (error) {
    fetchError = error instanceof Error ? error.message : 'Не удалось загрузить курсы';
  }

  const now = new Date().toISOString();
  const result: Record<string, AssetValuation> = {};

  for (const asset of assets) {
    const hasCryptoHoldings = isCryptoHoldings(asset);

    if (!hasCryptoHoldings && (asset.valuationMode !== 'market' || !asset.quantity || !asset.unit)) {
      result[asset.id] = {
        valueRub: asset.amount,
        source: 'manual',
      };
      continue;
    }

    const unit = asset.unit;
    const quantity = asset.quantity;
    if (!unit || !quantity) {
      result[asset.id] = {
        valueRub: asset.amount,
        source: 'manual',
      };
      continue;
    }

    const stockTicker =
      asset.assetType === 'stocks' ? resolveMoexTicker(unit) : '';
    const isCryptoAsset = asset.assetType === 'crypto' || isCryptoMarketUnit(unit);
    const isBondAsset = asset.assetType === 'bonds';

    const skipDbFallback = options.forceMoex === true && asset.assetType === 'stocks';
    const rate =
      (isCryptoAsset
        ? lookupCryptoRateRub(unit, cryptoRates)
        : isBondAsset
          ? resolveStoredMarketRate(asset)
          : isFxUnit(unit)
          ? fxRates[unit]
          : asset.assetType === 'stocks'
            ? stockRates[stockTicker] ?? stockRates[normalizeStockTicker(unit)]
            : undefined) ??
      (skipDbFallback ? undefined : resolveStoredMarketRate(asset)) ??
      undefined;

    if (rate == null || rate <= 0) {
      const fallbackRate = resolveStoredMarketRate(asset);
      result[asset.id] = {
        valueRub: asset.marketValueRub ?? asset.amount,
        rateRubPerUnit: fallbackRate,
        quantity,
        unit,
        unitSymbol: getUnitSymbol(unit),
        source: fallbackRate ? 'cached' : asset.marketValueRub ? 'cached' : 'manual',
        fetchedAt: asset.marketFetchedAt,
        error: fetchError && !fallbackRate ? 'Курс недоступен' : undefined,
      };
      continue;
    }

    const valueRub = Math.round(quantity * rate * 100) / 100;
    result[asset.id] = {
      valueRub,
      rateRubPerUnit: rate,
      quantity,
      unit,
      unitSymbol: getUnitSymbol(unit),
      source: isCryptoAsset
        ? 'coingecko'
        : isBondAsset
          ? 'cached'
          : isFxUnit(unit)
            ? 'cbr'
            : 'moex',
      fetchedAt: now,
    };
  }

  for (const asset of assets) {
    if (!asset.unit || !asset.quantity || asset.quantity <= 0) continue;
    if (!(asset.assetType === 'crypto' || isCryptoMarketUnit(asset.unit))) continue;
    if (hasSpotRate(result[asset.id])) continue;

    try {
      const rate = await fetchMarketRateRub(asset.unit, 'crypto');
      if (rate == null || rate <= 0) continue;
      const valueRub = Math.round(asset.quantity * rate * 100) / 100;
      result[asset.id] = {
        valueRub,
        rateRubPerUnit: rate,
        quantity: asset.quantity,
        unit: asset.unit,
        unitSymbol: getUnitSymbol(asset.unit),
        source: 'coingecko',
        fetchedAt: now,
      };
    } catch (error) {
      console.warn('buildCapitalValuations crypto backfill failed', asset.unit, error);
    }
  }

  return result;
}

export function collectMarketSnapshots(
  assets: CapitalAsset[],
  valuations: Record<string, AssetValuation>
) {
  return assets
    .filter((asset) => asset.valuationMode === 'market')
    .map((asset) => {
      const valuation = valuations[asset.id];
      if (!valuation?.rateRubPerUnit || !valuation.fetchedAt) return null;
      return {
        id: asset.id,
        marketRateRub: valuation.rateRubPerUnit,
        marketValueRub: valuation.valueRub,
        marketFetchedAt: valuation.fetchedAt,
        amount: valuation.valueRub,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}
