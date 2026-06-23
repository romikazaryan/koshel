import type { ColorPalette } from './colors';

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
};

/** Единая шкала отступов (4-pt grid). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

/**
 * Роли типографики. Применять как ...typography.h1 в StyleSheet.
 * fontVariant tabular-nums держим отдельно (money helper ниже).
 */
export const typography = {
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.8 },
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2 },
  bodyLg: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  meta: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 11, fontWeight: '600' as const },
  overline: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
};

/** Моноширинные цифры для денежных значений. */
export const moneyText = { fontVariant: ['tabular-nums' as const] };

export function createThemeLayout(colors: ColorPalette) {
  const isDark = colors.shadow === '#000000';

  const shadows = {
    card: {
      shadowColor: colors.shadow,
      shadowOpacity: isDark ? 0.32 : 0.05,
      shadowRadius: isDark ? 20 : 16,
      shadowOffset: { width: 0, height: isDark ? 10 : 6 },
      elevation: isDark ? 8 : 3,
    },
    soft: {
      shadowColor: colors.shadow,
      shadowOpacity: isDark ? 0.22 : 0.04,
      shadowRadius: isDark ? 12 : 8,
      shadowOffset: { width: 0, height: isDark ? 4 : 2 },
      elevation: isDark ? 4 : 2,
    },
    tabBar: {
      shadowColor: colors.shadow,
      shadowOpacity: isDark ? 0.38 : 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -2 },
      elevation: isDark ? 10 : 6,
    },
  };

  const cardBase = {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  };

  return { shadows, cardBase };
};

/** @deprecated Используйте createThemeLayout через useAppTheme() */
import { lightColors } from './colors';
const _legacy = createThemeLayout(lightColors);
export const shadows = _legacy.shadows;
export const cardBase = _legacy.cardBase;
