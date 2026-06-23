import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants/categories';
import type { Category, IncomeCategory, TransactionKind } from '../types';

type InferCategoryOptions = {
  providerId?: string;
};

const ONLINE_PROVIDER_IDS = new Set(['ozon']);

function isOzonMarketplacePayment(text: string): boolean {
  return (
    /ozon|озон/i.test(text) ||
    /платформ[еа]\s+ozon/i.test(text) ||
    /оплата товаров\/услуг на платформе ozon/i.test(text)
  );
}

function providerOnlineCategory(
  providerId: string | undefined,
  text: string
): ExpenseCategory | null {
  if (!providerId || !ONLINE_PROVIDER_IDS.has(providerId)) return null;
  if (!isOzonMarketplacePayment(text)) return null;
  return 'Онлайн';
}

type ExpenseCategory = Category;
type AnyCategory = Category | IncomeCategory;

type CategoryRule = {
  category: AnyCategory;
  patterns: RegExp[];
};

const INCOME_RULES: CategoryRule[] = [
  {
    category: 'Зарплата',
    patterns: [
      /зарплат/i,
      /аванс/i,
      /заработн/i,
      /оплата труда/i,
      /оплата за разработку/i,
      /з\/п/i,
    ],
  },
  {
    category: 'Подработка',
    patterns: [/фриланс/i, /подработ/i, /гонорар/i, /вознагражден/i],
  },
  {
    category: 'Подарок',
    patterns: [/подарок/i, /подароч/i, /cashback\s*gift/i],
  },
  {
    category: 'Возврат',
    patterns: [
      /возврат/i,
      /refund/i,
      /отмена покупки/i,
      /chargeback/i,
      /reversal/i,
    ],
  },
];

const EXPENSE_RULES: CategoryRule[] = [
  {
    category: 'Онлайн',
    patterns: [
      /ozon|озон|ozonbank|ozon\s*bank/i,
      /платформ[еа]\s+ozon/i,
      /оплата товаров\/услуг на платформе ozon/i,
      /wildberries|вайлдберриз|\bwb\.ru\b/i,
      /aliexpress|алиэкспресс/i,
      /яндекс\.?\s*маркет|yandex\.?\s*market/i,
    ],
  },
  {
    category: 'Продукты',
    patterns: [
      /samokat|самокат(?:\.ru)?/i,
      /vkusvill|вкусвилл/i,
      /perekrest|перекр[её]ст/i,
      /pyateroch|пят[её]роч/i,
      /magnit|магнит/i,
      /lenta(?:\s|$)|лента(?:\s|$)/i,
      /auchan|ашан/i,
      /metro\s*(?:cash|c&c|cc)|гипермаркет\s*метро/i,
      /kuper|купер|sbermarket|сбермаркет/i,
      /yandex\.?\s*lavka|яндекс\.?\s*лавк/i,
      /dixy|дикси/i,
      /chizhik|чижик/i,
      /fix\s*price|fixprice|фикс\s*прайс/i,
      /spar\b|спар\b/i,
      /globus|глобус/i,
      /okey|окей/i,
      /billa|билла/i,
      /продукт/i,
      /супермаркет/i,
      /гастроном/i,
      /grocer/i,
    ],
  },
  {
    category: 'Транспорт',
    patterns: [
      /fasten|фастен/i,
      /citymobil|ситимобил/i,
      /gett|гетт/i,
      /maxim\s*taxi|такси\s*максим/i,
      /yandex\.?\s*(?:go|taxi)|яндекс\.?\s*(?:go|такси)/i,
      /uber/i,
      /bolt\b/i,
      /indriver|in\.?\s*driver|индрайвер/i,
      /whoosh|вуш/i,
      /urent|юрент/i,
      /yandex\.?\s*drive|яндекс\.?\s*драйв/i,
      /delitime|делимобил/i,
      /belkacar|белка\s*car/i,
      /каршеринг/i,
      /такси/i,
      /\bметро\b/i,
      /мосметро/i,
      /транспорт/i,
      /бензин/i,
      /\bазс\b/i,
      /заправ/i,
      /parking|парковк/i,
      /platron.*транспорт/i,
    ],
  },
  {
    category: 'Кафе',
    patterns: [
      /delivery\s*club|деливери\s*клуб/i,
      /yandex\.?\s*eda|яндекс\.?\s*ед/i,
      /dostavista|достависта/i,
      /dodo|додо/i,
      /burger\s*king|бургер\s*кинг/i,
      /kfc/i,
      /mcdonald|макдоналд/i,
      /starbucks|старбакс/i,
      /subway|сабвей/i,
      /coffee|кофе/i,
      /кафе/i,
      /ресторан/i,
      /обед/i,
      /pizza|пицц/i,
      /sushi|суши/i,
      /wok|вок\b/i,
      /tanuki|тануки/i,
      /teremok|теремок/i,
      /шашлыч/i,
      /столовая/i,
    ],
  },
  {
    category: 'ЖКХ',
    patterns: [
      /жкх/i,
      /коммун/i,
      /квартплат/i,
      /электри/i,
      /mosenergo|мосэнерго/i,
      /ростехнадзор/i,
      /водоканал/i,
      /газпром\s*межрегион/i,
      /интернет/i,
      /ростелеком/i,
      /дом\.ру|dom\.ru/i,
    ],
  },
  {
    category: 'Здоровье',
    patterns: [
      /apteka|аптек/i,
      /rigla|ригла/i,
      /36[,.]6|горздрав/i,
      /клиник/i,
      /поликлиник/i,
      /стоматолог/i,
      /медцентр/i,
      /\bмед\b/i,
      /здоров/i,
      /invitro|инвитро/i,
      /gemotest|гемотест/i,
    ],
  },
  {
    category: 'Одежда',
    patterns: [
      /lamoda|ламода/i,
      /zara|зара\b/i,
      /\bhm\b|h\s*&\s*m/i,
      /uniqlo|юникло/i,
      /reserved|резервед/i,
      /ostin|остин/i,
      /одежд/i,
      /обув/i,
      /sportmaster|спортмастер/i,
      /rendez-vous/i,
    ],
  },
  {
    category: 'Развлечения',
    patterns: [
      /kinopoisk|кинопоиск/i,
      /netflix|нетфликс/i,
      /\bivi\b|иви\.ru/i,
      /okko|окко/i,
      /\bwink\b|винк\b/i,
      /spotify|спотифай/i,
      /apple\.com\/bill/i,
      /youtube\s*premium/i,
      /steam|стим\b/i,
      /playstation|плейстейшн/i,
      /кино/i,
      /театр/i,
      /концерт/i,
      /игр/i,
      /развлеч/i,
      /подписк/i,
    ],
  },
];

