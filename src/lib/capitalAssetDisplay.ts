import {
  getHistoryPeriodDays,
  type CapitalHistoryPeriod,
} from '../constants/capitalFilters';
import {
  getFxUnitLabel,
  getUnitSymbol,
  resolveTinvestCurrencyUnit,
} from '../constants/marketUnits';
import { isBrokerSyncedAsset } from './capital';
import type { RateHistoryInsight } from './capitalHistory';
import type { AssetValuation } from './capitalValuation';
import type { CapitalAsset } from '../types';

const BROKER_SOURCE_LABEL = 'T-Invest';

function parseNameParts(name: string) {
  return name
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);
}

function resolveLegacyBrokerTitle(item: CapitalAsset, symbol: string): string {
  if (item.assetType === 'cash' && item.unit) {
    const fxLabel = getFxUnitLabel(resolveTinvestCurrencyUnit(item.unit));
    if (fxLabel) return fxLabel;
  }
  return symbol;
}

export function getMarketAssetDisplay(item: CapitalAsset) {
  const parts = parseNameParts(item.name);
  const broker = isBrokerSyncedAsset(item);
  const unitSymbol = item.unit ? getUnitSymbol(item.unit) : undefined;

  let symbol = unitSymbol ?? parts[0] ?? '?';
  let title = item.name;
  let sourceLabel: string | undefined;

  if (parts.length >= 2) {
    symbol = parts[0];
    const namePart = parts.slice(1).join(' · ');

    if (namePart === BROKER_SOURCE_LABEL && broker) {
      title = resolveLegacyBrokerTitle(item, symbol);
      sourceLabel = BROKER_SOURCE_LABEL;
    } else {
      title = namePart;
      sourceLabel = broker ? BROKER_SOURCE_LABEL : undefined;
    }
  } else if (broker) {
    sourceLabel = BROKER_SOURCE_LABEL;
    if (item.assetType === 'cash' && item.unit) {
      title = getFxUnitLabel(resolveTinvestCurrencyUnit(item.unit)) ?? title;
      symbol = getUnitSymbol(item.unit);
    }
  }

  return { title, symbol, sourceLabel };
}

export function formatCompactQuantitySubtitle(
  item: CapitalAsset,
  valuation?: AssetValuation
) {
  const quantity = item.quantity;
  const rate = valuation?.rateRubPerUnit ?? item.marketRateRub;
  if (quantity == null || !item.unit) return '';

  const symbol = getUnitSymbol(item.unit);
  const qty =
    quantity >= 1
      ? quantity.toLocaleString('ru-RU', { maximumFractionDigits: 4 })
      : quantity.toLocaleString('ru-RU', { maximumFractionDigits: 6 });

  if (rate == null || rate <= 0) {
    if (item.assetType === 'stocks' || item.assetType === 'bonds') {
      return `${qty} шт`;
    }
    return `${qty} ${symbol}`;
  }

  const price = rate.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (item.assetType === 'stocks' || item.assetType === 'bonds') {
    return `${qty} шт × ${price} ₽`;
  }

  if (item.assetType === 'crypto') {
    return `${qty} ${symbol} × ${price} ₽`;
  }

  if (item.assetType === 'cash') {
    return `${qty} ${symbol} × ${price} ₽`;
  }

  return `${qty} ${symbol} × ${price} ₽`;
}

export function formatCompactHistoryChange(insight: RateHistoryInsight) {
  const sign = insight.changeRub > 0 ? '+' : insight.changeRub < 0 ? '−' : '';
  const rub = Math.abs(insight.changeRub).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const pct = insight.changePercent.toLocaleString('ru-RU', {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
  return `${sign}${rub} ₽ · ${pct}%`;
}

export function formatCompactValueRub(valueRub: number) {
  return valueRub.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildPurchaseInsight(
  item: CapitalAsset,
  valuation?: AssetValuation
): RateHistoryInsight | null {
  const avg = item.avgPurchaseRateRub;
  const quantity = item.quantity;
  const currentRate = valuation?.rateRubPerUnit ?? item.marketRateRub;
  if (
    avg == null ||
    avg <= 0 ||
    quantity == null ||
    quantity <= 0 ||
    currentRate == null ||
    currentRate <= 0
  ) {
    return null;
  }

  const pastValueRub = round2(quantity * avg);
  const currentValueRub = round2(quantity * currentRate);
  const changeRub = round2(currentValueRub - pastValueRub);
  const changePercent =
    pastValueRub > 0 ? Math.round((changeRub / pastValueRub) * 1000) / 10 : 0;

  return {
    daysAgo: 365,
    pastValueRub,
    currentValueRub,
    changeRub,
    changePercent,
    source: 'market',
  };
}

function hasPurchaseDynamics(item: CapitalAsset) {
  return (
    item.avgPurchaseRateRub != null &&
    item.avgPurchaseRateRub > 0 &&
    (item.assetType === 'stocks' || item.assetType === 'bonds')
  );
}

/** «За сегодня» — рыночная динамика; «за всё время» — P&L от средней покупки. */
export function resolveAssetDynamicsInsight(
  item: CapitalAsset,
  valuation: AssetValuation | undefined,
  historyInsight: RateHistoryInsight | undefined,
  period: CapitalHistoryPeriod
): RateHistoryInsight | undefined {
  if (period === 'd365' && hasPurchaseDynamics(item)) {
    return buildPurchaseInsight(item, valuation) ?? historyInsight;
  }
  return historyInsight;
}

function assetExpectsDynamics(item: CapitalAsset, period: CapitalHistoryPeriod): boolean {
  if (!item.isActive) return false;
  if (period === 'd365' && hasPurchaseDynamics(item)) return true;
  return item.assetType === 'stocks' || item.assetType === 'crypto' || item.assetType === 'bonds';
}

export type AssetsSectionMetrics = {
  totalRub: number;
  activeCount: number;
  insight: RateHistoryInsight | null;
  dynamicsExpected: number;
  dynamicsResolved: number;
};

export function aggregateAssetsSectionMetrics(
  items: CapitalAsset[],
  valuations: Record<string, AssetValuation | undefined>,
  historyInsights: Record<string, RateHistoryInsight | undefined>,
  period: CapitalHistoryPeriod
): AssetsSectionMetrics {
  let totalRub = 0;
  let activeCount = 0;
  let pastValueRub = 0;
  let currentValueRub = 0;
  let changeRub = 0;
  let dynamicsExpected = 0;
  let dynamicsResolved = 0;

  for (const item of items) {
    if (!item.isActive) continue;
    activeCount += 1;
    const valuation = valuations[item.id];
    totalRub += valuation?.valueRub ?? item.amount;

    if (!assetExpectsDynamics(item, period)) continue;
    dynamicsExpected += 1;

    const insight = resolveAssetDynamicsInsight(
      item,
      valuation,
      historyInsights[item.id],
      period
    );
    if (!insight) continue;

    dynamicsResolved += 1;
    pastValueRub += insight.pastValueRub;
    currentValueRub += insight.currentValueRub;
    changeRub += insight.changeRub;
  }

  const insight =
    dynamicsResolved > 0
      ? {
          daysAgo: getHistoryPeriodDays(period),
          pastValueRub: round2(pastValueRub),
          currentValueRub: round2(currentValueRub),
          changeRub: round2(changeRub),
          changePercent:
            pastValueRub > 0 ? Math.round((changeRub / pastValueRub) * 1000) / 10 : 0,
          source: 'market' as const,
        }
      : null;

  return {
    totalRub: round2(totalRub),
    activeCount,
    insight,
    dynamicsExpected,
    dynamicsResolved,
  };
}
