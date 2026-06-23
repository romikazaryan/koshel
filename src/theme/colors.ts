/**
 * Koshel — палитра:
 * светлая «ультрамарин по персику» (#120A8F + #FFDAB9),
 * тёмная «лавандовый по фиолетовому» (#C8BEFA + #151130).
 * Доход/расход — семантические бирюза и rose.
 */

export type ColorPalette = {
  background: string;
  backgroundDeep: string;
  surface: string;
  surfaceMuted: string;
  navy: string;
  navyMid: string;
  primary: string;
  primarySoft: string;
  income: string;
  incomeDark: string;
  incomeSoft: string;
  incomeMuted: string;
  expense: string;
  expenseDark: string;
  expenseSoft: string;
  expenseMuted: string;
  /** Бренд: табы, CTA, лого */
  accent: string;
  accentDark: string;
  accentSoft: string;
  accentMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnDark: string;
  textOnDarkMuted: string;
  textOnAccent: string;
  border: string;
  borderLight: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
  tabBar: string;
  /** Акцент активной вкладки (Telegram blue) */
  tabAccent: string;
  tabActive: string;
  tabInactive: string;
  overlay: string;
  shadow: string;
};

/** Светлая: ультрамариновый акцент на персиковом фоне. */
const lightBrand = {
  primary: '#120A8F',
  primarySoft: '#E6E3F7',
  accent: '#120A8F',
  accentDark: '#0C0668',
  accentSoft: '#E6E3F7',
  accentMuted: '#B3AEDD',
};

const lightIncome = {
  income: '#0F766E',
  incomeDark: '#0D5C56',
  incomeSoft: '#F0FDFA',
  incomeMuted: '#99F6E4',
};

const lightExpense = {
  expense: '#E11D48',
  expenseDark: '#BE123C',
  expenseSoft: '#FFF1F2',
  expenseMuted: '#FECDD3',
};

export const lightColors: ColorPalette = {
  background: '#FFDAB9',
  backgroundDeep: '#F7CBA3',
  surface: '#FFF1E6',
  surfaceMuted: '#FCE6D3',
  navy: '#120A8F',
  navyMid: '#241A9E',
  ...lightBrand,
  ...lightIncome,
  ...lightExpense,
  text: '#1E1840',
  textSecondary: '#4A4470',
  textMuted: '#857F9E',
  textOnDark: '#FFE9D6',
  textOnDarkMuted: 'rgba(255, 233, 214, 0.72)',
  textOnAccent: '#FFF1E6',
  border: '#F0C6A4',
  borderLight: '#F8D8BF',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  warning: '#D97706',
  warningSoft: '#FFF7ED',
  success: '#059669',
  successSoft: '#ECFDF5',
  tabBar: '#FFF1E6',
  tabAccent: '#120A8F',
  tabActive: '#120A8F',
  tabInactive: '#9A93A8',
  overlay: 'rgba(18, 10, 143, 0.32)',
  shadow: '#2A1E5A',
};

/** Тёмная: лавандовый текст и CTA на глубоком фиолетовом. */
const darkBrand = {
  primary: '#C8BEFA',
  primarySoft: '#272150',
  accent: '#C8BEFA',
  accentDark: '#DAD2FF',
  accentSoft: '#272150',
  accentMuted: '#5B5288',
};

const darkIncome = {
  income: '#2DD4BF',
  incomeDark: '#5EEAD4',
  incomeSoft: '#042F2E',
  incomeMuted: '#115E59',
};

const darkExpense = {
  expense: '#FB7185',
  expenseDark: '#FDA4AF',
  expenseSoft: '#4C0519',
  expenseMuted: '#881337',
};

export const darkColors: ColorPalette = {
  background: '#151130',
  backgroundDeep: '#0F0C24',
  surface: '#1E1942',
  surfaceMuted: '#272150',
  navy: '#100C26',
  navyMid: '#2A2358',
  ...darkBrand,
  ...darkIncome,
  ...darkExpense,
  text: '#EAE6FF',
  textSecondary: '#C7C0EC',
  textMuted: '#8E86B6',
  textOnDark: '#EAE6FF',
  textOnDarkMuted: 'rgba(234, 230, 255, 0.68)',
  textOnAccent: '#151130',
  border: '#2F2960',
  borderLight: '#231D4A',
  danger: '#F87171',
  dangerSoft: '#4C1233',
  warning: '#FBBF24',
  warningSoft: '#3A2A12',
  success: '#34D399',
  successSoft: '#0B3B33',
  tabBar: '#1E1942',
  tabAccent: '#C8BEFA',
  tabActive: '#C8BEFA',
  tabInactive: '#7E76A8',
  overlay: 'rgba(8, 6, 20, 0.66)',
  shadow: '#000000',
};

/** @deprecated Используйте useAppTheme().colors */
export const colors = lightColors;

/** Тёплый золотой акцент luxury-аналитики. */
export const chartGold = '#D9A441';
export const chartGoldSoft = '#E8C57E';

/**
 * Luxury wealth-палитра: тёплое золото во главе, приглушённые
 * металлические и драгоценные тона. Без кислотного неона.
 */
const luxuryPalette = [
  '#D9A441',
  '#C77B58',
  '#7E9E8E',
  '#9B7BA0',
  '#6F8CA8',
  '#C2A36B',
  '#A98B6F',
  '#8C8F96',
];

export const chartPaletteLight = luxuryPalette;
export const chartPaletteDark = luxuryPalette;

/** @deprecated Используйте useAppTheme().chartPalette */
export const chartPalette = luxuryPalette;
