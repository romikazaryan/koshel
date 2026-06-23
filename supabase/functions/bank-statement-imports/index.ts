import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type ListBody = { action: 'list' }

type DeleteBody = {
  action: 'delete'
  importId?: string
  legacyAccountId?: string
}

type RequestBody = ListBody | DeleteBody

type ImportRow = {
  id: string
  file_name: string
  imported_at: string
  row_count: number
  imported_count: number
  account_kind: string | null
  card_last4: string | null
  connection_id: string
  account_id: string
  financial_accounts: { name: string } | { name: string }[] | null
  financial_connections: { display_name: string | null; provider_id: string } | { display_name: string | null; provider_id: string }[] | null
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
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
    const body = (await req.json()) as RequestBody

    if (body.action === 'list') {
      const { data: imports, error: listError } = await admin
        .from('bank_statement_imports')
        .select(
          'id,file_name,imported_at,row_count,imported_count,account_kind,card_last4,connection_id,account_id,financial_accounts(name),financial_connections(display_name,provider_id)'
        )
        .eq('user_id', user.id)
        .order('imported_at', { ascending: false })

      if (listError) throw listError

      const { data: legacyRows, error: legacyError } = await admin
        .from('transactions')
        .select('financial_account_id,financial_accounts(name,connection_id,financial_connections(display_name,provider_id))')
        .eq('user_id', user.id)
        .eq('source', 'bank')
        .is('statement_import_id', null)

      if (legacyError) throw legacyError

      const legacyByAccount = new Map<
        string,
        {
          accountId: string
          accountName: string
          providerName: string
          providerId: string
          transactionCount: number
        }
      >()

      for (const row of legacyRows ?? []) {
        const accountId = row.financial_account_id ? String(row.financial_account_id) : ''
        if (!accountId) continue
        const account = pickOne(
          row.financial_accounts as ImportRow['financial_accounts']
        ) as {
          name: string
          connection_id: string
          financial_connections: { display_name: string | null; provider_id: string } | { display_name: string | null; provider_id: string }[] | null
        } | null
        const connection = pickOne(account?.financial_connections ?? null)
        const existing = legacyByAccount.get(accountId)
        if (existing) {
          existing.transactionCount += 1
          continue
        }
        legacyByAccount.set(accountId, {
          accountId,
          accountName: account?.name ?? 'Счёт',
          providerName: connection?.display_name ?? connection?.provider_id ?? 'Банк',
          providerId: connection?.provider_id ?? 'bank',
          transactionCount: 1,
        })
      }

      const items = (imports ?? []).map((row) => {
        const typed = row as ImportRow
        const account = pickOne(typed.financial_accounts)
        const connection = pickOne(typed.financial_connections)
        return {
          id: typed.id,
          kind: 'import' as const,
          fileName: typed.file_name,
          importedAt: typed.imported_at,
          rowCount: typed.row_count,
          importedCount: typed.imported_count,
          accountKind: typed.account_kind,
          cardLast4: typed.card_last4,
          accountId: typed.account_id,
          accountName: account?.name ?? 'Счёт',
          providerName: connection?.display_name ?? connection?.provider_id ?? 'Банк',
          providerId: connection?.provider_id ?? 'bank',
        }
      })

      const legacy = [...legacyByAccount.values()].map((entry) => ({
        id: `legacy:${entry.accountId}`,
        kind: 'legacy' as const,
        fileName: 'Ранее импортированные операции',
        importedAt: null,
        rowCount: entry.transactionCount,
        importedCount: entry.transactionCount,
        accountKind: null,
        cardLast4: null,
        accountId: entry.accountId,
        accountName: entry.accountName,
        providerName: entry.providerName,
        providerId: entry.providerId,
      }))

      return jsonResponse({ ok: true, items: [...items, ...legacy] })
    }

    if (body.action === 'delete') {
      if (body.importId) {
        const { data: importRow, error: findError } = await admin
          .from('bank_statement_imports')
          .select('id,user_id')
          .eq('id', body.importId)
          .single()

        if (findError || !importRow) return jsonResponse({ error: 'Import not found' }, 404)
        if (importRow.user_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)

        const { count, error: countError } = await admin
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('statement_import_id', body.importId)

        if (countError) throw countError

        const { error: deleteError } = await admin
          .from('bank_statement_imports')
          .delete()
          .eq('id', body.importId)

        if (deleteError) throw deleteError

        return jsonResponse({
          ok: true,
          deleted: count ?? 0,
          message: `Удалено операций: ${count ?? 0}`,
        })
      }

      if (body.legacyAccountId) {
        const { data: account, error: accountError } = await admin
          .from('financial_accounts')
          .select('id,user_id')
          .eq('id', body.legacyAccountId)
          .single()

        if (accountError || !account) return jsonResponse({ error: 'Account not found' }, 404)
        if (account.user_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)

        const { count, error: deleteTxError } = await admin
          .from('transactions')
          .delete({ count: 'exact' })
          .eq('user_id', user.id)
          .eq('financial_account_id', body.legacyAccountId)
          .eq('source', 'bank')
          .is('statement_import_id', null)

        if (deleteTxError) throw deleteTxError

        return jsonResponse({
          ok: true,
          deleted: count ?? 0,
          message: `Удалено операций: ${count ?? 0}`,
        })
      }

      return jsonResponse({ error: 'importId or legacyAccountId required' }, 400)
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('bank-statement-imports error', error)
    return jsonResponse(
      { ok: false, message: error instanceof Error ? error.message : 'Request failed' },
      500
    )
  }
})
