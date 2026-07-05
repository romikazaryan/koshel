import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  rightAction?: ReactNode;
  rightLabel?: string;
  onRightPress?: () => void;
  style?: ViewStyle;
};

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Назад',
  rightAction,
  rightLabel,
  onRightPress,
  style,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, spacing }) =>
    StyleSheet.create({
      wrap: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
      },
      navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 40,
        marginBottom: title ? spacing.sm : 0,
      },
      backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingRight: 8,
      },
      backText: {
        ...typography.body,
        color: c.accentDark,
        fontWeight: '700',
      },
      rightBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      rightText: {
        ...typography.meta,
        color: c.accentDark,
        fontWeight: '700',
      },
      title: {
        ...typography.h1,
        color: c.text,
        letterSpacing: -0.6,
      },
      subtitle: {
        ...typography.body,
        color: c.textMuted,
        marginTop: 4,
        lineHeight: 21,
      },
    })
  );

  return (
    <View style={[styles.wrap, style]}>
      {(onBack || rightAction || rightLabel) ? (
        <View style={styles.navRow}>
          {onBack ? (
            <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={colors.accentDark} />
              <Text style={styles.backText}>{backLabel}</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          {rightAction ??
            (rightLabel && onRightPress ? (
              <TouchableOpacity style={styles.rightBtn} onPress={onRightPress} hitSlop={4}>
                <Ionicons name="time-outline" size={16} color={colors.accentDark} />
                <Text style={styles.rightText}>{rightLabel}</Text>
              </TouchableOpacity>
            ) : (
              <View />
            ))}
        </View>
      ) : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
