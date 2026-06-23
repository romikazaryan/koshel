export type FinancialProviderKind = 'bank' | 'broker' | 'crypto';

export type FinancialConnectionStatus =
  | 'pending'
  | 'active'
  | 'error'
  | 'revoked'
  | 'expired';

export type FinancialAccountKind =
  | 'checking'
  | 'savings'
  | 'credit'
  | 'brokerage'
  | 'crypto_wallet'
  | 'other';

export type FinancialProviderAvailability = 'available' | 'coming_soon' | 'beta';

export type FinancialProviderDefinition = {
  id: string;
  kind: FinancialProviderKind;
  name: string;
  description: string;
  availability: FinancialProviderAvailability;
  /** Импорт выписки CSV/PDF с главной. */
  statementImport?: boolean;
  /** Порядок в списке выбора банка (меньше — выше). */
  sortOrder?: number;
};

export type FinancialConnection = {
  id: string;
  providerKind: FinancialProviderKind;
  providerId: string;
  status: FinancialConnectionStatus;
  displayName: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
};

export type FinancialAccount = {
  id: string;
  connectionId: string;
  externalAccountId: string;
  name: string;
  accountKind: FinancialAccountKind;
  currency: string;
  balance: number | null;
  balanceUpdatedAt: string | null;
  isActive: boolean;
};

export const FINANCIAL_PROVIDERS: FinancialProviderDefinition[] = [
  {
    id: 'tbank',
    kind: 'bank',
    name: 'Т‑Банк',
    description: 'Выписка CSV или PDF из приложения · автосинк — после Open Finance',
    availability: 'beta',
    statementImport: true,
    sortOrder: 10,
  },
  {
    id: 'sber',
    kind: 'bank',
    name: 'Сбербанк',
    description: 'Выписка CSV или PDF · в т.ч. кредитная карта',
    availability: 'beta',
    statementImport: true,
    sortOrder: 20,
  },
  {
    id: 'vtb',
    kind: 'bank',
    name: 'ВТБ',
    description: 'Выписка CSV или PDF из ВТБ Онлайн',
    availability: 'beta',
    statementImport: true,
    sortOrder: 30,
  },
  {
    id: 'alfa',
    kind: 'bank',
    name: 'Альфа-Банк',
    description: 'Выписка CSV или PDF из приложения',
    availability: 'beta',
    statementImport: true,
    sortOrder: 40,
  },
  {
    id: 'raiffeisen',
    kind: 'bank',
    name: 'Райффайзенбанк',
    description: 'Выписка CSV или PDF из онлайн-банка',
    availability: 'beta',
    statementImport: true,
    sortOrder: 50,
  },
  {
    id: 'gazprombank',
    kind: 'bank',
    name: 'Газпромбанк',
    description: 'Выписка CSV или PDF',
    availability: 'beta',
    statementImport: true,
    sortOrder: 60,
  },
  {
    id: 'ozon',
    kind: 'bank',
    name: 'Ozon Банк',
    description: 'Выписка CSV или PDF из приложения Ozon',
    availability: 'beta',
    statementImport: true,
    sortOrder: 70,
  },
  {
    id: 'psb',
    kind: 'bank',
    name: 'ПСБ',
    description: 'Промсвязьбанк · выписка CSV или PDF',
    availability: 'beta',
    statementImport: true,
    sortOrder: 80,
  },
  {
    id: 'yandex',
    kind: 'bank',
    name: 'Яндекс Банк',
    description: 'Выписка CSV или PDF',
    availability: 'beta',
    statementImport: true,
    sortOrder: 90,
  },
  {
    id: 'sovcombank',
    kind: 'bank',
    name: 'Совкомбанк',
    description: 'Выписка CSV или PDF',
    availability: 'beta',
    statementImport: true,
    sortOrder: 100,
  },
  {
    id: 'rosbank',
    kind: 'bank',
    name: 'Росбанк',
    description: 'Выписка CSV или PDF',
    availability: 'beta',
    statementImport: true,
    sortOrder: 110,
  },
  {
    id: 'tinkoff_invest',
    kind: 'broker',
    name: 'T-Invest',
    description: 'Read-only токен → портфель в «Капитал», дивиденды и комиссии',
    availability: 'available',
  },
  {
    id: 'bcs',
    kind: 'broker',
    name: 'БКС',
    description: 'Брокерский счёт',
    availability: 'coming_soon',
  },
  {
    id: 'exchange_readonly',
    kind: 'crypto',
    name: 'Биржа (read-only)',
    description: 'API-ключ только на чтение',
    availability: 'coming_soon',
  },
  {
    id: 'onchain',
    kind: 'crypto',
    name: 'On-chain кошелёк',
    description: 'Просмотр баланса по адресу',
    availability: 'coming_soon',
  },
];

export function getProvidersByKind(kind: FinancialProviderKind) {
  return FINANCIAL_PROVIDERS.filter((item) => item.kind === kind).sort(
    (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)
  );
}

export function getStatementImportBanks() {
  return FINANCIAL_PROVIDERS.filter((item) => item.kind === 'bank' && item.statementImport).sort(
    (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)
  );
}

export function getProviderDefinition(providerId: string) {
  return FINANCIAL_PROVIDERS.find((item) => item.id === providerId);
}

export const PROVIDER_KIND_LABELS: Record<FinancialProviderKind, string> = {
  bank: 'Банки',
  broker: 'Брокеры',
  crypto: 'Крипто',
};

export const CONNECTION_STATUS_LABELS: Record<FinancialConnectionStatus, string> = {
  pending: 'Подключается',
  active: 'Активно',
  error: 'Ошибка',
  revoked: 'Отключено',
  expired: 'Истекло',
};
