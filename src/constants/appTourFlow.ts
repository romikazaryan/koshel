import type { Ionicons } from '@expo/vector-icons';
import type { AppTourStepId, AppTourTabHighlight } from '../types/appTour';

export const APP_TOUR_FEATURE_STEP_COUNT = 4;

export const APP_TOUR_STEP_ORDER: AppTourStepId[] = [
  'welcome',
  'dashboard',
  'operations',
  'imports',
  'finances',
  'complete',
];

type FeatureIcon = keyof typeof Ionicons.glyphMap;

export type AppTourFeature = {
  icon: FeatureIcon;
  text: string;
};

export type AppTourFeatureStep = {
  id: Exclude<AppTourStepId, 'welcome' | 'complete'>;
  tabHighlight: AppTourTabHighlight;
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: FeatureIcon;
  mockLabel: string;
  mockValue: string;
  mockHint: string;
  features: AppTourFeature[];
};

export const APP_TOUR_FEATURE_STEPS: AppTourFeatureStep[] = [
  {
    id: 'dashboard',
    tabHighlight: 'Home',
    eyebrow: 'Главная',
    title: 'Дашборд месяца',
    subtitle: 'Баланс, лимит и картина трат — на одном экране',
    icon: 'home',
    mockLabel: 'Остаток месяца',
    mockValue: '+42 300 ₽',
    mockHint: 'Лимит 120 000 ₽ · 65% использовано',
    features: [
      { icon: 'wallet-outline', text: 'Доходы и расходы за текущий месяц' },
      { icon: 'speedometer-outline', text: 'Лимит трат с прогресс-баром' },
      { icon: 'pie-chart-outline', text: 'Категории и health score' },
    ],
  },
  {
    id: 'operations',
    tabHighlight: 'Home',
    eyebrow: 'Операции',
    title: 'Траты и доходы',
    subtitle: 'Быстрый ввод — без лишних экранов',
    icon: 'swap-horizontal',
    mockLabel: 'Новая операция',
    mockValue: '−1 250 ₽',
    mockHint: 'Продукты · сегодня, 14:32',
    features: [
      { icon: 'add-circle-outline', text: 'Расход, доход, долг и подписка' },
      { icon: 'mic-outline', text: 'Голосом или по фото чека' },
      { icon: 'time-outline', text: 'История и редактирование записей' },
    ],
  },
  {
    id: 'imports',
    tabHighlight: 'Home',
    eyebrow: 'Импорт и AI',
    title: 'Выписки и разбор',
    subtitle: 'Меньше ручного ввода — больше ясности',
    icon: 'sparkles',
    mockLabel: 'AI-разбор июня',
    mockValue: '3 совета',
    mockHint: 'Выписка Т-Банка · 48 операций',
    features: [
      { icon: 'document-text-outline', text: 'CSV и PDF с банка' },
      { icon: 'share-outline', text: '«Поделиться» из другого приложения' },
      { icon: 'bulb-outline', text: 'Рекомендации по тратам месяца' },
    ],
  },
  {
    id: 'finances',
    tabHighlight: 'Finances',
    eyebrow: 'Финансы',
    title: 'Капитал и активы',
    subtitle: 'Портфель рядом с ежедневным бюджетом',
    icon: 'wallet',
    mockLabel: 'Чистый капитал',
    mockValue: '1,84 млн ₽',
    mockHint: 'Акции · крипта · вклады',
    features: [
      { icon: 'trending-up-outline', text: 'MOEX, крипта и ручной учёт' },
      { icon: 'sync-outline', text: 'Синхронизация T-Invest' },
      { icon: 'link-outline', text: 'Банки — в разделе «Профиль»' },
    ],
  },
];

export function appTourFeatureIndex(step: AppTourStepId): number {
  const idx = APP_TOUR_FEATURE_STEPS.findIndex((s) => s.id === step);
  return idx >= 0 ? idx + 1 : 0;
}

export function appTourStepDef(step: AppTourStepId): AppTourFeatureStep | null {
  return APP_TOUR_FEATURE_STEPS.find((s) => s.id === step) ?? null;
}
