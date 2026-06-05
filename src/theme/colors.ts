/** Палитра koshel: глубокий синий + изумруд (светлая и тёмная темы). */

export type ColorPalette = {
  background: string;
  backgroundDeep: string;
  surface: string;
  surfaceMuted: string;
  navy: string;
  navyMid: string;
  primary: string;
  primarySoft: string;
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
  tabActive: string;
  tabInactive: string;
  overlay: string;
  shadow: string;
};

export const lightColors: ColorPalette = {
  background: '#E9F0F7',
  backgroundDeep: '#D4E2EF',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F8FC',
  navy: '#0F1F35',
  navyMid: '#1A3352',
  primary: '#1A3352',
  primarySoft: '#DCE8F5',
  accent: '#10B981',
  accentDark: '#059669',
  accentSoft: '#D1FAE5',
  accentMuted: '#6EE7B7',
  text: '#0F1F35',
  textSecondary: '#3D5268',
  textMuted: '#6B7F94',
  textOnDark: '#F0F9FF',
  textOnDarkMuted: '#94B4CC',
  textOnAccent: '#FFFFFF',
  border: '#C5D5E4',
  borderLight: '#E2EBF4',
  danger: '#E11D48',
  dangerSoft: '#FFE4E6',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  success: '#10B981',
  successSoft: '#D1FAE5',
  tabBar: '#FFFFFF',
  tabActive: '#10B981',
  tabInactive: '#8BA3B8',
  overlay: 'rgba(15, 31, 53, 0.55)',
  shadow: '#0F1F35',
};

export const darkColors: ColorPalette = {
  background: '#0B1220',
  backgroundDeep: '#060D18',
  surface: '#141E2E',
  surfaceMuted: '#1A2838',
  navy: '#0A1628',
  navyMid: '#1E3A5F',
  primary: '#2D4A6F',
  primarySoft: '#1A2D42',
  accent: '#10B981',
  accentDark: '#34D399',
  accentSoft: '#064E3B',
  accentMuted: '#047857',
  text: '#F0F9FF',
  textSecondary: '#B8CDE0',
  textMuted: '#7A9BB5',
  textOnDark: '#F0F9FF',
  textOnDarkMuted: '#94B4CC',
  textOnAccent: '#FFFFFF',
  border: '#2A3F5C',
  borderLight: '#1E2F45',
  danger: '#FB7185',
  dangerSoft: '#3F1D28',
  warning: '#FBBF24',
  warningSoft: '#3D3010',
  success: '#34D399',
  successSoft: '#064E3B',
  tabBar: '#141E2E',
  tabActive: '#34D399',
  tabInactive: '#6B8BA8',
  overlay: 'rgba(0, 0, 0, 0.7)',
  shadow: '#000000',
};

/** @deprecated Используйте useAppTheme().colors */
export const colors = lightColors;

export const chartPaletteLight = [
  '#10B981',
  '#1A3352',
  '#38BDF8',
  '#14B8A6',
  '#6366F1',
  '#F59E0B',
  '#8B5CF6',
  '#64748B',
];

export const chartPaletteDark = [
  '#34D399',
  '#60A5FA',
  '#2DD4BF',
  '#A78BFA',
  '#FBBF24',
  '#F472B6',
  '#94A3B8',
  '#4ADE80',
];

/** @deprecated Используйте useAppTheme().chartPalette */
export const chartPalette = chartPaletteLight;
