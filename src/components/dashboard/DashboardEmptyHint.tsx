import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { LUXURY_GOLD } from '../../theme/premium';
import { spacing, typography } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  onAddExpense: () => void;
  onAddIncome?: () => void;
};

export function DashboardEmptyHint({ onAddExpense, onAddIncome }: Props) {
  const styles = useThemedStyles(({ colors: c, radii, shadows, cardBase }) =>
    StyleSheet.create({
      card: {
        ...cardBase,
        borderRadius: radii.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: c.borderLight,
        ...shadows.soft,
      },
      iconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
      },
      iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceMuted,
      },
      title: {
        ...typography.h3,
        color: c.text,
        flex: 1,
      },
      text: {
        ...typography.body,
        color: c.textMuted,
        lineHeight: 22,
        marginBottom: spacing.lg,
      },
      actions: { gap: spacing.sm },
    })
  );

  return (
    <View style={styles.card}>
      <View style={styles.iconRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="wallet-outline" size={24} color={LUXURY_GOLD} />
        </View>
        <Text style={styles.title}>Пока нет операций за месяц</Text>
      </View>
      <Text style={styles.text}>
        Добавьте первую трату или доход — баланс, категории и AI-разбор заработают сразу.
      </Text>
      <View style={styles.actions}>
        <Button label="Добавить трату" onPress={onAddExpense} />
        {onAddIncome ? (
          <Button label="Добавить доход" variant="ghost" onPress={onAddIncome} />
        ) : null}
      </View>
    </View>
  );
}
