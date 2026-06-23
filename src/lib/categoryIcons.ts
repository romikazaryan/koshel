import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const CATEGORY_ICONS: Record<string, IoniconName> = {
  Продукты: 'cart-outline',
  Транспорт: 'car-sport-outline',
  Кафе: 'cafe-outline',
  Развлечения: 'film-outline',
  ЖКХ: 'home-outline',
  Одежда: 'shirt-outline',
  Здоровье: 'fitness-outline',
  Онлайн: 'bag-handle-outline',
  Другое: 'ellipsis-horizontal',
};

export function getCategoryIcon(label: string): IoniconName {
  return CATEGORY_ICONS[label] ?? 'pricetag-outline';
}
