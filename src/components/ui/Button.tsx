import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { NavyShimmerFill } from './NavyShimmerBackground';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'income' | 'expense';
export type ButtonSize = 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  fullWidth = true,
  leftIcon,
  style,
}: Props) {
  const shimmerId = useId().replace(/:/g, '');
  const [shimmerSize, setShimmerSize] = useState<{ w: number; h: number } | null>(null);

  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: 'transparent',
        overflow: 'hidden',
        position: 'relative',
      },
      md: { paddingVertical: 11, paddingHorizontal: 16 },
      lg: { paddingVertical: 14, paddingHorizontal: 18 },
      full: { alignSelf: 'stretch' },
      primary: {
        backgroundColor: c.navy,
        ...shadows.soft,
      },
      secondary: {
        backgroundColor: c.surface,
        borderColor: c.border,
      },
      ghost: {
        backgroundColor: 'transparent',
      },
      danger: {
        backgroundColor: c.dangerSoft,
        borderColor: c.danger,
      },
      income: {
        backgroundColor: c.income,
        ...shadows.soft,
      },
      expense: {
        backgroundColor: c.expense,
        ...shadows.soft,
      },
      disabled: {
        opacity: 0.5,
      },
      labelBase: {
        fontSize: size === 'lg' ? 16 : 15,
        fontWeight: '700',
        letterSpacing: -0.2,
      },
      labelPrimary: { color: c.textOnAccent },
      labelSecondary: { color: c.text },
      labelGhost: { color: c.accent },
      labelDanger: { color: c.danger },
      labelIncome: { color: c.textOnAccent },
      labelExpense: { color: c.textOnAccent },
      content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        position: 'relative',
        zIndex: 2,
      },
    })
  );

  const labelStyle =
    variant === 'primary'
      ? styles.labelPrimary
      : variant === 'secondary'
        ? styles.labelSecondary
        : variant === 'danger'
          ? styles.labelDanger
          : variant === 'income'
            ? styles.labelIncome
            : variant === 'expense'
              ? styles.labelExpense
              : styles.labelGhost;

  const spinnerColor =
    variant === 'primary' || variant === 'income' || variant === 'expense'
      ? undefined
      : variant === 'danger'
        ? undefined
        : undefined;

  const onLayout = (event: LayoutChangeEvent) => {
    if (variant !== 'primary') return;
    const { width, height } = event.nativeEvent.layout;
    setShimmerSize((prev) =>
      prev?.w === width && prev?.h === height ? prev : { w: width, h: height }
    );
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onLayout={onLayout}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        fullWidth && styles.full,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && { opacity: 0.88 },
        style,
      ]}
    >
      {variant === 'primary' && shimmerSize ? (
        <NavyShimmerFill
          width={shimmerSize.w}
          height={shimmerSize.h}
          idPrefix={shimmerId}
          glow="compact"
        />
      ) : null}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : (
          <>
            {leftIcon ? <View>{leftIcon}</View> : null}
            <Text style={[styles.labelBase, labelStyle]} numberOfLines={1}>
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}
