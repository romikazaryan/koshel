import { supabase, hasSupabase } from './supabase';
import { withNetworkRetries, withTimeout } from './asyncUtils';
import { getEdgeFunctionErrorMessage } from './edgeFunctionErrors';
import type {
  FinancialAccount,
  FinancialConnection,
  FinancialProviderKind,
} from '../types/financialConnections';

const QUERY_TIMEOUT_MS = 12_000;

async function requireCurrentUserId(): Promise<string> {
  if (!hasSupabase || !supabase) {
    throw new Error('Supabase не настроен.');
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Необходимо войти в аккаунт');
  }
  return user.id;
}

function mapConnection(row: Record<string, unknown>): FinancialConnection {
  return {
    id: String(row.id),
    providerKind: row.provider_kind as FinancialConnection['providerKind'],
    providerId: String(row.provider_id),
    status: row.status as FinancialConnection['status'],
    displayName: row.display_name ? String(row.display_name) : null,
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
    lastSyncError: row.last_sync_error ? String(row.last_sync_error) : null,
    createdAt: String(row.created_at ?? ''),
  };
}

function mapAccount(row: Record<string, unknown>): FinancialAccount {
  return {
    id: String(row.id),
    connectionId: String(row.connection_id),
    externalAccountId: String(row.external_account_id),
    name: String(row.name ?? 'Счёт'),
    accountKind: row.account_kind as FinancialAccount['accountKind'],
    currency: String(row.currency ?? 'RUB'),
    balance: row.balance != null ? Number(row.balance) : null,
    balanceUpdatedAt: row.balance_updated_at ? String(row.balance_updated_at) : null,
    isActive: row.is_active !== false,
  };
}

export async function fetchFinancialConnections(): Promise<FinancialConnection[]> {
  if (!hasSupabase || !supabase) return [];

  const data = await withNetworkRetries(async () => {
    const result = await withTimeout(
      supabase
        .from('financial_connections')
        .select(
          'id,provider_kind,provider_id,status,display_name,last_sync_at,last_sync_error,created_at'
        )
        .order('created_at', { ascending: false }),
      QUERY_TIMEOUT_MS,
      'Не удалось загрузить подключения'
    );
    if (result.error) throw result.error;
    return result.data ?? [];
  });

  return data.map((row) => mapConnection(row as Record<string, unknown>));
}

export async function fetchFinancialAccounts(
  connectionId?: string
): Promise<FinancialAccount[]> {
  if (!hasSupabase || !supabase) return [];

  let query = supabase
    .from('financial_accounts')
    .select(
      'id,connection_id,external_account_id,name,account_kind,currency,balance,balance_updated_at,is_active'
    )
    .eq('is_active', true)
    .order('name');

  if (connectionId) {
    query = query.eq('connection_id', connectionId);
  }

  const data = await withNetworkRetries(async () => {
    const result = await withTimeout(query, QUERY_TIMEOUT_MS, 'Не удалось загрузить счета');
    if (result.error) throw result.error;
    return result.data ?? [];
  });

  return data.map((row) => mapAccount(row as Record<string, unknown>));
}

export async function createPendingConnection(input: {
  providerKind: FinancialProviderKind;
  providerId: string;
  displayName: string;
}): Promise<FinancialConnection> {
  const userId = await requireCurrentUserId();

  const row = {
    user_id: userId,
    provider_kind: input.providerKind,
    provider_id: input.providerId,
    display_name: input.displayName,
    status: 'pending',
  };

  const data = await withNetworkRetries(async () => {
    const result = await withTimeout(
      supabase!
        .from('financial_connections')
        .insert(row)
        .select(
          'id,provider_kind,provider_id,status,display_name,last_sync_at,last_sync_error,created_at'
        )
        .single(),
      QUERY_TIMEOUT_MS,
      'Не удалось создать подключение'
    );
    if (result.error) {
      if (result.error.code === '23505') {
        const { data: existing, error: findError } = await supabase!
          .from('financial_connections')
          .select(
            'id,provider_kind,provider_id,status,display_name,last_sync_at,last_sync_error,created_at'
          )
          .eq('user_id', userId)
          .eq('provider_kind', input.providerKind)
          .eq('provider_id', input.providerId)
          .maybeSingle();
        if (findError) throw new Error(findError.message);
        if (existing) return existing;
      }
      const message =
        typeof result.error.message === 'string'
          ? result.error.message
          : 'Не удалось создать подключение';
      throw new Error(message);
    }
    if (!result.data) throw new Error('Сервер не вернул подключение.');
    return result.data;
  });

  return mapConnection(data as Record<string, unknown>);
}

