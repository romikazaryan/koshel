type TrendPoint = {
  month: string;
  label: string;
  income: number;
  expenses: number;
  balance: number;
};

type AnalysisPayload = {
  periodMonths: number;
  periodLabel: string;
  monthLabel: string;
  month: string;
  income: number;
  totalExpenses: number;
  balance: number;
  healthScore: number;
  monthlyBudget: number | null;
  savingsRate: number | null;
  expensesByCategory: Array<{ category: string; amount: number; percent: number }>;
  historyMonths: number;
  monthlyTrend: TrendPoint[];
  topMerchants: Array<{ title: string; amount: number; count: number }>;
  categoryShifts: Array<{ category: string; current: number; previousAvg: number; changePercent: number }>;
  fixedCosts: Array<{ name: string; amount: number; type: string }>;
  fixedCostsTotal: number;
  fixedCostsShare: number;
  facts: string[];
  optimizationHints: string[];
};

function rub(amount: number): string {
  return `${Math.round(amount).toLocaleString('ru-RU')} ₽`;
}

function formatTrendLine(point: TrendPoint): string {
  return `  ${point.label}: доход ${rub(point.income)}, расход ${rub(point.expenses)}, итог ${rub(point.balance)}`;
}

export function buildMonthAnalysisPrompt(payload: AnalysisPayload): string {
  const hasIncome = payload.income > 0;
  const periodMonths = Number(payload.periodMonths ?? payload.historyMonths ?? 1) || 1;
  const periodLabel = payload.periodLabel || payload.monthLabel || 'период';
  const budgetCap =
    payload.monthlyBudget != null ? payload.monthlyBudget * periodMonths : null;
  const budgetLine =
    payload.monthlyBudget != null
      ? periodMonths === 1
        ? `Лимит трат: ${rub(payload.monthlyBudget)} (${payload.totalExpenses > payload.monthlyBudget ? 'превышен' : `остаток ${rub(payload.monthlyBudget - payload.totalExpenses)}`})`
        : `Лимит трат: ${rub(payload.monthlyBudget)}/мес × ${periodMonths} = ${rub(budgetCap!)} (${payload.totalExpenses > budgetCap! ? 'превышен' : `остаток ${rub(budgetCap! - payload.totalExpenses)}`})`
      : 'Лимит трат: не задан';

  const categoriesBlock =
    payload.expensesByCategory.length > 0
      ? payload.expensesByCategory
          .slice(0, 8)
          .map((c) => `  - ${c.category}: ${rub(c.amount)} (${c.percent}%)`)
          .join('\n')
      : '  (нет категорий)';

  const trendBlock =
    payload.monthlyTrend.length > 0
      ? payload.monthlyTrend.map(formatTrendLine).join('\n')
      : '  (нет истории)';

  const merchantsBlock =
    payload.topMerchants.length > 0
      ? payload.topMerchants
          .map((m) => `  - ${m.title}: ${rub(m.amount)} (${m.count} операций)`)
          .join('\n')
      : '  (нет данных)';

  const shiftsBlock =
    payload.categoryShifts.length > 0
      ? payload.categoryShifts
          .map(
            (s) =>
              `  - ${s.category}: сейчас ${rub(s.current)}, среднее ${rub(s.previousAvg)} (${s.changePercent > 0 ? '+' : ''}${s.changePercent}%)`
          )
          .join('\n')
      : '  (стабильно)';

  const fixedBlock =
    payload.fixedCosts.length > 0
      ? payload.fixedCosts.map((f) => `  - ${f.name}: ${rub(f.amount)} (${f.type})`).join('\n')
      : '  (нет)';

  const factsBlock =
    payload.facts.length > 0 ? payload.facts.map((f) => `  - ${f}`).join('\n') : '  (без явных аномалий)';

  const hintsBlock =
    payload.optimizationHints?.length > 0
      ? payload.optimizationHints.map((h) => `  - ${h}`).join('\n')
      : '  (подберите по данным пользователя)';

  const periodFocus =
    periodMonths === 1
      ? 'Сфокусируйся на одном месяце — без долгосрочных трендов.'
      : periodMonths >= 6
        ? 'Оценивай период в целом: тренды, повторяющиеся траты, устойчивые паттерны.'
        : 'Смотри на период целиком и динамику по месяцам.';

  return `Ты — частный финансовый консультант с 25-летним опытом. Работаешь с семьями и профессионалами в России.
Пользователь просит короткую консультацию — как на платной встрече на 20 минут: только выводы и конкретные шаги.

ЖЁСТКИЕ ПРАВИЛА:
- Пиши на русском, на «вы», уверенно и по делу.
- Не перечисляй все цифры из данных — используй их для выводов.
- Ровно 2–3 приоритетных действия по сокращению/контролю расходов (не больше).
- Отдельно — 0–2 совета в "optimizations": только легальные способы в РФ вернуть или сохранить деньги.
- Не советуй покупать конкретные акции, ETF, облигации, фонды или криптовалюты по названию.
- Можно: накопительный счёт, вклад, ИИС тип А/Б (общими словами), стандартный/социальный/имущественный вычеты, 3-НДФЛ, long-term savings.
- Советы в optimizations должны опираться на данные пользователя (баланс, категории, доход). Если не подходит — верни пустой массив optimizations: [].
- Если доход не указан — не требуй его; опирайся на расходы, тренды и лимит.
- Общий объём текста — до 400 слов. Без воды и мотивационных клише.
- ${periodFocus}

Анализируемый период: ${periodLabel} (${periodMonths} мес.)

=== Итог за период ===
${hasIncome ? `Доход: ${rub(payload.income)}` : 'Доход: не указан'}
Расходы: ${rub(payload.totalExpenses)}
Баланс: ${rub(payload.balance)}
${budgetLine}
${payload.savingsRate != null ? `Норма сбережений: ${payload.savingsRate}%` : ''}
Индекс финансового здоровья: ${payload.healthScore}/100

Категории расходов:
${categoriesBlock}

=== Динамика по месяцам ===
${trendBlock}

=== Крупнейшие траты за период ===
${merchantsBlock}

=== Изменения категорий к среднему ===
${shiftsBlock}

=== Фиксированные платежи (${payload.fixedCostsShare}% расходов, ${rub(payload.fixedCostsTotal)}) ===
${fixedBlock}

=== Авто-наблюдения ===
${factsBlock}

=== Подсказки для блока «сохранить/вернуть» (используй релевантные) ===
${hintsBlock}

Верни ТОЛЬКО JSON (без markdown):
{
  "headline": "главный вывод в одном предложении, до 120 символов",
  "situation": "оценка ситуации: 1–2 коротких предложения",
  "priorities": [
    {
      "title": "короткое название шага по тратам",
      "action": "что сделать конкретно",
      "effect": "ожидаемый эффект в ₽ или поведении"
    }
  ],
  "optimizations": [
    {
      "title": "короткое название (вычет / продукт)",
      "action": "что оформить и где начать",
      "benefit": "ориентир выгоды в ₽/год или %",
      "kind": "tax или bank или broker"
    }
  ],
  "watch": "один риск или паттерн, который нельзя игнорировать",
  "strength": "одна сильная сторона в финансовом поведении"
}`
}

