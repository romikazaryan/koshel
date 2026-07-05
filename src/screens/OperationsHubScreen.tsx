import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import type { HomeStackParamList } from '../navigation/types';
import { spacing, typography } from '../theme/layout';
import { useThemedStyles } from '../theme/useThemedStyles';
import { AddExpenseScreen } from './AddExpenseScreen';
import { DebtsScreen } from './DebtsScreen';
import { SubscriptionsScreen } from './SubscriptionsScreen';

type OperationsSegment = 'expenses' | 'debts' | 'subscriptions';

type Props = NativeStackScreenProps<HomeStackParamList, 'OperationsHub'>;

const SEGMENT_HINTS: Record<OperationsSegment, string> = {
  expenses: 'Голос, чек или ручной ввод — обычные траты',
  debts: 'Кредиты и долги — план обязательных платежей',
  subscriptions: 'Netflix, Spotify и другие — ежемесячные списания',
};

export function OperationsHubScreen({ navigation, route }: Props) {
  const { month, initialTransactions, initialSegment = 'expenses', firstExpenseCue = false } =
    route.params;
  const [segment, setSegment] = useState<OperationsSegment>(initialSegment);

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      segmentWrap: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.sm,
      },
      segmentHint: {
        ...typography.body,
        color: c.textMuted,
        lineHeight: 21,
        marginBottom: spacing.md,
      },
      body: { flex: 1 },
    })
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        backLabel="Главная"
        title="Расходы"
        subtitle="Траты, долги и подписки в одном месте"
        rightLabel="История"
        onRightPress={() =>
          navigation.navigate('TransactionHistory', {
            kind: 'expense',
            month,
            initialTransactions,
          })
        }
      />

      <View style={styles.segmentWrap}>
        <Text style={styles.segmentHint}>{SEGMENT_HINTS[segment]}</Text>
        <SegmentedControl<OperationsSegment>
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
          <AddExpenseScreen lockedKind="expense" embedded firstExpenseCue={firstExpenseCue} />
        ) : segment === 'debts' ? (
          <DebtsScreen embedded />
        ) : (
          <SubscriptionsScreen embedded />
        )}
      </View>
    </SafeAreaView>
  );
}
