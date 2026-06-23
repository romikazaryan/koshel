import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useThemedStyles } from '../../theme/useThemedStyles';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
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
      },
      md: { paddingVertical: 11, paddingHorizontal: 16 },
      lg: { paddingVertical: 14, paddingHorizontal: 18 },
      full: { alignSelf: 'stretch' },
      primary: {
        backgroundColor: c.accent,
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
    })
  );

  const labelStyle =
    variant === 'primary'
      ? styles.labelPrimary
      : variant === 'secondary'
        ? styles.labelSecondary
        : variant === 'danger'
          ? styles.labelDanger
          : styles.labelGhost;

  const spinnerColor =
    variant === 'primary' ? undefined : variant === 'danger' ? '#fff' : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        fullWidth && styles.full,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
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
    </Pressable>
  );
}
