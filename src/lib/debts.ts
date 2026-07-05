import type { MonthRef } from './month';
import { withNetworkRetries, withTimeout } from './asyncUtils';
import { refreshSessionOnce } from './authSession';
import type { Debt } from '../types';
import { supabase } from './supabase';

const QUERY_TIMEOUT_MS = 12_000;
const MUTATION_TIMEOUT_MS = 10_000;

function mapRow(row: Record<string, unknown>): Debt {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Кредит'),
    monthlyPayment: Number(row.monthly_payment ?? 0),
    paymentDay: Number(row.payment_day ?? 1),
    endDate: String(row.end_date ?? '').slice(0, 10),
    remindEnabled: row.remind_enabled !== false,
    isActive: row.is_active !== false,
    note: row.note ? String(row.note) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function monthIndex(ref: MonthRef) {
  return ref.year * 12 + ref.month;
}

export function debtAppliesToMonth(debt: Debt, month: MonthRef): boolean {
  if (!debt.isActive || !debt.endDate) return false;

  const created = new Date(debt.createdAt);
  const createdMonth: MonthRef = {
    year: created.getFullYear(),
    month: created.getMonth() + 1,
  };
  if (monthIndex(month) < monthIndex(createdMonth)) return false;

  const [endYear, endMonth] = debt.endDate.split('-').map(Number);
  const endRef: MonthRef = { year: endYear, month: endMonth };
  if (monthIndex(month) > monthIndex(endRef)) return false;

  return true;
}

export function getDebtsTotalForMonth(debts: Debt[], month: MonthRef): number {
  return debts
    .filter((debt) => debtAppliesToMonth(debt, month))
    .reduce((sum, debt) => sum + debt.monthlyPayment, 0);
}

export function getActiveDebtsForMonth(debts: Debt[], month: MonthRef): Debt[] {
  return debts.filter((debt) => debtAppliesToMonth(debt, month));
}

export function formatDebtEndLabel(endDate: string): string {
  const [year, month, day] = endDate.split('-').map(Number);
  if (!year || !month) return endDate;
  const months = [
    'янв', 'фев', 'мар', 'апр', 'май', 'июн',
    'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
  ];
  return `до ${day} ${months[month - 1] ?? month} ${year}`;
}

export async function fetchDebts(): Promise<Debt[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('debts')
        .select('id,name,monthly_payment,payment_day,end_date,remind_enabled,is_active,note,created_at')
        .order('created_at', { ascending: false }),
      QUERY_TIMEOUT_MS,
      'Сервер не ответил вовремя'
    );
    if (error) {
      console.warn('fetchDebts error', error.message);
      return [];
    }
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  } catch (error) {
    console.warn('fetchDebts failed', error);
    return [];
  }
}

export type UpsertDebtInput = {
  name: string;
  monthlyPayment: number;
  paymentDay: number;
  endDate: string;
  remindEnabled?: boolean;
  note?: string;
};

export async function insertDebt(input: UpsertDebtInput): Promise<Debt> {
  const client = supabase;
  if (!client) throw new Error('Supabase не настроен.');

  const row = {
    name: input.name.trim(),
    monthly_payment: input.monthlyPayment,
    payment_day: input.paymentDay,
    end_date: input.endDate,
    remind_enabled: input.remindEnabled ?? true,
    note: input.note?.trim() || null,
    is_active: true,
  };

  const data = await withNetworkRetries(
    async () => {
      const result = await withTimeout(
        client
          .from('debts')
          .insert(row)
          .select('id,name,monthly_payment,payment_day,end_date,remind_enabled,is_active,note,created_at')
          .single(),
        MUTATION_TIMEOUT_MS,
        'Сервер не ответил вовремя'
      );
      if (result.error) throw result.error;
      if (!result.data) throw new Error('Сервер не вернул задолженность.');
      return result.data;
    },
    { attempts: 3, baseDelayMs: 250, onAuthRetry: refreshSessionOnce }
  );

  return mapRow(data as Record<string, unknown>);
}

export async function setDebtActive(id: string, isActive: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен.');
  const { error } = await supabase.from('debts').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setDebtReminders(id: string, remindEnabled: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен.');
  const { error } = await supabase.from('debts').update({ remind_enabled: remindEnabled }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteDebt(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен.');
  const client = supabase;

  await withNetworkRetries(
    async () => {
      const result = await withTimeout(
        client.from('debts').delete().eq('id', id),
        MUTATION_TIMEOUT_MS,
        'Сервер не ответил вовремя'
      );
      if (result.error) throw result.error;
    },
    { attempts: 3, baseDelayMs: 250, onAuthRetry: refreshSessionOnce }
  );
}
