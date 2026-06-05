import { Platform, type TextStyle } from 'react-native';

/**
 * Рукописный системный шрифт.
 * Bradley Hand — читабельнее Snell Roundhand (у того у «s» лишний штрих вверх).
 */
export const HANDWRITTEN_FONT = Platform.select({
  ios: 'Bradley Hand',
  android: 'cursive',
  default: undefined,
});

export const LOGO_SIZE = {
  splash: 58,
  auth: 46,
  dashboard: 38,
} as const;

export function koshelLogoTextStyle(size: number): TextStyle {
  const base: TextStyle = {
    fontSize: size,
    lineHeight: Math.round(size * 1.12),
    letterSpacing: 0,
  };
  if (HANDWRITTEN_FONT) {
    return { ...base, fontFamily: HANDWRITTEN_FONT };
  }
  return { ...base, fontStyle: 'italic', fontWeight: '600' };
}

export function koshelLogoWord(center: 'dollar' | 's'): string {
  return center === 'dollar' ? 'ko$hel' : 'koshel';
}
