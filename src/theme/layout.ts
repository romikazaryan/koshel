import type { ColorPalette } from './colors';

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
};

export function createThemeLayout(colors: ColorPalette) {
  const isDark = colors.background === '#0B0F17' || colors.shadow === '#000000';

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
