import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { typography } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  children: string;
  style?: ViewStyle;
};

export function SectionLabel({ children, style }: Props) {
  const styles = useThemedStyles(({ colors: c, spacing }) =>
    StyleSheet.create({
      wrap: { marginBottom: spacing.sm, marginTop: spacing.xs },
      text: {
        ...typography.overline,
        color: c.textMuted,
        letterSpacing: 1,
      },
    })
  );

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}
