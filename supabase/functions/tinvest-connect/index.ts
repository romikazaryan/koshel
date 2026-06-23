import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { fetchTinvestAccounts } from '../_shared/tinvest.ts'

type ConnectBody = {
  token?: string
  connectionId?: string
  validatedAccountCount?: number
}

function isTinvestNetworkError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('timeout') ||
    lower.includes('fetch failed') ||
    lower.includes('dns') ||
    lower.includes('connection') ||
    lower.includes('network')
  )
}

function formatDbError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Ошибка базы данных'
  const record = error as { code?: string; message?: string }
  if (record.code === '42P01') {
    return 'Таблицы подключений не найдены. Примените миграции financial_connections в Supabase.'
  }
  if (record.code === '23505') {
    return 'T-Invest уже подключён. Отключите старое подключение или обновите токен.'
  }
  if (record.code === '42501') {
    return 'Нет прав на сохранение токена. Примените миграцию financial_secrets_service_grant.'
  }
  return record.message ?? 'Ошибка базы данных'
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

    const body = (await req.json()) as ConnectBody
    const token = body.token?.trim()
    if (!token) return jsonResponse({ error: 'token required' }, 400)

    const providerId = 'tinkoff_invest'
    let accountCount = 0

    try {
      const accounts = await fetchTinvestAccounts(token)
      accountCount = accounts.length
    } catch (tinvestError) {
      const message =
        tinvestError instanceof Error ? tinvestError.message : 'T-Invest API error'
      const clientValidated = Number(body.validatedAccountCount ?? 0)

      if (clientValidated > 0 && isTinvestNetworkError(message)) {
        accountCount = clientValidated
      } else if (message.includes('401')) {
        return jsonResponse(
          {
            ok: false,
            message: 'Неверный или просроченный токен. Выпустите новый read-only токен в T-Invest.',
          },
          400
        )
      } else {
        throw tinvestError
      }
    }

    if (accountCount === 0) {
      return jsonResponse({ ok: false, message: 'Нет открытых счетов T-Invest' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    let connectionId = body.connectionId

    if (connectionId) {
      const { data: existing } = await admin
        .from('financial_connections')
        .select('id,user_id,provider_id')
        .eq('id', connectionId)
        .single()
      if (!existing || existing.user_id !== user.id) {
        return jsonResponse({ error: 'Connection not found' }, 404)
      }
    } else {
      // Одна запись на user+provider (unique index). Отключённые (revoked) переиспользуем.
      const { data: existingConn } = await admin
        .from('financial_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider_kind', 'broker')
        .eq('provider_id', providerId)
        .maybeSingle()

      if (existingConn?.id) {
        connectionId = existingConn.id
      } else {
        const { data: created, error: createError } = await admin
          .from('financial_connections')
          .insert({
            user_id: user.id,
            provider_kind: 'broker',
            provider_id: providerId,
            display_name: 'T-Invest',
            status: 'pending',
          })
          .select('id')
          .single()
        if (createError) {
          return jsonResponse({ ok: false, message: formatDbError(createError) }, 400)
        }
        connectionId = created?.id
      }
    }

    if (!connectionId) throw new Error('Failed to create connection')

    const { error: secretError } = await admin.from('financial_connection_secrets').upsert({
      connection_id: connectionId,
      token_payload: { access_token: token, provider: providerId },
      updated_at: new Date().toISOString(),
    })
    if (secretError) {
      return jsonResponse({ ok: false, message: formatDbError(secretError) }, 400)
    }

    const { error: updateError } = await admin
      .from('financial_connections')
      .update({
        status: 'active',
        display_name: 'T-Invest',
        last_sync_at: null,
        last_sync_error: null,
        metadata: { account_count: accountCount },
      })
      .eq('id', connectionId)
    if (updateError) {
      return jsonResponse({ ok: false, message: formatDbError(updateError) }, 400)
    }

    return jsonResponse({
      ok: true,
      connectionId,
      accountCount,
      message: `Подключено счетов: ${accountCount}`,
    })
  } catch (error) {
    console.error('tinvest-connect error', error)
    const message =
      error instanceof Error && error.message.includes('401')
        ? 'Неверный или просроченный токен. Выпустите новый read-only токен в T-Invest.'
        : error instanceof Error
          ? error.message
          : 'Connect failed'
    return jsonResponse({ ok: false, message }, 400)
  }
})
