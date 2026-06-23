import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MonthRef } from './month';
import { getMonthRange, isDateInRange } from './month';
import type { Transaction, Subscription, Debt, CapitalAsset } from '../types';

const STORAGE_KEY = '@koshel/dashboard-cache-v4';

export type DashboardCachePayload = {
  userId: string;
  monthKey: string;
  transactions: Transaction[];
  subscriptions: Subscription[];
  debts: Debt[];
  capitalAssets: CapitalAsset[];
  monthlyBudget: number | null;
  fetchedAt: number;
};

let memoryCache: DashboardCachePayload | null = null;

export function monthCacheKey(month: MonthRef) {
  return `${month.year}-${String(month.month).padStart(2, '0')}`;
}

export function readDashboardCacheSync(
  userId: string,
  month: MonthRef
): DashboardCachePayload | null {
  const key = monthCacheKey(month);
  if (
    memoryCache &&
    memoryCache.userId === userId &&
    memoryCache.monthKey === key
  ) {
    return memoryCache;
  }
  return null;
}

export async function readDashboardCache(
  userId: string,
  month: MonthRef
): Promise<DashboardCachePayload | null> {
  const sync = readDashboardCacheSync(userId, month);
  if (sync) return sync;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardCachePayload;
    const key = monthCacheKey(month);
    if (parsed.userId !== userId || parsed.monthKey !== key) return null;
    memoryCache = {
      ...parsed,
      subscriptions: parsed.subscriptions ?? [],
      debts: parsed.debts ?? [],
      capitalAssets: parsed.capitalAssets ?? [],
    };
    return memoryCache;
  } catch {
    return null;
  }
}

export async function writeDashboardCache(payload: DashboardCachePayload): Promise<void> {
  memoryCache = payload;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('dashboard cache write failed', e);
  }
}

function monthFromDate(dateStr: string): MonthRef {
  const [year, month] = dateStr.split('-').map(Number);
  return { year: year || new Date().getFullYear(), month: month || new Date().getMonth() + 1 };
}

/** Сразу показываем новую транзакцию на главной, не дожидаясь повторной загрузки. */
export async function appendTransactionToDashboardCache(
  userId: string,
  transaction: Transaction
): Promise<void> {
  const month = monthFromDate(transaction.date);
  const range = getMonthRange(month);
  if (!isDateInRange(transaction.date, range.start, range.end)) return;

  const existing = await readDashboardCache(userId, month);
  const withoutDuplicate = (existing?.transactions ?? []).filter((item) => item.id !== transaction.id);
  const transactions = [transaction, ...withoutDuplicate].sort((a, b) => b.date.localeCompare(a.date));

  await writeDashboardCache({
    userId,
    monthKey: monthCacheKey(month),
    transactions,
    subscriptions: existing?.subscriptions ?? [],
    debts: existing?.debts ?? [],
    capitalAssets: existing?.capitalAssets ?? [],
    monthlyBudget: existing?.monthlyBudget ?? null,
    fetchedAt: Date.now(),
  });
}

export async function appendTransactionsToDashboardCache(
  userId: string,
  newTransactions: Transaction[]
): Promise<void> {
  for (const transaction of newTransactions) {
    await appendTransactionToDashboardCache(userId, transaction);
  }
}

/** Убираем транзакцию из кэша главной сразу после удаления. */
export async function removeTransactionFromDashboardCache(
  userId: string,
  transactionId: string,
  month: MonthRef
): Promise<void> {
  const existing = await readDashboardCache(userId, month);
  if (!existing) return;

  const transactions = existing.transactions.filter((item) => item.id !== transactionId);
  if (transactions.length === existing.transactions.length) return;

  await writeDashboardCache({
    ...existing,
    transactions,
    fetchedAt: Date.now(),
  });
}

/** Сброс кэша главной после массового удаления операций. */
export async function invalidateDashboardCache(): Promise<void> {
  memoryCache = null;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('dashboard cache invalidate failed', e);
  }
}
