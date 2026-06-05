import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { AddExpenseScreen } from './AddExpenseScreen';
import { DebtsScreen } from './DebtsScreen';
import { SubscriptionsScreen } from './SubscriptionsScreen';

type ExpenseSegment = 'expenses' | 'debts' | 'subscriptions';

const SEGMENT_HINTS: Record<ExpenseSegment, string> = {
  expenses: 'Голос, чек или ручной ввод — обычные траты',
  debts: 'Кредиты и долги — платежи учитываются в расходах на главной',
  subscriptions: 'Netflix, Spotify и другие — списания каждый месяц',
};

export function ExpensesHubScreen() {
  const { colors } = useAppTheme();
  const [segment, setSegment] = useState<ExpenseSegment>('expenses');

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: c.background },
      header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
      title: { fontSize: 28, fontWeight: '800', color: c.accent, marginBottom: 4 },
      hint: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 12 },
      body: { flex: 1 },
    })
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Расходы</Text>
        <Text style={styles.hint}>{SEGMENT_HINTS[segment]}</Text>
        <SegmentedControl<ExpenseSegment>
          options={[
            { value: 'expenses', label: 'Траты' },
            { value: 'debts', label: 'Долги' },
            { value: 'subscriptions', label: 'Подписки' },
          ]}
          value={segment}
          onChange={setSegment}
          style={{ marginBottom: 0 }}
        />
      </View>

      <View style={styles.body}>
        {segment === 'expenses' ? (
          <AddExpenseScreen lockedKind="expense" embedded />
        ) : segment === 'debts' ? (
          <DebtsScreen embedded />
        ) : (
          <SubscriptionsScreen embedded />
        )}
      </View>
    </SafeAreaView>
  );
}
