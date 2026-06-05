export type Category =
  | 'Продукты'
  | 'Транспорт'
  | 'Кафе'
  | 'Развлечения'
  | 'ЖКХ'
  | 'Одежда'
  | 'Здоровье'
  | 'Другое';

export type IncomeCategory = 'Зарплата' | 'Подработка' | 'Подарок' | 'Возврат' | 'Другое';

/** Откуда появилась транзакция. `bank` — для будущей синхронизации с API банка. */
export type TransactionSource = 'manual' | 'voice' | 'receipt' | 'bank';

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
  marketFetchedAt?: string;
  isActive: boolean;
  note?: string;
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
