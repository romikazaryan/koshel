import type { MonthRef } from './month';
import { getMonthRange } from './month';
import type { Transaction, TransactionKind, TransactionSource } from '../types';
import { refreshSessionOnce } from './authSession';
import { withNetworkRetries, withTimeout } from './asyncUtils';
import { supabase } from './supabase';

const MUTATION_TIMEOUT_MS = 8_000;
const QUERY_TIMEOUT_MS = 15_000;

export type InsertTransactionInput = {
  title: string;
  amount: number;
  category: string;
  note?: string;
  date: string;
  source: TransactionSource;
  kind: TransactionKind;
};

function mapTransactionRow(item: Record<string, unknown>): Transaction {
  return {
    id: String(item.id),
    title: String(item.title ?? (item.kind === 'income' ? 'Доход' : 'Расход')),
    amount: Number(item.amount ?? 0),
    category: String(item.category ?? 'Другое'),
    date: String(item.date ?? new Date().toISOString().slice(0, 10)),
    kind: item.kind === 'income' ? 'income' : 'expense',
    note: item.note ? String(item.note) : undefined,
    source: (item.source as Transaction['source']) ?? 'manual',
  };
}

export async function insertTransaction(input: InsertTransactionInput): Promise<Transaction> {
  const client = supabase;
  if (!client) throw new Error('Supabase не настроен.');

  const row = {
    title: input.title,
    amount: input.amount,
    category: input.category,
    note: input.note?.trim() || null,
    date: input.date,
    source: input.source,
    kind: input.kind,
  };

  const data = await withNetworkRetries(
    async () => {
      const result = await withTimeout(
        client
          .from('transactions')
          .insert(row)
          .select('id,title,amount,category,date,source,kind,note')
          .single(),
        MUTATION_TIMEOUT_MS,
        'Сервер не ответил вовремя'
      );
      if (result.error) throw result.error;
      if (!result.data) throw new Error('Сервер не вернул сохранённую запись.');
      return result.data;
    },
    {
      attempts: 4,
      baseDelayMs: 250,
      onAuthRetry: refreshSessionOnce,
    }
  );

  return mapTransactionRow(data as Record<string, unknown>);
}

export async function deleteTransaction(id: string): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Supabase не настроен.');

  await withNetworkRetries(
    async () => {
      const result = await withTimeout(
        client.from('transactions').delete().eq('id', id),
        MUTATION_TIMEOUT_MS,
        'Сервер не ответил вовремя'
      );
      if (result.error) throw result.error;
    },
    {
      attempts: 4,
      baseDelayMs: 250,
      onAuthRetry: refreshSessionOnce,
    }
  );
}

export async function fetchTransactionsForMonth(
  month: MonthRef,
  kind?: TransactionKind
): Promise<Transaction[]> {
  if (!supabase) return [];

  const range = getMonthRange(month);
  let query = supabase
    .from('transactions')
    .select('id,title,amount,category,date,source,kind,note')
    .gte('date', range.start)
    .lte('date', range.end)
    .order('date', { ascending: false })
    .limit(200);

  if (kind) {
    query = query.eq('kind', kind);
  }

  try {
    const { data, error } = await withTimeout(
      query,
      QUERY_TIMEOUT_MS,
      'Сервер не ответил вовремя'
    );
    if (error) {
      console.warn('fetchTransactionsForMonth error', error.message);
      return [];
    }

    return (data ?? []).map((row) => mapTransactionRow(row as Record<string, unknown>));
  } catch (error) {
    console.warn('fetchTransactionsForMonth failed', error);
    return [];
  }
}

export type UpdateTransactionInput = {
  id: string;
  kind: TransactionKind;
  amount: number;
  category: string;
  note: string;
  date: string;
};

export async function updateTransaction(input: UpdateTransactionInput): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен.');

  const title =
    input.note.trim() ||
    (input.kind === 'income' ? input.category : `${input.category} расход`);

  const { error } = await supabase
    .from('transactions')
    .update({
      title,
      amount: input.amount,
      category: input.category,
      note: input.note.trim() || null,
      date: input.date,
    })
    .eq('id', input.id);

  if (error) throw new Error(error.message);
}
