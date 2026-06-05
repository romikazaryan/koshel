import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '../../contexts/ThemeContext';
import { shiftHexColor } from '../../lib/colorUtils';
import { describeDonutSlice } from '../../lib/chartGeometry';

export type DonutSlice = {
  label: string;
  amount: number;
  color: string;
};

type Props = {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
};

const SIZE = 260;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = 110;
const INNER_R = 72;
const SHADOW_OFFSET = 5;

export function AnimatedDonutChart({ slices, centerLabel = 'Расходы', centerValue }: Props) {
  const { colors, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();

  const total = useMemo(() => slices.reduce((sum, s) => sum + s.amount, 0), [slices]);
  const chartKey = useMemo(
    () => slices.map((s) => `${s.label}:${s.amount}`).join('|'),
    [slices]
  );

  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const paths = useMemo(() => {
    if (total <= 0) return [];
    let angle = 0;
    return slices.map((slice, index) => {
      const sweep = (slice.amount / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return {
        ...slice,
        index,
        d: describeDonutSlice(CX, CY, OUTER_R, INNER_R, start, end),
        percent: Math.round((slice.amount / total) * 100),
        gradId: `slice-grad-${index}`,
        light: shiftHexColor(slice.color, isDark ? 22 : 32),
        dark: shiftHexColor(slice.color, isDark ? -32 : -24),
      };
    });
  }, [isDark, slices, total]);

  useEffect(() => {
    enter.setValue(0);
    pulse.setValue(0);

    Animated.spring(enter, {
      toValue: 1,
      friction: 8,
      tension: 62,
      useNativeDriver: true,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [chartKey, enter, pulse]);

  const ringScale = Animated.multiply(
    enter.interpolate({
      inputRange: [0, 1],
      outputRange: [0.75, 1],
    }),
    pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.04],
    })
  );

  const displayTotal =
    centerValue ?? `₽${total.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;

  const hubFill = colors.surface;
  const hubRim = isDark ? '#FFFFFF18' : '#FFFFFFCC';
  const rimHighlight = isDark ? '#FFFFFF28' : '#FFFFFFA0';

  return (
    <View style={[styles.wrap, { maxWidth: Math.min(screenWidth - 48, 340) }]}>
      <View style={styles.chartStage}>
        <Animated.View
          style={[
            styles.ringCluster,
            {
              opacity: enter,
              transform: [{ scale: ringScale }],
            },
          ]}
        >
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Defs>
                <RadialGradient
                  id="ambientGlow"
                  cx={String(CX)}
                  cy={String(CY)}
                  r={String(OUTER_R + 32)}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.38} />
                  <Stop offset="62%" stopColor={colors.accent} stopOpacity={0.1} />
                  <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
                </RadialGradient>
                {paths.map((slice) => (
                  <LinearGradient
                    key={slice.gradId}
                    id={slice.gradId}
                    x1={String(CX - 42)}
                    y1={String(CY - OUTER_R)}
                    x2={String(CX + 38)}
                    y2={String(CY + OUTER_R)}
                    gradientUnits="userSpaceOnUse"
                  >
                    <Stop offset="0%" stopColor={slice.light} />
                    <Stop offset="48%" stopColor={slice.color} />
                    <Stop offset="100%" stopColor={slice.dark} />
                  </LinearGradient>
                ))}
              </Defs>

              <Circle cx={CX} cy={CY} r={OUTER_R + 26} fill="url(#ambientGlow)" />

              <G transform={`translate(0, ${SHADOW_OFFSET})`} opacity={0.32}>
                {paths.map((slice) => (
                  <Path key={`shadow-${slice.index}`} d={slice.d} fill="#000000" />
                ))}
              </G>

              {paths.map((slice) => (
                <Path
                  key={`body-${slice.index}`}
                  d={slice.d}
                  fill={`url(#${slice.gradId})`}
                  stroke={slice.dark}
                  strokeWidth={0.75}
                  strokeLinejoin="round"
                />
              ))}

              <Circle
                cx={CX}
                cy={CY}
                r={OUTER_R - 0.5}
                fill="none"
                stroke={rimHighlight}
                strokeWidth={1.4}
                opacity={0.5}
              />

              <Circle cx={CX} cy={CY} r={INNER_R + 2} fill={isDark ? '#00000044' : '#0F1F3528'} />
              <Circle cx={CX} cy={CY} r={INNER_R} fill={hubFill} />
              <Circle
                cx={CX}
                cy={CY - 2}
                r={INNER_R - 4}
                fill="none"
                stroke={hubRim}
                strokeWidth={1.2}
                opacity={0.45}
              />
            </Svg>
        </Animated.View>

        <View style={styles.centerLabel} pointerEvents="none">
          <Text style={[styles.centerTitle, { color: colors.textMuted }]}>{centerLabel}</Text>
          <Text style={[styles.centerValue, { color: colors.text }]}>{displayTotal}</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {paths.map((slice, index) => (
          <LegendRow
            key={slice.label}
            delay={160 + index * 50}
            color={slice.color}
            label={slice.label}
            amount={slice.amount}
            percent={slice.percent}
            textColor={colors.text}
            mutedColor={colors.textMuted}
          />
        ))}
      </View>
    </View>
  );
}

function LegendRow({
  delay,
  color,
  label,
  amount,
  percent,
  textColor,
  mutedColor,
}: {
  delay: number;
  color: string;
  label: string;
  amount: number;
  percent: number;
  textColor: string;
  mutedColor: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 380,
      delay,
      useNativeDriver: true,
    }).start();
  }, [delay, label, progress]);

  return (
    <Animated.View style={[styles.legendRow, { opacity: progress }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.legendMeta, { color: mutedColor }]}>
        {percent}% · ₽{amount.toLocaleString('ru-RU')}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'center',
  },
  chartStage: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
    marginBottom: 8,
  },
  ringCluster: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  centerValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  legend: {
    gap: 10,
    marginTop: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  legendMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
});
