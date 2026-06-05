import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { extractJsonLike, yandexGptCompletionText } from '../_shared/yandex.ts'

const getModelUri = () => {
  const uri = Deno.env.get('YANDEX_GPT_MODEL_URI')
  if (!uri) throw new Error('Missing env: YANDEX_GPT_MODEL_URI')
  return uri
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const body = await req.json()
    const income = Number(body?.income ?? 0)
    const totalExpenses = Number(body?.totalExpenses ?? 0)
    const balance = Number(body?.balance ?? 0)
    const healthScore = Number(body?.healthScore ?? 0)
    const monthlyBudgetRaw = body?.monthlyBudget
    const monthlyBudget =
      monthlyBudgetRaw != null && Number.isFinite(Number(monthlyBudgetRaw)) && Number(monthlyBudgetRaw) > 0
        ? Number(monthlyBudgetRaw)
        : null
    const expensesByCategory = Array.isArray(body?.expensesByCategory) ? body.expensesByCategory : []

    const hasIncome = Number.isFinite(income) && income > 0
    const hasExpenses = Number.isFinite(totalExpenses) && totalExpenses > 0
    const hasBudget = monthlyBudget != null

    if (!hasIncome && !hasExpenses && !hasBudget) {
      return jsonResponse(
        {
          error:
            'Нет данных за месяц: добавьте доход или расход в приложении, либо задайте лимит трат в профиле.',
        },
        400
      )
    }

    const modelUri = getModelUri()

    const incomeLine = hasIncome
      ? `- Доход за месяц: ${income} ₽`
      : '- Доход за месяц: не указан (учёт только по расходам и лимиту)'
    const budgetLine = hasBudget
      ? `- Плановый лимит трат: ${monthlyBudget} ₽ (израсходовано ${totalExpenses} ₽, ${
          totalExpenses > monthlyBudget ? 'лимит превышен' : `осталось ${monthlyBudget - totalExpenses} ₽`
        })`
      : '- Плановый лимит трат: не задан'

    const prompt = `Ты — личный финансовый консультант.

Проанализируй траты пользователя за месяц. Обязательные правила:
- Пиши на русском, дружелюбно и структурировано (заголовки, короткие абзацы).
- Не давай прямых рекомендаций по покупке акций, облигаций или криптовалют.
- Если доход не указан — не требуй его; опирайся на расходы и лимит трат (если есть).
- Если баланс (доходы минус расходы) положительный — предложи безопасные сценарии: накопительный счёт, ИИС, подушка безопасности.

Входные данные:
${incomeLine}
${budgetLine}
- Расходы за месяц: ${totalExpenses} ₽
- Баланс (доходы минус расходы): ${balance} ₽
- Индекс финансового здоровья (0–100): ${healthScore}
- Распределение расходов по категориям (суммы и проценты):
${
  expensesByCategory.length > 0
    ? expensesByCategory
        .map((c: { category?: string; amount?: number; percent?: number }) =>
          `  - ${c.category}: ${c.amount} ₽ (${c.percent ?? 0}%)`
        )
        .join('\n')
    : '  (расходов по категориям пока нет)'
}

Сформируй ответ и верни ТОЛЬКО JSON следующего вида:
{
  "recommendations": "текст с заголовками и абзацами"
}`

    const gptText = await yandexGptCompletionText({
      modelUri,
      prompt,
      temperature: 0.3,
      maxTokens: 900,
    })

    const parsed = extractJsonLike(gptText)
    const recommendations = String(parsed?.recommendations ?? '')
    if (!recommendations.trim()) return jsonResponse({ ok: false, reason: 'empty_recommendations' }, 422)

    return jsonResponse({ ok: true, recommendations })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
