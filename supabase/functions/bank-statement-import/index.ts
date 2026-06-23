import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { shouldExcludeStatementRow } from '../_shared/statementImportRules.ts'
import { reconcileQuickCapturesForImport } from '../_shared/transactionReconciliation.ts'

const EXPENSE_CATEGORIES = new Set([
  'Продукты',
  'Транспорт',
  'Кафе',
  'Развлечения',
  'ЖКХ',
  'Одежда',
  'Здоровье',
  'Онлайн',
  'Другое',
])

const INCOME_CATEGORIES = new Set(['Зарплата', 'Подработка', 'Подарок', 'Возврат', 'Другое'])

function normalizeCategory(kind: 'expense' | 'income', category: string) {
  const trimmed = category.trim()
  if (kind === 'income') {
    return INCOME_CATEGORIES.has(trimmed) ? trimmed : 'Другое'
  }
  return EXPENSE_CATEGORIES.has(trimmed) ? trimmed : 'Другое'
}

function resolveImportCategory(tx: { kind: 'expense' | 'income'; category: string; title: string }) {
  const normalized = normalizeCategory(tx.kind, tx.category)
  if (normalized !== 'Другое' || tx.kind !== 'expense') return normalized

  const title = tx.title.toLowerCase()
  if (/ozon|озон|платформ[еа]\s+ozon|оплата товаров\/услуг на платформе ozon/i.test(title)) {
    return 'Онлайн'
  }
  return normalized
}

function normalizeDate(value: string) {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (dotted) {
    const year = dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3]
    return `${year}-${dotted[2].padStart(2, '0')}-${dotted[1].padStart(2, '0')}`
  }
  return trimmed
}

type ImportRow = {
  date: string
  amount: number
  kind: 'expense' | 'income'
  title: string
  category: string
  note?: string
  externalId: string
  cardLast4?: string
}

type ImportBody = {
  connectionId?: string
  fileName?: string
  accountKind?: 'checking' | 'credit' | 'debit'
  cardLast4?: string
  accountOwner?: string
  rows?: ImportRow[]
}

function formatImportError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const parts = [record.message, record.details, record.hint].filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 0
    )
    if (parts.length > 0) return parts.join(' · ')
  }
  return 'Import failed'
}

