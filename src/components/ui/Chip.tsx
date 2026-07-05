import { useId, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { typography } from '../../theme/layout';
import { NavyShimmerFill } from './NavyShimmerBackground';
import { useThemedStyles } from '../../theme/useThemedStyles';

export type ChipVariant = 'default' | 'accent' | 'income' | 'expense';

type Props = {
  label: string;
  active?: boolean;
  variant?: ChipVariant;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, active = false, variant = 'default', onPress, style }: Props) {
  const shimmerId = useId().replace(/:/g, '');
  const [shimmerSize, setShimmerSize] = useState<{ w: number; h: number } | null>(null);
  const useShimmer = active && variant === 'accent';

  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      chip: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
        overflow: 'hidden',
        position: 'relative',
      },
      chipActiveDefault: {
        backgroundColor: c.accentSoft,
        borderColor: c.accent,
      },
      chipActiveAccent: {
        backgroundColor: c.navy,
        borderColor: c.navy,
      },
      chipActiveIncome: {
        backgroundColor: c.income,
        borderColor: c.income,
      },
      chipActiveExpense: {
        backgroundColor: c.expense,
        borderColor: c.expense,
      },
      text: {
        ...typography.meta,
        color: c.textMuted,
        fontWeight: '600',
      },
      textActiveDefault: { color: c.accentDark, fontWeight: '700' },
      textActiveAccent: { color: c.textOnAccent, fontWeight: '700' },
      textActiveIncome: { color: c.textOnAccent, fontWeight: '700' },
      textActiveExpense: { color: c.textOnAccent, fontWeight: '700' },
      labelWrap: {
        position: 'relative',
        zIndex: 2,
      },
    })
  );

  const activeStyle =
    variant === 'income'
      ? styles.chipActiveIncome
      : variant === 'expense'
        ? styles.chipActiveExpense
        : variant === 'accent'
          ? styles.chipActiveAccent
          : styles.chipActiveDefault;

  const activeTextStyle =
    variant === 'income'
      ? styles.textActiveIncome
      : variant === 'expense'
        ? styles.textActiveExpense
        : variant === 'accent'
          ? styles.textActiveAccent
          : styles.textActiveDefault;

  const onLayout = (event: LayoutChangeEvent) => {
    if (!useShimmer) return;
    const { width, height } = event.nativeEvent.layout;
    setShimmerSize((prev) =>
      prev?.w === width && prev?.h === height ? prev : { w: width, h: height }
    );
  };

  return (
    <TouchableOpacity
      style={[styles.chip, active && activeStyle, style]}
      onPress={onPress}
      onLayout={onLayout}
      activeOpacity={0.75}
      disabled={!onPress}
    >
      {useShimmer && shimmerSize ? (
        <NavyShimmerFill
          width={shimmerSize.w}
          height={shimmerSize.h}
          idPrefix={shimmerId}
          glow="compact"
        />
      ) : null}
      <View style={styles.labelWrap}>
        <Text style={[styles.text, active && activeTextStyle]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}
