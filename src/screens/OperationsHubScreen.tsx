import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import type { HomeStackParamList } from '../navigation/types';
import { useThemedStyles } from '../theme/useThemedStyles';
import { AddExpenseScreen } from './AddExpenseScreen';
import { DebtsScreen } from './DebtsScreen';
import { SubscriptionsScreen } from './SubscriptionsScreen';

type OperationsSegment = 'expenses' | 'debts' | 'subscriptions';

type Props = NativeStackScreenProps<HomeStackParamList, 'OperationsHub'>;

const SEGMENT_HINTS: Record<OperationsSegment, string> = {
  expenses: 'Голос, чек или ручной ввод — обычные траты',
  debts: 'Кредиты и долги — платежи учитываются в расходах на главной',
  subscriptions: 'Netflix, Spotify и другие — списания каждый месяц',
};

export function OperationsHubScreen({ navigation, route }: Props) {
  const { month, initialTransactions } = route.params;
  const [segment, setSegment] = useState<OperationsSegment>('expenses');

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: c.background },
      header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
      topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      },
      backText: { color: c.accentDark, fontSize: 16, fontWeight: '600' },
      historyLink: { color: c.accentDark, fontSize: 15, fontWeight: '600' },
      title: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 4 },
      hubHint: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 12 },
      segmentHint: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 12 },
      body: { flex: 1 },
    })
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.backText}>← Главная</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('TransactionHistory', {
                kind: 'expense',
                month,
                initialTransactions,
              })
            }
            hitSlop={8}
          >
            <Text style={styles.historyLink}>История</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Операции</Text>
        <Text style={styles.hubHint}>
          Ручной ввод трат, долгов и подписок
        </Text>

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