/** В financial_accounts нет значения debit — дебетовая карта привязана к checking. */
function normalizeFinancialAccountKind(
  accountKind?: 'checking' | 'credit' | 'debit'
): 'checking' | 'credit' {
  return accountKind === 'credit' ? 'credit' : 'checking'
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
    const body = (await req.json()) as ImportBody
    const connectionId = body.connectionId
    const rows = body.rows ?? []
    const fileName = body.fileName?.trim() || 'выписка'

    if (!connectionId) return jsonResponse({ error: 'connectionId required' }, 400)
    if (rows.length === 0) return jsonResponse({ error: 'rows required' }, 400)
    if (rows.length > 2000) return jsonResponse({ error: 'Слишком много операций за раз' }, 400)

    const { data: connection, error: connError } = await admin
      .from('financial_connections')
      .select('id,user_id,provider_kind,provider_id,status,display_name')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) return jsonResponse({ error: 'Connection not found' }, 404)
    if (connection.user_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)
    if (connection.status === 'revoked') {
      return jsonResponse({ ok: false, message: 'Подключение отключено' }, 400)
    }
    if (connection.provider_kind !== 'bank') {
      return jsonResponse({ ok: false, message: 'Импорт выписки доступен только для банков' }, 400)
    }

    const accountKind = body.accountKind ?? 'debit'
    const accountOwner = body.accountOwner?.trim() || null
    const financialAccountKind = normalizeFinancialAccountKind(accountKind)
    const cardLast4 = body.cardLast4?.trim() || rows.find((row) => row.cardLast4)?.cardLast4?.trim()
    const accountExternalId = cardLast4
      ? `stmt-${connection.provider_id}-${cardLast4}-${accountKind}`
      : `stmt-${connection.provider_id}-${accountKind}`
    const cardLabel = cardLast4 ? ` ···${cardLast4}` : ''
    const kindLabel =
      accountKind === 'credit' ? 'кредитная' : accountKind === 'debit' ? 'дебетовая' : 'выписка'
    const accountName = `${connection.display_name ?? connection.provider_id} · ${kindLabel}${cardLabel}`

    const { data: upsertedAccount, error: accError } = await admin
      .from('financial_accounts')
      .upsert(
        {
          user_id: user.id,
          connection_id: connection.id,
          external_account_id: accountExternalId,
          name: accountName,
          account_kind: financialAccountKind,
          currency: 'RUB',
          balance: null,
          balance_updated_at: null,
          is_active: true,
        },
        { onConflict: 'connection_id,external_account_id' }
      )
      .select('id')
      .single()

    if (accError || !upsertedAccount) throw accError ?? new Error('Account upsert failed')

    const financialAccountId = String(upsertedAccount.id)

    const { data: importRecord, error: importRecordError } = await admin
      .from('bank_statement_imports')
      .insert({
        user_id: user.id,
        connection_id: connection.id,
        account_id: financialAccountId,
        file_name: fileName,
        row_count: rows.length,
        imported_count: 0,
        account_kind: accountKind,
        card_last4: cardLast4 ?? null,
      })
      .select('id')
      .single()

    if (importRecordError || !importRecord) {
      throw importRecordError ?? new Error('Failed to create statement import record')
    }

    const statementImportId = String(importRecord.id)
    let imported = 0
    let duplicates = 0
    let excluded = 0
    const importDates: string[] = []

    for (const tx of rows) {
      if (shouldExcludeStatementRow(tx, accountKind, accountOwner)) {
        excluded += 1
        continue
      }

      const date = normalizeDate(tx.date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error(`Некорректная дата операции: ${tx.date}`)
      }
      importDates.push(date)

      const { error: insertError } = await admin.from('transactions').insert({
        user_id: user.id,
        title: tx.title.slice(0, 120),
        amount: tx.amount,
        category: resolveImportCategory(tx),
        date,
        kind: tx.kind,
        source: 'bank',
        external_id: tx.externalId.slice(0, 120),
        financial_connection_id: connection.id,
        financial_account_id: financialAccountId,
        statement_import_id: statementImportId,
        note:
          tx.note?.trim() ||
          [
            tx.cardLast4 ? `Карта ···${tx.cardLast4}` : null,
            accountKind === 'credit'
              ? 'Кредитная карта'
              : accountKind === 'debit'
                ? 'Дебетовая карта'
                : null,
            `Импорт из выписки (${fileName})`,
          ]
            .filter(Boolean)
            .join(' · '),
      })

      if (!insertError) {
        imported += 1
        continue
      }

      if (insertError.code === '23505') {
        duplicates += 1
        continue
      }

      throw insertError
    }

    const sortedDates = importDates.sort()
    const reconciled =
      imported > 0 && sortedDates.length > 0
        ? await reconcileQuickCapturesForImport(admin, {
            userId: user.id,
            statementImportId,
            dateFrom: sortedDates[0] ?? '',
            dateTo: sortedDates[sortedDates.length - 1] ?? '',
          })
        : 0

    await admin
      .from('bank_statement_imports')
      .update({ imported_count: imported })
      .eq('id', statementImportId)

    await admin
      .from('financial_connections')
      .update({
        status: 'active',
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
        sync_cursor: {
          source: 'statement',
          fileName,
          importedAt: new Date().toISOString(),
          rows: rows.length,
        },
      })
      .eq('id', connection.id)

    const parts = [`Импортировано: ${imported}`]
    if (reconciled > 0) parts.push(`сверено с быстрыми записями: ${reconciled}`)
    if (duplicates > 0) parts.push(`пропущено дублей: ${duplicates}`)
    if (excluded > 0) parts.push(`отфильтровано переводов: ${excluded}`)

    return jsonResponse({
      ok: true,
      imported,
      duplicates,
      reconciled,
      message: parts.join(', '),
    })
  } catch (error) {
    console.error('bank-statement-import error', error)
    return jsonResponse(
      { ok: false, message: formatImportError(error) },
      500
    )
  }
})
