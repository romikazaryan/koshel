import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { extractJsonLike, yandexGptCompletionText } from '../_shared/yandex.ts'

const ALLOWED_CATEGORIES = ['Продукты', 'Транспорт', 'Кафе', 'Развлечения', 'ЖКХ', 'Одежда', 'Здоровье', 'Другое']

const getModelUri = () => {
  const uri = Deno.env.get('YANDEX_GPT_MODEL_URI')
  if (!uri) throw new Error('Missing env: YANDEX_GPT_MODEL_URI')
  return uri
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { transcript } = await req.json()
    if (typeof transcript !== 'string' || !transcript.trim()) {
      return jsonResponse({ error: 'transcript is required' }, 400)
    }

    const modelUri = getModelUri()
    const phrase = transcript.trim()

    const prompt = `Ты извлекаешь ОДИН расход из свободной русской фразы пользователя.

Категории (строго одна из списка): ${ALLOWED_CATEGORIES.join(', ')}

Правила:
- Понимай разговорную речь: "потратил на кофе триста пятьдесят", "в пятёрочке 2 500", "такси 890 рублей".
- Если несколько трат в одной фразе — возьми последнюю или самую крупную (одна операция).
- sum — число в рублях (целое).
- category — по смыслу (кофе/обед → Кафе, метро/такси → Транспорт, продукты/магазин → Продукты).
- note — короткое описание на русском (2–8 слов), можно из фразы пользователя.
- Если сумму нельзя понять — sum = 0.

Примеры:
Фраза: "кофе 350" → {"sum":350,"category":"Кафе","note":"кофе"}
Фраза: "заправился на 3200" → {"sum":3200,"category":"Транспорт","note":"заправка"}
Фраза: "потратил в ашане две тысячи" → {"sum":2000,"category":"Продукты","note":"покупки в Ашан"}

Верни ТОЛЬКО JSON:
{"sum": number, "category": string, "note": string}

Фраза: ${phrase}`

    const text = await yandexGptCompletionText({
      modelUri,
      prompt,
      temperature: 0.15,
      maxTokens: 400,
    })

    const parsed = extractJsonLike(text)
    const sum = Number(parsed?.sum)
    const category = String(parsed?.category ?? '')
    const note = String(parsed?.note ?? phrase).trim()

    if (!Number.isFinite(sum) || sum <= 0) {
      return jsonResponse({ ok: false, error: 'sum_not_found', raw: text }, 422)
    }

    const normalizedCategory = ALLOWED_CATEGORIES.includes(category) ? category : 'Другое'

    return jsonResponse({
      ok: true,
      sum,
      category: normalizedCategory,
      note: note || phrase,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