export function parseMonthAnalysisResponse(raw: unknown): {
  headline: string;
  situation: string;
  priorities: Array<{ title: string; action: string; effect: string }>;
  optimizations: Array<{ title: string; action: string; benefit: string; kind: string }>;
  watch: string;
  strength: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const headline = String(data.headline ?? '').trim();
  const situation = String(data.situation ?? '').trim();
  const watch = String(data.watch ?? '').trim();
  const strength = String(data.strength ?? '').trim();

  const prioritiesRaw = Array.isArray(data.priorities) ? data.priorities : [];
  const priorities = prioritiesRaw
    .slice(0, 3)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? '').trim();
      const action = String(row.action ?? '').trim();
      const effect = String(row.effect ?? row.saveMonthly ?? '').trim();
      if (!title || !action) return null;
      return { title, action, effect: effect || 'Снизит давление на бюджет' };
    })
    .filter((item): item is { title: string; action: string; effect: string } => item != null);

  const optimizationsRaw = Array.isArray(data.optimizations) ? data.optimizations : [];
  const optimizations = optimizationsRaw
    .slice(0, 2)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? '').trim();
      const action = String(row.action ?? '').trim();
      const benefit = String(row.benefit ?? row.effect ?? '').trim();
      const kind = String(row.kind ?? 'bank');
      if (!title || !action) return null;
      return { title, action, benefit: benefit || 'Экономия или возврат средств', kind };
    })
    .filter(
      (item): item is { title: string; action: string; benefit: string; kind: string } =>
        item != null
    );

  if (!headline || priorities.length === 0) return null;
  return {
    headline,
    situation: situation || 'Краткая оценка по данным за выбранный период.',
    priorities,
    optimizations,
    watch: watch || 'Следите за импульсными тратами вне бюджета.',
    strength: strength || 'Вы уже ведёте учёт — это половина успеха.',
  };
}

export function legacyRecommendationsText(result: {
  headline: string;
  situation: string;
  priorities: Array<{ title: string; action: string; effect: string }>;
  optimizations?: Array<{ title: string; action: string; benefit: string; kind: string }>;
  watch: string;
  strength: string;
}): string {
  return [
    result.headline,
    '',
    result.situation,
    '',
    'Приоритеты:',
    ...result.priorities.map(
      (item, index) =>
        `${index + 1}. ${item.title}\n${item.action}${item.effect ? `\n→ ${item.effect}` : ''}`
    ),
    ...(result.optimizations && result.optimizations.length > 0
      ? [
          '',
          'Как сохранить или вернуть:',
          ...result.optimizations.map(
            (item, index) =>
              `${index + 1}. ${item.title}\n${item.action}${item.benefit ? `\n→ ${item.benefit}` : ''}`
          ),
        ]
      : []),
    '',
    `На контроле: ${result.watch}`,
    `Сильная сторона: ${result.strength}`,
  ].join('\n');
}
