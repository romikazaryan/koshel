import type { ColorPalette } from './colors';

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
};

export function createThemeLayout(colors: ColorPalette) {
  const shadows = {
    card: {
      shadowColor: colors.shadow,
      shadowOpacity: colors.shadow === '#000000' ? 0.35 : 0.1,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    soft: {
      shadowColor: colors.shadow,
      shadowOpacity: colors.shadow === '#000000' ? 0.25 : 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    tabBar: {
      shadowColor: colors.shadow,
      shadowOpacity: colors.shadow === '#000000' ? 0.4 : 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -4 },
      elevation: 12,
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
}

/** @deprecated Используйте createThemeLayout через useAppTheme() */
import { lightColors } from './colors';
const _legacy = createThemeLayout(lightColors);
export const shadows = _legacy.shadows;
export const cardBase = _legacy.cardBase;
