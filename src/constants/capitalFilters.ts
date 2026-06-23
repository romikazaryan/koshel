import type { CapitalAssetType } from '../types';

export type CapitalAssetFilter = 'all' | CapitalAssetType;

export type CapitalHistoryPeriod = 'd1' | 'd365';

export const CAPITAL_FILTER_LABELS: Record<CapitalAssetFilter, string> = {
  all: 'Все',
  deposit: 'Вклады',
  crypto: 'Крипта',
  real_estate: 'Недвижимость',
  stocks: 'Акции',
  bonds: 'Облигации',
  cash: 'Валюта',
  other: 'Другое',
};

/** 2 периода: дневная динамика и результат с момента покупки (брокер). */
export const CAPITAL_HISTORY_PERIODS: {
  value: CapitalHistoryPeriod;
  label: string;
  shortLabel: string;
  /** Подпись в стиле T-Invest — тап переключает период. */
  cycleLabel: string;
  days: number;
}[] = [
  { value: 'd1', label: 'Сегодня', shortLabel: '1д', cycleLabel: 'за сегодня', days: 1 },
  { value: 'd365', label: 'Всё время', shortLabel: 'всё', cycleLabel: 'за всё время', days: 365 },
];

export function getHistoryPeriodDays(period: CapitalHistoryPeriod): number {
  return CAPITAL_HISTORY_PERIODS.find((item) => item.value === period)?.days ?? 1;
}

export function getHistoryPeriodLabel(period: CapitalHistoryPeriod): string {
  return CAPITAL_HISTORY_PERIODS.find((item) => item.value === period)?.shortLabel ?? '7 дн.';
}

export function getHistoryPeriodCycleLabel(period: CapitalHistoryPeriod): string {
  return CAPITAL_HISTORY_PERIODS.find((item) => item.value === period)?.cycleLabel ?? 'за неделю';
}

export function getNextHistoryPeriod(period: CapitalHistoryPeriod): CapitalHistoryPeriod {
  const index = CAPITAL_HISTORY_PERIODS.findIndex((item) => item.value === period);
  if (index < 0) return 'd1';
  return CAPITAL_HISTORY_PERIODS[(index + 1) % CAPITAL_HISTORY_PERIODS.length].value;
}

const FILTER_ORDER: CapitalAssetType[] = [
  'stocks',
  'bonds',
  'crypto',
  'cash',
  'deposit',
  'real_estate',
  'other',
];

export function getNextAssetFilter(
  current: CapitalAssetFilter,
  options: { value: CapitalAssetFilter }[]
): CapitalAssetFilter {
  if (options.length === 0) return current;
  const index = options.findIndex((option) => option.value === current);
  if (index < 0) return options[0].value;
  return options[(index + 1) % options.length].value;
}

export function buildAssetFilterOptions(items: { assetType: CapitalAssetType }[]) {
  const counts = items.reduce<Partial<Record<CapitalAssetType, number>>>((acc, item) => {
    acc[item.assetType] = (acc[item.assetType] ?? 0) + 1;
    return acc;
  }, {});

  return FILTER_ORDER.filter((value) => (counts[value] ?? 0) > 0).map((value) => ({
    value: value as CapitalAssetFilter,
    label: CAPITAL_FILTER_LABELS[value],
    count: counts[value] ?? 0,
  }));
}
