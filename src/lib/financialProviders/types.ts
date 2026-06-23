import type {
  FinancialAccountKind,
  FinancialConnectionStatus,
  FinancialProviderKind,
} from '../../types/financialConnections';

/** Нормализованная операция от любого провайдера → upsert в transactions. */
export type ProviderTransaction = {
  externalId: string;
  kind: 'expense' | 'income';
  amount: number;
  currency: string;
  title: string;
  categoryHint?: string;
  date: string;
  raw?: Record<string, unknown>;
};

export type ProviderAccount = {
  externalAccountId: string;
  name: string;
  accountKind: FinancialAccountKind;
  currency: string;
  balance?: number | null;
};

export type SyncResult = {
  accounts: ProviderAccount[];
  transactions: ProviderTransaction[];
  syncCursor?: Record<string, unknown>;
};

export type FinancialProviderAdapter = {
  id: string;
  kind: FinancialProviderKind;
  /** OAuth URL или null если провайдер ещё недоступен. */
  buildAuthorizeUrl?(params: { redirectUri: string; state: string }): string | null;
  /** Синхронизация по сохранённым токенам (вызывается на сервере). */
  sync(params: {
    accessToken: string;
    syncCursor: Record<string, unknown>;
  }): Promise<SyncResult>;
};

export type MockSyncOptions = {
  connectionLabel: string;
};

/** Заглушка для разработки UI и Edge Function до реального OAuth. */
export function createMockBankSync(options: MockSyncOptions): SyncResult {
  const accountId = `mock-${options.connectionLabel}`;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  return {
    accounts: [
      {
        externalAccountId: accountId,
        name: `Демо-счёт · ${options.connectionLabel}`,
        accountKind: 'checking',
        currency: 'RUB',
        balance: 42_500,
      },
    ],
    transactions: [
      {
        externalId: `${accountId}-tx-1`,
        kind: 'expense',
        amount: 890,
        currency: 'RUB',
        title: 'Пятёрочка',
        categoryHint: 'Продукты',
        date: today,
      },
      {
        externalId: `${accountId}-tx-2`,
        kind: 'expense',
        amount: 350,
        currency: 'RUB',
        title: 'Кофе',
        categoryHint: 'Кафе',
        date: yesterday,
      },
      {
        externalId: `${accountId}-tx-3`,
        kind: 'income',
        amount: 85_000,
        currency: 'RUB',
        title: 'Зарплата',
        categoryHint: 'Зарплата',
        date: yesterday,
      },
    ],
    syncCursor: { mock: true, syncedAt: new Date().toISOString() },
  };
}

export function mapCategoryHint(hint?: string): string {
  if (!hint) return 'Другое';
  const normalized = hint.trim().toLowerCase();
  const map: Record<string, string> = {
    продукты: 'Продукты',
    кафе: 'Кафе',
    зарплата: 'Зарплата',
    транспорт: 'Транспорт',
    жкх: 'ЖКХ',
  };
  for (const [key, value] of Object.entries(map)) {
    if (normalized.includes(key)) return value;
  }
  return hint.length <= 32 ? hint : 'Другое';
}

export function connectionStatusLabel(status: FinancialConnectionStatus): string {
  const labels: Record<FinancialConnectionStatus, string> = {
    pending: 'Подключается',
    active: 'Активно',
    error: 'Ошибка',
    revoked: 'Отключено',
    expired: 'Истекло',
  };
  return labels[status] ?? status;
}
