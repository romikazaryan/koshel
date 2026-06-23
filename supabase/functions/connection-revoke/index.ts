import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type RevokeBody = {
  connectionId?: string
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

    const body = (await req.json()) as RevokeBody
    const connectionId = body.connectionId
    if (!connectionId) return jsonResponse({ error: 'connectionId required' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: connection, error: connError } = await admin
      .from('financial_connections')
      .select('id,user_id,provider_id,status')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) return jsonResponse({ error: 'Connection not found' }, 404)
    if (connection.user_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)

    const { count: assetsDeleted, error: assetsError } = await admin
      .from('capital_assets')
      .delete({ count: 'exact' })
      .eq('financial_connection_id', connectionId)

    if (assetsError) throw assetsError

    const { count: txDeleted, error: txError } = await admin
      .from('transactions')
      .delete({ count: 'exact' })
      .eq('financial_connection_id', connectionId)
      .in('source', ['broker', 'bank'])

    if (txError) throw txError

    const { error: accountsError } = await admin
      .from('financial_accounts')
      .delete()
      .eq('connection_id', connectionId)

    if (accountsError) throw accountsError

    const { error: secretsError } = await admin
      .from('financial_connection_secrets')
      .delete()
      .eq('connection_id', connectionId)

    if (secretsError) throw secretsError

    const { error: updateError } = await admin
      .from('financial_connections')
      .update({
        status: 'revoked',
        last_sync_error: null,
        last_sync_at: null,
        metadata: {},
      })
      .eq('id', connectionId)

    if (updateError) throw updateError

    return jsonResponse({
      ok: true,
      assetsDeleted: assetsDeleted ?? 0,
      transactionsDeleted: txDeleted ?? 0,
      message: `Подключение отключено. Удалено позиций: ${assetsDeleted ?? 0}`,
    })
  } catch (error) {
    console.error('connection-revoke error', error)
    const message = error instanceof Error ? error.message : 'Revoke failed'
    return jsonResponse({ ok: false, message }, 500)
  }
})
