export type Category =
  | 'Продукты'
  | 'Транспорт'
  | 'Кафе'
  | 'Развлечения'
  | 'ЖКХ'
  | 'Одежда'
  | 'Здоровье'
  | 'Онлайн'
  | 'Другое';

export type IncomeCategory = 'Зарплата' | 'Подработка' | 'Подарок' | 'Возврат' | 'Другое';

/** Откуда появилась транзакция. `bank` / `broker` — синхронизация с API. */
export type TransactionSource = 'manual' | 'voice' | 'receipt' | 'bank' | 'broker';

export type TransactionKind = 'expense' | 'income';

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  category: string;
  billingDay: number;
  isActive: boolean;
  note?: string;
  createdAt: string;
};

export type Debt = {
  id: string;
  name: string;
  monthlyPayment: number;
  paymentDay: number;
  endDate: string;
  remindEnabled: boolean;
  isActive: boolean;
  note?: string;
  createdAt: string;
};

export type CapitalAssetType =
  | 'deposit'
  | 'crypto'
  | 'real_estate'
  | 'stocks'
  | 'cash'
  | 'bonds'
  | 'other';

export type CapitalValuationMode = 'manual' | 'market';

export type CapitalAsset = {
  id: string;
  name: string;
  amount: number;
  assetType: CapitalAssetType;
  valuationMode: CapitalValuationMode;
  quantity?: number;
  unit?: string;
  marketRateRub?: number;
  marketValueRub?: number;
  /** Средняя цена покупки с брокера, ₽ за единицу. */
  avgPurchaseRateRub?: number;
  marketFetchedAt?: string;
  isActive: boolean;
  note?: string;
  financialConnectionId?: string;
  externalPositionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  kind: TransactionKind;
  note?: string;
  source?: TransactionSource;
};
