import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { syncCapitalPeriodMetricsForUser } from '../_shared/capitalMetricsSync.ts'

type SyncBody = {
  force?: boolean
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

    const body = (req.method === 'POST' ? ((await req.json()) as SyncBody) : {}) ?? {}
    const admin = createClient(supabaseUrl, serviceKey)

    const result = await syncCapitalPeriodMetricsForUser(admin, user.id, {
      force: body.force === true,
    })

    return jsonResponse({
      ok: true,
      updated: result.updated,
      skipped: result.skipped,
      message: result.skipped
        ? 'Метрики актуальны'
        : `Обновлено записей: ${result.updated}`,
    })
  } catch (error) {
    console.error('capital-metrics-sync error', error)
    const message = error instanceof Error ? error.message : 'Sync failed'
    return jsonResponse({ ok: false, message }, 500)
  }
})
