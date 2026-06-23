export function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

/** Сегмент кольца (donut) от startAngle до endAngle, градусы, 0° сверху. */
export function describeDonutSlice(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string {
  if (endAngle - startAngle >= 360) {
    endAngle = startAngle + 359.999;
  }

  const startOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const startInner = polarToCartesian(cx, cy, innerR, endAngle);
  const endInner = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
}

/** Дуга по центральной линии — для stroked-сегментов с круглыми концами. */
export function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  if (endAngle - startAngle >= 360) {
    endAngle = startAngle + 359.999;
  }
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/** Donut-сегмент с деликатным зазором между долями. */
export function describeDonutSliceGapped(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
  gapDeg = 2.8
): string {
  const inset = Math.min(gapDeg / 2, Math.max(0, (endAngle - startAngle) / 2 - 0.35));
  const start = startAngle + inset;
  const end = endAngle - inset;
  if (end - start <= 0.2) return '';
  return describeDonutSlice(cx, cy, outerR, innerR, start, end);
}
