import {
  getRateSourceLabel,
  getUnitSymbol,
  isCryptoMarketUnit,
  isFxUnit,
  normalizeStockTicker,
  type FxUnit,
} from '../constants/marketUnits';
import type { CapitalAsset } from '../types';
import { fetchCryptoRatesRub, fetchFxRatesRub, fetchMoexStockRatesRub } from './marketRates';

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

export async function buildCapitalValuations(
  assets: CapitalAsset[]
): Promise<Record<string, AssetValuation>> {
  const marketAssets = assets.filter(
    (item) => item.valuationMode === 'market' && item.quantity && item.unit
  );
  const cryptoUnits = [
    ...new Set(marketAssets.map((a) => a.unit!).filter(isCryptoMarketUnit)),
  ];
  const fxUnits = [...new Set(marketAssets.map((a) => a.unit!).filter(isFxUnit))] as FxUnit[];
  const stockTickers = [
    ...new Set(
      marketAssets
        .filter((a) => a.assetType === 'stocks' && a.unit)
        .map((a) => normalizeStockTicker(a.unit!))
    ),
  ];

  let cryptoRates: Record<string, number> = {};
  let fxRates: Partial<Record<FxUnit, number>> = {};
  let stockRates: Record<string, number> = {};
  let fetchError: string | undefined;

  try {
    [cryptoRates, fxRates, stockRates] = await Promise.all([
      fetchCryptoRatesRub(cryptoUnits),
      fetchFxRatesRub(fxUnits),
      fetchMoexStockRatesRub(stockTickers),
    ]);
  } catch (error) {
    fetchError = error instanceof Error ? error.message : 'Не удалось загрузить курсы';
  }

  const now = new Date().toISOString();
  const result: Record<string, AssetValuation> = {};

  for (const asset of assets) {
    if (asset.valuationMode !== 'market' || !asset.quantity || !asset.unit) {
      result[asset.id] = {
        valueRub: asset.amount,
        source: 'manual',
      };
      continue;
    }

    const unit = asset.unit;
    const stockTicker = asset.assetType === 'stocks' ? normalizeStockTicker(unit) : '';
    const rate =
      (isCryptoMarketUnit(unit)
        ? cryptoRates[unit]
        : isFxUnit(unit)
          ? fxRates[unit]
          : asset.assetType === 'stocks'
            ? stockRates[stockTicker]
            : undefined) ??
      asset.marketRateRub ??
      undefined;

    if (rate == null || rate <= 0) {
      result[asset.id] = {
        valueRub: asset.marketValueRub ?? asset.amount,
        quantity: asset.quantity,
        unit,
        unitSymbol: getUnitSymbol(unit),
        source: asset.marketValueRub ? 'cached' : 'manual',
        fetchedAt: asset.marketFetchedAt,
        error: fetchError ?? 'Курс недоступен',
      };
      continue;
    }

    const valueRub = Math.round(asset.quantity * rate * 100) / 100;
    result[asset.id] = {
      valueRub,
      rateRubPerUnit: rate,
      quantity: asset.quantity,
      unit,
      unitSymbol: getUnitSymbol(unit),
      source: isCryptoMarketUnit(unit) ? 'coingecko' : isFxUnit(unit) ? 'cbr' : 'moex',
      fetchedAt: now,
    };
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
