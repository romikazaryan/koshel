import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  buildMonthAnalysisPrompt,
  legacyRecommendationsText,
  parseMonthAnalysisResponse,
} from '../_shared/monthAnalysisPrompt.ts'
import { extractJsonLike, yandexGptCompletionText } from '../_shared/yandex.ts'

const getModelUri = () => {
  const uri = Deno.env.get('YANDEX_GPT_MODEL_URI')
  if (!uri) throw new Error('Missing env: YANDEX_GPT_MODEL_URI')
  return uri
}

function normalizePayload(body: Record<string, unknown>) {
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
  const monthlyTrend = Array.isArray(body?.monthlyTrend) ? body.monthlyTrend : []
  const topMerchants = Array.isArray(body?.topMerchants) ? body.topMerchants : []
  const categoryShifts = Array.isArray(body?.categoryShifts) ? body.categoryShifts : []
  const fixedCosts = Array.isArray(body?.fixedCosts) ? body.fixedCosts : []
  const facts = Array.isArray(body?.facts) ? body.facts.map(String) : []
  const optimizationHints = Array.isArray(body?.optimizationHints)
    ? body.optimizationHints.map(String)
    : []

  return {
    periodMonths: Number(body?.periodMonths ?? body?.historyMonths ?? 1) || 1,
    periodLabel: String(body?.periodLabel ?? body?.monthLabel ?? 'период'),
    monthLabel: String(body?.monthLabel ?? body?.periodLabel ?? 'период'),
    month: String(body?.month ?? ''),
    income,
    totalExpenses,
    balance,
    healthScore,
    monthlyBudget,
    savingsRate:
      body?.savingsRate != null && Number.isFinite(Number(body.savingsRate))
        ? Number(body.savingsRate)
        : null,
    expensesByCategory,
    historyMonths: Number(body?.historyMonths ?? 1) || 1,
    monthlyTrend,
    topMerchants,
    categoryShifts,
    fixedCosts,
    fixedCostsTotal: Number(body?.fixedCostsTotal ?? 0),
    fixedCostsShare: Number(body?.fixedCostsShare ?? 0),
    facts,
    optimizationHints,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const body = await req.json()
    const payload = normalizePayload(body ?? {})

    const hasIncome = Number.isFinite(payload.income) && payload.income > 0
    const hasExpenses = Number.isFinite(payload.totalExpenses) && payload.totalExpenses > 0
    const hasBudget = payload.monthlyBudget != null
    const hasTrend = payload.monthlyTrend.length > 0

    if (!hasIncome && !hasExpenses && !hasBudget && !hasTrend) {
      return jsonResponse(
        {
          error:
            'Нет данных за месяц: добавьте доход или расход в приложении, либо задайте лимит трат в профиле.',
        },
        400
      )
    }

    const modelUri = getModelUri()
    const prompt = buildMonthAnalysisPrompt(payload)

    const gptText = await yandexGptCompletionText({
      modelUri,
      prompt,
      temperature: 0.25,
      maxTokens: 1300,
    })

    const parsed = extractJsonLike(gptText)
    const analysis = parseMonthAnalysisResponse(parsed)
    if (!analysis) return jsonResponse({ ok: false, reason: 'empty_recommendations' }, 422)

    const recommendations = legacyRecommendationsText(analysis)
    return jsonResponse({ ok: true, analysis, recommendations })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