const BANK_CATEGORY_HINTS: Array<{ category: ExpenseCategory; patterns: RegExp[] }> = [
  { category: 'Продукты', patterns: [/продукт/i, /супермаркет/i, /grocery/i] },
  { category: 'Онлайн', patterns: [/маркетплейс/i, /онлайн/i, /интернет.?магазин/i] },
  { category: 'Транспорт', patterns: [/транспорт/i, /такси/i, /заправ/i, /авто/i] },
  { category: 'Кафе', patterns: [/ресторан/i, /кафе/i, /фастфуд/i, /общепит/i] },
  { category: 'ЖКХ', patterns: [/жкх/i, /коммунал/i, /связь/i, /интернет/i] },
  { category: 'Здоровье', patterns: [/здоров/i, /аптек/i, /мед/i] },
  { category: 'Одежда', patterns: [/одежд/i, /обув/i] },
  { category: 'Развлечения', patterns: [/развлеч/i, /кино/i] },
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchRules(text: string, rules: CategoryRule[]): AnyCategory | null {
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.category;
    }
  }
  return null;
}

function mapBankCategoryHint(bankCategory: string, kind: TransactionKind): AnyCategory | null {
  const normalized = normalizeText(bankCategory);
  if (!normalized) return null;

  if (kind === 'income') {
    if ((INCOME_CATEGORIES as string[]).includes(bankCategory.trim())) {
      return bankCategory.trim() as IncomeCategory;
    }
    return matchRules(normalized, INCOME_RULES);
  }

  const exact = bankCategory.trim();
  if ((EXPENSE_CATEGORIES as string[]).includes(exact)) {
    return exact as ExpenseCategory;
  }

  for (const hint of BANK_CATEGORY_HINTS) {
    if (hint.patterns.some((pattern) => pattern.test(normalized))) {
      return hint.category;
    }
  }

  return null;
}

export function inferCategoryFromText(
  text: string,
  kind: TransactionKind,
  bankCategory?: string,
  options?: InferCategoryOptions
): AnyCategory {
  const normalized = normalizeText(text);
  const bankHint = bankCategory ? normalizeText(bankCategory) : '';
  const combined = bankHint ? `${normalized} ${bankHint}` : normalized;

  if (kind === 'income') {
    const fromText = matchRules(combined, INCOME_RULES);
    if (fromText) return fromText;
    const fromBank = bankCategory ? mapBankCategoryHint(bankCategory, kind) : null;
    if (fromBank && (INCOME_CATEGORIES as string[]).includes(fromBank)) return fromBank;
    return 'Другое';
  }

  const fromText = matchRules(combined, EXPENSE_RULES);
  if (fromText) return fromText;

  const fromProvider = providerOnlineCategory(options?.providerId, combined);
  if (fromProvider) return fromProvider;

  const fromBank = bankCategory ? mapBankCategoryHint(bankCategory, kind) : null;
  if (fromBank) return fromBank;

  return 'Другое';
}

export function inferExpenseCategory(
  description: string,
  bankCategory?: string,
  options?: InferCategoryOptions
): Category {
  const category = inferCategoryFromText(description, 'expense', bankCategory, options);
  return (EXPENSE_CATEGORIES as string[]).includes(category) ? (category as Category) : 'Другое';
}

export function inferIncomeCategory(
  description: string,
  bankCategory?: string,
  options?: InferCategoryOptions
): IncomeCategory {
  const category = inferCategoryFromText(description, 'income', bankCategory, options);
  return (INCOME_CATEGORIES as string[]).includes(category) ? (category as IncomeCategory) : 'Другое';
}
