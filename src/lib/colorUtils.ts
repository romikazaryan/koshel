/** Сдвиг яркости hex-цвета (percent: отрицательный — темнее). */
export function shiftHexColor(hex: string, percent: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;

  const num = parseInt(normalized, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0xff) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
