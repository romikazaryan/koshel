import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { extractPdfText } from '../_shared/pdfText.ts'

const MAX_BASE64_LENGTH = 8_000_000

function normalizeBase64(input: string) {
  const commaIdx = input.indexOf(',')
  return commaIdx >= 0 ? input.slice(commaIdx + 1) : input
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) {
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const body = (await req.json()) as { fileBase64?: string }
    const rawBase64 = body.fileBase64?.trim() ?? ''
    if (rawBase64.length < 20) {
      return jsonResponse({ error: 'fileBase64 required' }, 400)
    }
    if (rawBase64.length > MAX_BASE64_LENGTH) {
      return jsonResponse({ ok: false, message: 'PDF слишком большой (макс. ~6 МБ)' }, 400)
    }

    const base64 = normalizeBase64(rawBase64)
    const pdfBytes = base64ToBytes(base64)
    const { text, pages } = await extractPdfText(pdfBytes)

    if (!text.trim()) {
      return jsonResponse(
        {
          ok: false,
          message:
            'В PDF нет текстового слоя — возможно, это скан. Скачайте выписку с текстом или в формате CSV.',
        },
        400
      )
    }

    return jsonResponse({
      ok: true,
      text,
      pages,
    })
  } catch (error) {
    console.error('bank-statement-pdf-text error', error)
    return jsonResponse(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Не удалось прочитать PDF',
      },
      500
    )
  }
})
