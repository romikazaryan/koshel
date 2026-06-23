import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '../../contexts/ThemeContext';
import { chartGold } from '../../theme/colors';
import { shiftHexColor } from '../../lib/colorUtils';
import { describeArc, polarToCartesian } from '../../lib/chartGeometry';

export type DonutSlice = {
  label: string;
  amount: number;
  color: string;
};

type Props = {
  slices: DonutSlice[];
  centerValue?: string;
  centerTitle?: string;
  centerSubtitle?: string;
  size?: number;
  onPress?: () => void;
};

type SliceModel = DonutSlice & {
  index: number;
  startAngle: number;
  sweep: number;
  percent: number;
  midAngle: number;
  gradId: string;
  tint: string;
  shade: string;
};

const DEFAULT_SIZE = 210;
const REVEAL_STAGGER = 0.08;
const GAP_DEG = 3.4;

function revealSliceProgress(globalT: number, index: number, total: number) {
  const start = index * REVEAL_STAGGER;
  const end = start + 0.82;
  const span = Math.max(0.001, end - start);
  const raw = (globalT * (total * REVEAL_STAGGER + 0.82) - start) / span;
  return Math.min(1, Math.max(0, raw));
}

function formatRub(amount: number) {
  return `${amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`;
}

export function AnimatedDonutChart({
  slices,
  centerValue,
  centerTitle = 'Всего расходов',
  centerSubtitle = 'за месяц',
  size = DEFAULT_SIZE,
  onPress,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();

  const chartSize = Math.min(size, screenWidth - 72);
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const ringWidth = chartSize * 0.16;
  const midR = chartSize / 2 - ringWidth / 2 - 4;
  const hubR = midR - ringWidth / 2 - 8;
  const pad = 18;
  const canvas = chartSize + pad * 2;

  const [revealT, setRevealT] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const total = useMemo(() => slices.reduce((sum, s) => sum + s.amount, 0), [slices]);
  const chartKey = useMemo(() => slices.map((s) => `${s.label}:${s.amount}`).join('|'), [slices]);

  const reveal = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  const sliceModels = useMemo<SliceModel[]>(() => {
    if (total <= 0) return [];
    let angle = 0;
    return slices.map((slice, index) => {
      const sweep = (slice.amount / total) * 360;
      const startAngle = angle;
      angle += sweep;
      return {
        ...slice,
        index,
        startAngle,
        sweep,
        midAngle: startAngle + sweep / 2,
        percent: Math.round((slice.amount / total) * 100),
        gradId: `lux-grad-${index}`,
        tint: shiftHexColor(slice.color, isDark ? 20 : 14),
        shade: shiftHexColor(slice.color, isDark ? -24 : -14),
      };
    });
  }, [isDark, slices, total]);

  const renderedSlices = useMemo(() => {
    return sliceModels
      .map((slice) => {
        const progress = reduceMotion ? 1 : revealSliceProgress(revealT, slice.index, sliceModels.length);
        const visibleSweep = slice.sweep * progress;
        const gap = Math.min(GAP_DEG, Math.max(0, visibleSweep - 1.5));
        const start = slice.startAngle + gap / 2;
        const end = slice.startAngle + visibleSweep - gap / 2;
        if (end - start <= 0.4) return null;
        return { ...slice, d: describeArc(cx, cy, midR, start, end) };
      })
      .filter((s): s is NonNullable<typeof s> => s != null);
  }, [cx, cy, midR, reduceMotion, revealT, sliceModels]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    reveal.setValue(0);
    enter.setValue(0);
    setRevealT(reduceMotion ? 1 : 0);

    if (reduceMotion) {
      enter.setValue(1);
      return;
    }

    const listener = reveal.addListener(({ value }) => setRevealT(value));
    Animated.parallel([
      Animated.timing(enter, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(reveal, {
        toValue: 1,
        duration: 1300,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }),
    ]).start();

    return () => reveal.removeListener(listener);
  }, [chartKey, enter, reduceMotion, reveal]);

  useEffect(() => {
    if (reduceMotion) return;
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const radar = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 2800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    breathe.start();
    radar.start();
    return () => {
      breathe.stop();
      radar.stop();
    };
  }, [pulse, reduceMotion, ring]);

  const displayTotal = centerValue ?? formatRub(total);

  const trackStroke = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const hubBorder = isDark ? 'rgba(217,164,65,0.22)' : 'rgba(0,0,0,0.05)';
  const ambientOpacity = isDark ? 0.55 : 0.28;

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.16] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.28, 0] });
  const ringDiameter = chartSize - 2;

  return (
    <View style={[styles.wrap, { width: canvas, height: canvas }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.radarRing,
          {
            width: ringDiameter,
            height: ringDiameter,
            borderRadius: ringDiameter / 2,
            left: pad + cx - ringDiameter / 2,
            top: pad + cy - ringDiameter / 2,
            borderColor: chartGold,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />

      <Animated.View
        style={{
          opacity: enter,
          transform: [{ scale: Animated.multiply(enterScale, pulseScale) }],
        }}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={onPress ? 'Открыть разбор расходов' : undefined}
        >
          <Svg width={canvas} height={canvas} viewBox={`0 0 ${canvas} ${canvas}`}>
            <Defs>
              <RadialGradient id="lux-ambient" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={chartGold} stopOpacity={ambientOpacity} />
                <Stop offset="58%" stopColor={chartGold} stopOpacity={ambientOpacity * 0.3} />
                <Stop offset="100%" stopColor={chartGold} stopOpacity={0} />
              </RadialGradient>
              {sliceModels.map((slice) => {
                const hi = polarToCartesian(cx, cy, midR, slice.midAngle - 30);
                const lo = polarToCartesian(cx, cy, midR, slice.midAngle + 130);
                return (
                  <LinearGradient
                    key={slice.gradId}
                    id={slice.gradId}
                    x1={String(hi.x)}
                    y1={String(hi.y)}
                    x2={String(lo.x)}
                    y2={String(lo.y)}
                    gradientUnits="userSpaceOnUse"
                  >
                    <Stop offset="0%" stopColor={slice.tint} />
                    <Stop offset="55%" stopColor={slice.color} />
                    <Stop offset="100%" stopColor={slice.shade} />
                  </LinearGradient>
                );
              })}
            </Defs>

            <G x={pad} y={pad}>
              <Circle cx={cx} cy={cy} r={midR * 1.34} fill="url(#lux-ambient)" />

              <Circle
                cx={cx}
                cy={cy}
                r={midR}
                fill="none"
                stroke={trackStroke}
                strokeWidth={ringWidth}
              />

              {renderedSlices.map((slice) => (
                <Path
                  key={`slice-${slice.index}`}
                  d={slice.d}
                  fill="none"
                  stroke={`url(#${slice.gradId})`}
                  strokeWidth={ringWidth}
                  strokeLinecap="round"
                />
              ))}
            </G>
          </Svg>

          <View
            pointerEvents="none"
            style={[
              styles.hub,
              {
                left: pad + cx - hubR,
                top: pad + cy - hubR,
                width: hubR * 2,
                height: hubR * 2,
                borderRadius: hubR,
                borderColor: hubBorder,
              },
            ]}
          >
            <Text style={[styles.hubTitle, { color: colors.textMuted }]} numberOfLines={1}>
              {centerTitle}
            </Text>
            <Text
              style={[styles.hubAmount, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {displayTotal}
            </Text>
            <Text style={[styles.hubSubtitle, { color: chartGold }]} numberOfLines={1}>
              {centerSubtitle}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  hub: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
  },
  hubTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 3,
    textAlign: 'center',
  },
  hubAmount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  hubSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 3,
    textAlign: 'center',
  },
});
