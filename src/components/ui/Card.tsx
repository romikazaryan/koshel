import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'flat' | 'accent' | 'income' | 'expense';
};

export function Card({ children, style, variant = 'default' }: Props) {
  const styles = useThemedStyles(({ colors, cardBase, radii }) =>
    StyleSheet.create({
      base: {
        ...cardBase,
        padding: 18,
        marginBottom: 14,
      },
      flat: {
        shadowOpacity: 0,
        elevation: 0,
        borderWidth: 1,
      },
      accent: {
        borderColor: colors.accentMuted,
        backgroundColor: colors.surface,
      },
      income: {
        borderLeftWidth: 3,
        borderLeftColor: colors.income,
        backgroundColor: colors.surface,
      },
      expense: {
        borderLeftWidth: 3,
        borderLeftColor: colors.expense,
        backgroundColor: colors.surface,
      },
    })
  );

  return (
    <View
      style={[
        styles.base,
        variant === 'flat' && styles.flat,
        variant === 'accent' && styles.accent,
        variant === 'income' && styles.income,
        variant === 'expense' && styles.expense,
        style,
      ]}
    >
      {children}
    </View>
  );
}
