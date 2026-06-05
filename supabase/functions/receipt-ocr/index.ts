import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { extractJsonLike, visionBatchAnalyzeText, yandexGptCompletionText } from '../_shared/yandex.ts'

const ALLOWED_CATEGORIES = ['Продукты', 'Транспорт', 'Кафе', 'Развлечения', 'ЖКХ', 'Одежда', 'Здоровье', 'Другое']

const getModelUri = () => {
  const uri = Deno.env.get('YANDEX_GPT_MODEL_URI')
  if (!uri) throw new Error('Missing env: YANDEX_GPT_MODEL_URI')
  return uri
}

function normalizeBase64(input: string) {
  // Accept both raw base64 and data URLs.
  const commaIdx = input.indexOf(',')
  return commaIdx >= 0 ? input.slice(commaIdx + 1) : input
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { imageBase64 } = await req.json()
    if (typeof imageBase64 !== 'string' || imageBase64.trim().length < 10) {
      return jsonResponse({ error: 'imageBase64 is required' }, 400)
    }

    const modelUri = getModelUri()
    const base64 = normalizeBase64(imageBase64)

    // 1) OCR via Vision.
    const ocrText = await visionBatchAnalyzeText(base64)

    // 2) Convert OCR text to structured items via YandexGPT.
    const prompt = `Ты извлекаешь данные из распознанного текста чека.
У тебя есть OCR-текст:
---
${ocrText}
---

Задача:
1) Найди позиции товара/услуги: для каждой позиции извлеки название и цену.
2) Найди итоговую сумму чека (обычно строки "Итого", "Сумма", "Всего").
3) Если какие-то данные не найдены — сделай best-effort, но обязательно верни JSON.

Формат строго (ТОЛЬКО JSON, без обрамляющего текста):
{
  "items": [{ "name": string, "price": number }],
  "total": number,
  "category": string
}

Категория должна быть из списка: ${ALLOWED_CATEGORIES.join(', ')}
Если не уверен — верни category="Другое".`

    const gptText = await yandexGptCompletionText({
      modelUri,
      prompt,
      temperature: 0.1,
      maxTokens: 700,
    })

    const parsed = extractJsonLike(gptText)
    const itemsRaw = Array.isArray(parsed?.items) ? parsed.items : []

    const items = itemsRaw
      .map((it: any) => ({
        name: String(it?.name ?? '').trim(),
        price: Number(it?.price),
      }))
      .filter((it: any) => it.name.length > 0 && Number.isFinite(it.price) && it.price >= 0)

    const total = Number(parsed?.total)
    const category = String(parsed?.category ?? '')
    const normalizedCategory = ALLOWED_CATEGORIES.includes(category) ? category : 'Другое'

    if (!Number.isFinite(total) || total <= 0) {
      return jsonResponse({ ok: false, reason: 'total_not_found', items }, 422)
    }

    return jsonResponse({ ok: true, items, total, category: normalizedCategory })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})

