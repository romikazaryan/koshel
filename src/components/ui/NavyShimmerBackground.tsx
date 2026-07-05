import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAppTheme } from '../../contexts/ThemeContext';
import { LUXURY_GOLD } from '../../theme/premium';

export type NavyShimmerGlow = 'full' | 'compact' | 'none';

type FillProps = {
  width: number;
  height: number;
  idPrefix: string;
  glow?: NavyShimmerGlow;
};

export function NavyShimmerFill({ width, height, idPrefix, glow = 'full' }: FillProps) {
  const { isDark, colors: c } = useAppTheme();
  const bgId = `${idPrefix}Bg`;
  const glowId = `${idPrefix}Glow`;
  const glowOpacity =
    glow === 'full' ? (isDark ? 0.34 : 0.3) : glow === 'compact' ? (isDark ? 0.22 : 0.18) : 0;

  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.navyMid} />
          <Stop offset="1" stopColor={c.navy} />
        </LinearGradient>
        {glow !== 'none' ? (
          <RadialGradient id={glowId} cx="86%" cy="2%" r={glow === 'compact' ? '48%' : '62%'}>
            <Stop offset="0" stopColor={LUXURY_GOLD} stopOpacity={glowOpacity} />
            <Stop offset="1" stopColor={LUXURY_GOLD} stopOpacity={0} />
          </RadialGradient>
        ) : null}
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${bgId})`} />
      {glow !== 'none' ? (
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${glowId})`} />
      ) : null}
    </Svg>
  );
}

export function NavyGoldEdge({ inset = 18, opacity = 0.5 }: { inset?: number; opacity?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: inset,
        right: inset,
        height: 1.5,
        backgroundColor: LUXURY_GOLD,
        opacity,
        zIndex: 1,
      }}
    />
  );
}

type ShellProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  idPrefix?: string;
  showGoldEdge?: boolean;
  goldEdgeInset?: number;
  glow?: NavyShimmerGlow;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function NavyShimmerShell({
  children,
  style,
  idPrefix: idPrefixProp,
  showGoldEdge = true,
  goldEdgeInset = 18,
  glow = 'full',
  onLayout: onLayoutProp,
}: ShellProps) {
  const reactId = useId().replace(/:/g, '');
  const idPrefix = idPrefixProp ?? reactId;
  const { colors: c } = useAppTheme();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev?.w === width && prev?.h === height ? prev : { w: width, h: height }
    );
    onLayoutProp?.(event);
  };

  return (
    <View
      style={[{ backgroundColor: c.navy, overflow: 'hidden', position: 'relative' }, style]}
      onLayout={onLayout}
    >
      {size ? (
        <NavyShimmerFill width={size.w} height={size.h} idPrefix={idPrefix} glow={glow} />
      ) : null}
      {showGoldEdge ? <NavyGoldEdge inset={goldEdgeInset} /> : null}
      {children}
    </View>
  );
}

type PressableProps = {
  onPress?: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  glow?: NavyShimmerGlow;
  accessibilityLabel?: string;
};

export function NavyShimmerPressable({
  onPress,
  disabled = false,
  children,
  style,
  contentStyle,
  glow = 'compact',
  accessibilityLabel,
}: PressableProps) {
  const reactId = useId().replace(/:/g, '');
  const { colors: c } = useAppTheme();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev?.w === width && prev?.h === height ? prev : { w: width, h: height }
    );
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={({ pressed }) => [
        {
          overflow: 'hidden',
          backgroundColor: c.navy,
          position: 'relative',
        },
        style,
        disabled && { opacity: 0.55 },
        pressed && !disabled && { opacity: 0.9 },
      ]}
    >
      {size ? (
        <NavyShimmerFill width={size.w} height={size.h} idPrefix={reactId} glow={glow} />
      ) : null}
      <View style={[{ position: 'relative', zIndex: 2 }, contentStyle]}>{children}</View>
    </Pressable>
  );
}
