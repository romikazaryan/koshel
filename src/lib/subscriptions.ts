import type { MonthRef } from './month';
import { withNetworkRetries, withTimeout } from './asyncUtils';
import { refreshSessionOnce } from './authSession';
import type { Subscription } from '../types';
import { supabase } from './supabase';

const QUERY_TIMEOUT_MS = 12_000;
const MUTATION_TIMEOUT_MS = 10_000;

function mapRow(row: Record<string, unknown>): Subscription {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Подписка'),
    amount: Number(row.amount ?? 0),
    category: String(row.category ?? 'Другое'),
    billingDay: Number(row.billing_day ?? 1),
    isActive: row.is_active !== false,
    note: row.note ? String(row.note) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export function subscriptionAppliesToMonth(sub: Subscription, month: MonthRef): boolean {
  if (!sub.isActive) return false;
  const created = new Date(sub.createdAt);
  const createdYear = created.getFullYear();
  const createdMonth = created.getMonth() + 1;
  if (month.year < createdYear) return false;
  if (month.year === createdYear && month.month < createdMonth) return false;
  return true;
}

export function getSubscriptionsTotalForMonth(
  subscriptions: Subscription[],
  month: MonthRef
): number {
  return subscriptions
    .filter((sub) => subscriptionAppliesToMonth(sub, month))
    .reduce((sum, sub) => sum + sub.amount, 0);
}

export function getActiveSubscriptionsForMonth(
  subscriptions: Subscription[],
  month: MonthRef
): Subscription[] {
  return subscriptions.filter((sub) => subscriptionAppliesToMonth(sub, month));
}

export async function fetchSubscriptions(): Promise<Subscription[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('subscriptions')
        .select('id,name,amount,category,billing_day,is_active,note,created_at')
        .order('created_at', { ascending: false }),
      QUERY_TIMEOUT_MS,
      'Сервер не ответил вовремя'
    );
    if (error) {
      console.warn('fetchSubscriptions error', error.message);
      return [];
    }
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  } catch (error) {
    console.warn('fetchSubscriptions failed', error);
    return [];
  }
}

export type UpsertSubscriptionInput = {
  name: string;
  amount: number;
  category: string;
  billingDay: number;
  note?: string;
};

export async function insertSubscription(input: UpsertSubscriptionInput): Promise<Subscription> {
  const client = supabase;
  if (!client) throw new Error('Supabase не настроен.');

  const row = {
    name: input.name.trim(),
    amount: input.amount,
    category: input.category,
    billing_day: input.billingDay,
    note: input.note?.trim() || null,
    is_active: true,
  };

  const data = await withNetworkRetries(
    async () => {
      const result = await withTimeout(
        client
          .from('subscriptions')
          .insert(row)
          .select('id,name,amount,category,billing_day,is_active,note,created_at')
          .single(),
        MUTATION_TIMEOUT_MS,
        'Сервер не ответил вовремя'
      );
      if (result.error) throw result.error;
      if (!result.data) throw new Error('Сервер не вернул подписку.');
      return result.data;
    },
    { attempts: 3, baseDelayMs: 250, onAuthRetry: refreshSessionOnce }
  );

  return mapRow(data as Record<string, unknown>);
}

export async function setSubscriptionActive(id: string, isActive: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен.');

  const { error } = await supabase
    .from('subscriptions')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteSubscription(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен.');

  await withNetworkRetries(
    async () => {
      const result = await withTimeout(
        supabase.from('subscriptions').delete().eq('id', id),
        MUTATION_TIMEOUT_MS,
        'Сервер не ответил вовремя'
      );
      if (result.error) throw result.error;
    },
    { attempts: 3, baseDelayMs: 250, onAuthRetry: refreshSessionOnce }
  );
}
