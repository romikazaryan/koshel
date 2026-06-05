import type { CapitalAssetType } from '../types';

export const CAPITAL_ASSET_TYPES: { value: CapitalAssetType; label: string }[] = [
  { value: 'deposit', label: 'Вклад' },
  { value: 'crypto', label: 'Криптовалюта' },
  { value: 'real_estate', label: 'Недвижимость' },
  { value: 'stocks', label: 'Акции / брокер' },
  { value: 'cash', label: 'Наличные' },
  { value: 'other', label: 'Другое' },
];

export function getCapitalAssetTypeLabel(type: string) {
  return CAPITAL_ASSET_TYPES.find((item) => item.value === type)?.label ?? 'Другое';
}
