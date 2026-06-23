import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type SyncBody = {
  connectionId?: string
  mock?: boolean
}

/** Демо-синк до подключения реального OAuth банка. */
function buildMockSync(providerId: string) {
  const accountId = `mock-${providerId}`
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  return {
    accounts: [
      {
        external_account_id: accountId,
        name: `Демо · ${providerId}`,
        account_kind: 'checking',
        currency: 'RUB',
        balance: 42500,
      },
    ],
    transactions: [
      {
        external_id: `${accountId}-1`,
        kind: 'expense',
        amount: 890,
        title: 'Пятёрочка',
        category: 'Продукты',
        date: today,
      },
      {
        external_id: `${accountId}-2`,
        kind: 'expense',
        amount: 350,
        title: 'Кофе',
        category: 'Кафе',
        date: yesterday,
      },
      {
        external_id: `${accountId}-3`,
        kind: 'income',
        amount: 85000,
        title: 'Зарплата',
        category: 'Зарплата',
        date: yesterday,
      },
    ],
    sync_cursor: { mock: true, at: new Date().toISOString() },
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const body = (await req.json()) as SyncBody
    const connectionId = body.connectionId
    if (!connectionId) return jsonResponse({ error: 'connectionId required' }, 400)

    const { data: connection, error: connError } = await admin
      .from('financial_connections')
      .select('id,user_id,provider_kind,provider_id,status,sync_cursor')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) return jsonResponse({ error: 'Connection not found' }, 404)
    if (connection.user_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)
    if (connection.status === 'revoked') {
      return jsonResponse({ ok: false, message: 'Подключение отключено' }, 400)
    }

    const syncPayload = buildMockSync(String(connection.provider_id))

    const accountRows = syncPayload.accounts.map((acc) => ({
      user_id: user.id,
      connection_id: connection.id,
      external_account_id: acc.external_account_id,
      name: acc.name,
      account_kind: acc.account_kind,
      currency: acc.currency,
      balance: acc.balance,
      balance_updated_at: new Date().toISOString(),
      is_active: true,
    }))

    const { data: upsertedAccounts, error: accError } = await admin
      .from('financial_accounts')
      .upsert(accountRows, { onConflict: 'connection_id,external_account_id' })
      .select('id,external_account_id')

    if (accError) throw accError

    const accountIdByExternal = new Map(
      (upsertedAccounts ?? []).map((a) => [String(a.external_account_id), String(a.id)])
    )

    const primaryAccountExternal = syncPayload.accounts[0]?.external_account_id ?? ''
    const financialAccountId = accountIdByExternal.get(primaryAccountExternal) ?? null

    let imported = 0
    for (const tx of syncPayload.transactions) {
      const { error: insertError } = await admin.from('transactions').insert({
        user_id: user.id,
        title: tx.title,
        amount: tx.amount,
        category: tx.category,
        date: tx.date,
        kind: tx.kind,
        source: 'bank',
        external_id: tx.external_id,
        financial_connection_id: connection.id,
        financial_account_id: financialAccountId,
        note: 'Импорт из банка (демо)',
      })
      if (!insertError) {
        imported += 1
      }
    }

    await admin
      .from('financial_connections')
      .update({
        status: 'active',
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
        sync_cursor: syncPayload.sync_cursor,
      })
      .eq('id', connection.id)

    return jsonResponse({
      ok: true,
      imported,
      message: 'Демо-синхронизация выполнена',
    })
  } catch (error) {
    console.error('bank-sync error', error)
    return jsonResponse(
      { ok: false, message: error instanceof Error ? error.message : 'Sync failed' },
      500
    )
  }
})