/** Находит активное подключение банка или создаёт pending — без дублей. */
export async function findOrCreateBankConnection(input: {
  providerId: string;
  displayName: string;
  connectionId?: string;
}): Promise<FinancialConnection> {
  if (!hasSupabase || !supabase) {
    throw new Error('Supabase не настроен.');
  }

  const userId = await requireCurrentUserId();

  if (input.connectionId) {
    const { data, error } = await supabase
      .from('financial_connections')
      .select(
        'id,provider_kind,provider_id,status,display_name,last_sync_at,last_sync_error,created_at'
      )
      .eq('id', input.connectionId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return mapConnection(data as Record<string, unknown>);
  }

  const { data: existing, error: findError } = await supabase
    .from('financial_connections')
    .select(
      'id,provider_kind,provider_id,status,display_name,last_sync_at,last_sync_error,created_at'
    )
    .eq('user_id', userId)
    .eq('provider_kind', 'bank')
    .eq('provider_id', input.providerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) throw new Error(findError.message);
  if (existing) {
    if (existing.status === 'revoked') {
      const { data: reactivated, error: updateError } = await supabase
        .from('financial_connections')
        .update({ status: 'pending', display_name: input.displayName })
        .eq('id', existing.id)
        .eq('user_id', userId)
        .select(
          'id,provider_kind,provider_id,status,display_name,last_sync_at,last_sync_error,created_at'
        )
        .single();
      if (updateError) throw new Error(updateError.message);
      if (reactivated) return mapConnection(reactivated as Record<string, unknown>);
    }
    return mapConnection(existing as Record<string, unknown>);
  }

  return createPendingConnection({
    providerKind: 'bank',
    providerId: input.providerId,
    displayName: input.displayName,
  });
}

export async function revokeFinancialConnection(connectionId: string): Promise<{
  ok: boolean;
  message: string;
  assetsDeleted?: number;
}> {
  if (!hasSupabase || !supabase) throw new Error('Supabase не настроен.');

  try {
    const { data, error } = await supabase.functions.invoke('connection-revoke', {
      body: { connectionId },
    });
    if (error) {
      return {
        ok: false,
        message: await getEdgeFunctionErrorMessage(error, data, 'Не удалось отключить'),
      };
    }
    const payload = data as {
      ok?: boolean;
      message?: string;
      assetsDeleted?: number;
    } | null;
    if (payload?.ok) {
      return {
        ok: true,
        message: payload.message ?? 'Подключение отключено',
        assetsDeleted: payload.assetsDeleted,
      };
    }
    return { ok: false, message: payload?.message ?? 'Не удалось отключить' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Ошибка сети' };
  }
}

export async function requestTInvestSync(connectionId: string): Promise<SyncResult> {
  if (!hasSupabase || !supabase) {
    return { ok: false, message: 'Supabase не настроен.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('tinvest-sync', {
      body: { connectionId },
    });
    if (error) {
      return {
        ok: false,
        message: await getEdgeFunctionErrorMessage(
          error,
          data,
          'Ошибка синхронизации T-Invest'
        ),
      };
    }
    const payload = data as {
      ok?: boolean;
      message?: string;
      positionsImported?: number;
      transactionsImported?: number;
    } | null;
    if (payload?.ok) {
      return { ok: true, message: payload.message ?? 'Синхронизация завершена' };
    }
    return { ok: false, message: payload?.message ?? 'Синхронизация не удалась' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Ошибка сети' };
  }
}

export async function connectTInvestToken(token: string): Promise<{
  ok: boolean;
  message: string;
  connectionId?: string;
}> {
  if (!hasSupabase || !supabase) {
    return { ok: false, message: 'Supabase не настроен.' };
  }

  const trimmed = token.trim();

  try {
    const { data, error } = await supabase.functions.invoke('tinvest-connect', {
      body: { token: trimmed },
    });
    if (error) {
      return {
        ok: false,
        message: await getEdgeFunctionErrorMessage(
          error,
          data,
          'Не удалось подключить T-Invest'
        ),
      };
    }
    const payload = data as { ok?: boolean; message?: string; connectionId?: string } | null;
    if (payload?.ok && payload.connectionId) {
      return {
        ok: true,
        message: payload.message ?? 'T-Invest подключён',
        connectionId: payload.connectionId,
      };
    }
    return { ok: false, message: payload?.message ?? 'Подключение не удалось' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Ошибка сети' };
  }
}

type SyncResult = { ok: boolean; message: string };

export async function requestBankSync(connectionId: string): Promise<SyncResult> {
  if (!hasSupabase || !supabase) {
    return { ok: false, message: 'Supabase не настроен.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('bank-sync', {
      body: { connectionId },
    });
    if (error) {
      return { ok: false, message: error.message ?? 'Ошибка синхронизации' };
    }
    const payload = data as { ok?: boolean; message?: string; imported?: number } | null;
    if (payload?.ok) {
      const count = payload.imported ?? 0;
      return {
        ok: true,
        message: count > 0 ? `Импортировано операций: ${count}` : 'Синхронизация завершена',
      };
    }
    return { ok: false, message: payload?.message ?? 'Синхронизация не удалась' };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка сети';
    return { ok: false, message };
  }
}

export async function requestBankStatementPdfText(
  fileBase64: string
): Promise<{ ok: boolean; text?: string; message?: string }> {
  if (!hasSupabase || !supabase) {
    return { ok: false, message: 'Supabase не настроен.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('bank-statement-pdf-text', {
      body: { fileBase64 },
    });
    if (error) {
      return {
        ok: false,
        message: await getEdgeFunctionErrorMessage(error, data, 'Не удалось прочитать PDF'),
      };
    }
    const payload = data as { ok?: boolean; text?: string; message?: string } | null;
    if (payload?.ok && payload.text) {
      return { ok: true, text: payload.text };
    }
    return { ok: false, message: payload?.message ?? 'Не удалось извлечь текст из PDF' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Ошибка сети' };
  }
}

export async function requestBankStatementImport(input: {
  connectionId: string;
  fileName: string;
  accountKind?: 'checking' | 'credit' | 'debit';
  cardLast4?: string;
  accountOwner?: string;
  rows: {
    date: string;
    amount: number;
    kind: 'expense' | 'income';
    title: string;
    category: string;
    note?: string;
    externalId: string;
    cardLast4?: string;
  }[];
}): Promise<SyncResult & { imported?: number; duplicates?: number; reconciled?: number }> {
  if (!hasSupabase || !supabase) {
    return { ok: false, message: 'Supabase не настроен.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('bank-statement-import', {
      body: {
        connectionId: input.connectionId,
        fileName: input.fileName,
        accountKind: input.accountKind,
        cardLast4: input.cardLast4,
        accountOwner: input.accountOwner,
        rows: input.rows,
      },
    });
    if (error) {
      return {
        ok: false,
        message: await getEdgeFunctionErrorMessage(error, data, 'Не удалось импортировать выписку'),
      };
    }
    const payload = data as {
      ok?: boolean;
      message?: string;
      imported?: number;
      duplicates?: number;
      reconciled?: number;
    } | null;
    if (payload?.ok) {
      return {
        ok: true,
        message: payload.message ?? 'Выписка импортирована',
        imported: payload.imported,
        duplicates: payload.duplicates,
        reconciled: payload.reconciled,
      };
    }
    return { ok: false, message: payload?.message ?? 'Импорт не удался' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Ошибка сети' };
  }
}

export type StatementImportItem = {
  id: string;
  kind: 'import' | 'legacy';
  fileName: string;
  importedAt: string | null;
  rowCount: number;
  importedCount: number;
  accountKind: string | null;
  cardLast4: string | null;
  accountId: string;
  accountName: string;
  providerName: string;
  providerId: string;
};

export async function fetchStatementImports(): Promise<StatementImportItem[]> {
  if (!hasSupabase || !supabase) return [];

  const { data, error } = await supabase.functions.invoke('bank-statement-imports', {
    body: { action: 'list' },
  });
  if (error) {
    throw new Error(await getEdgeFunctionErrorMessage(error, data, 'Не удалось загрузить выписки'));
  }
  const payload = data as { ok?: boolean; items?: StatementImportItem[]; message?: string } | null;
  if (!payload?.ok) {
    throw new Error(payload?.message ?? 'Не удалось загрузить выписки');
  }
  return payload.items ?? [];
}

export async function deleteStatementImport(input: {
  importId?: string;
  legacyAccountId?: string;
}): Promise<{ ok: boolean; message: string; deleted?: number }> {
  if (!hasSupabase || !supabase) {
    return { ok: false, message: 'Supabase не настроен.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('bank-statement-imports', {
      body: {
        action: 'delete',
        importId: input.importId,
        legacyAccountId: input.legacyAccountId,
      },
    });
    if (error) {
      return {
        ok: false,
        message: await getEdgeFunctionErrorMessage(error, data, 'Не удалось удалить выписку'),
      };
    }
    const payload = data as { ok?: boolean; message?: string; deleted?: number } | null;
    if (payload?.ok) {
      return {
        ok: true,
        message: payload.message ?? 'Выписка удалена',
        deleted: payload.deleted,
      };
    }
    return { ok: false, message: payload?.message ?? 'Не удалось удалить выписку' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Ошибка сети' };
  }
}
