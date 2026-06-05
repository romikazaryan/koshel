import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'flat' | 'accent';
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
        backgroundColor: colors.accentSoft,
      },
    })
  );

  return (
    <View
      style={[
        styles.base,
        variant === 'flat' && styles.flat,
        variant === 'accent' && styles.accent,
        style,
      ]}
    >
      {children}
    </View>
  );
}
