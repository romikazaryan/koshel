import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { DateCarouselPicker } from '../components/DateCarouselPicker';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { TransactionList } from '../components/TransactionList';
import { deleteTransaction, fetchTransactionsForMonth } from '../lib/transactions';
import { filterIncomeForDisplay } from '../lib/purchaseRefunds';
import {
  monthCacheKey,
  readDashboardCache,
  removeTransactionFromDashboardCache,
} from '../lib/dashboardCache';
import { formatTransactionSaveError } from '../lib/apiErrors';
import {
  filterTransactionsByDate,
  formatHistoryDayLabel,
  sumTransactions,
} from '../lib/transactionGrouping';
import { formatMonthLabel, getMonthDatesDescending } from '../lib/month';
import type { HomeStackParamList } from '../navigation/types';
import { hasSupabase } from '../lib/supabase';
import type { Transaction } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<HomeStackParamList, 'TransactionHistory'>;

const TITLES = {
  income: 'История доходов',
  expense: 'История расходов',
} as const;

export function TransactionHistoryScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { kind, month: initialMonth, initialTransactions } = route.params;
  const { colors } = useAppTheme();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions ?? []);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isUserRefreshing, setIsUserRefreshing] = useState(false);
  const deleteInFlightRef = useRef<string | null>(null);
  const monthKeyRef = useRef(monthCacheKey(initialMonth));

  const styles = useThemedStyles(({ colors: c, cardBase }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      scroll: { flex: 1 },
      content: { paddingHorizontal: 20, paddingBottom: 40 },
      backButton: { marginBottom: 8 },
      backText: { color: c.accentDark, fontSize: 16, fontWeight: '600' },
      title: { fontSize: 26, fontWeight: '800', color: c.text, marginBottom: 4 },
      subtitle: { fontSize: 14, color: c.textMuted, marginBottom: 16 },
      totalCard: {
        backgroundColor: c.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.borderLight,
        padding: 16,
        marginBottom: 16,
      },
      totalLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
      },
      totalValue: { fontSize: 28, fontWeight: '800', color: c.text },
      dayCard: {
        ...cardBase,
        padding: 16,
        marginBottom: 14,
        borderLeftWidth: 3,
      },
      dayCardIncome: {
        borderLeftColor: c.income,
      },
      dayCardExpense: {
        borderLeftColor: c.expense,
      },
      dayLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: c.textMuted,
        marginBottom: 4,
        textTransform: 'capitalize',
      },
      dayTotal: {
        fontSize: 26,
        fontWeight: '800',
      },
      dayTotalIncome: {
        color: c.incomeDark,
      },
      dayTotalExpense: {
        color: c.expenseDark,
      },
    })
  );

  const monthDates = useMemo(() => getMonthDatesDescending(selectedMonth), [selectedMonth]);

  const displayTransactions = useMemo(
    () => (kind === 'income' ? filterIncomeForDisplay(transactions) : transactions),
    [kind, transactions]
  );

  const dayTransactions = useMemo(() => {
    if (!selectedDate) return [];
    return filterTransactionsByDate(displayTransactions, selectedDate);
  }, [displayTransactions, selectedDate]);

  const monthTotal = useMemo(() => sumTransactions(displayTransactions), [displayTransactions]);
  const dayTotal = useMemo(() => sumTransactions(dayTransactions), [dayTransactions]);

  useEffect(() => {
    if (monthDates.length === 0) {
      setSelectedDate(null);
      return;
    }
    if (!selectedDate || !monthDates.includes(selectedDate)) {
      setSelectedDate(monthDates[0]);
    }
  }, [monthDates, selectedDate]);

  const load = useCallback(
    async (options?: { background?: boolean }) => {
      if (!hasSupabase) return;

      const monthKey = monthCacheKey(selectedMonth);

      if (user?.id && !options?.background) {
        const cached = await readDashboardCache(user.id, selectedMonth);
        if (cached && monthCacheKey(selectedMonth) === monthKey) {
          const filtered = cached.transactions.filter((item) => item.kind === kind);
          setTransactions(kind === 'income' ? filterIncomeForDisplay(filtered) : filtered);
        }
      }

      try {
        const rows = await fetchTransactionsForMonth(selectedMonth, kind);
        setTransactions(kind === 'income' ? filterIncomeForDisplay(rows) : rows);
      } catch (error) {
        console.warn('TransactionHistory load failed', error);
      }
    },
    [kind, selectedMonth, user?.id]
  );

  const handlePullRefresh = useCallback(async () => {
    setIsUserRefreshing(true);
    try {
      await load({ background: true });
    } finally {
      setIsUserRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    const monthKey = monthCacheKey(selectedMonth);
    const monthChanged = monthKeyRef.current !== monthKey;
    monthKeyRef.current = monthKey;

    if (monthChanged) {
      setSelectedDate(null);
    }

    void load({ background: !monthChanged });
  }, [selectedMonth, kind, load]);

  useFocusEffect(
    useCallback(() => {
      void load({ background: true });
    }, [load])
  );

  const editTransaction = (transaction: Transaction) => {
    navigation.navigate('EditTransaction', { transaction });
  };

  const removeTransaction = (id: string) => {
    if (deleteInFlightRef.current === id) return;

    const snapshot = transactions;
    setTransactions((prev) => prev.filter((item) => item.id !== id));
    deleteInFlightRef.current = id;

    void (async () => {
      try {
        await deleteTransaction(id);
        if (user?.id) {
          await removeTransactionFromDashboardCache(user.id, id, selectedMonth);
        }
      } catch (error) {
        setTransactions(snapshot);
        Alert.alert(
          'Не удалось удалить',
          formatTransactionSaveError(error, 'Проверьте интернет и попробуйте ещё раз.')
        );
      } finally {
        deleteInFlightRef.current = null;
      }
    })();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isUserRefreshing}
            onRefresh={() => void handlePullRefresh()}
            tintColor={colors.accent}
          />
        }
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{TITLES[kind]}</Text>
        <Text style={styles.subtitle}>{formatMonthLabel(selectedMonth)}</Text>

        <MonthSwitcher value={selectedMonth} onChange={setSelectedMonth} />

        {monthDates.length > 0 && selectedDate ? (
          <DateCarouselPicker
            dates={monthDates}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        ) : null}

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>
            {kind === 'income' ? 'Всего доходов за месяц' : 'Всего расходов за месяц'}
          </Text>
          <Text style={styles.totalValue}>₽{monthTotal.toLocaleString('ru-RU')}</Text>
        </View>

        {monthDates.length > 0 && selectedDate ? (
          <View
            style={[
              styles.dayCard,
              kind === 'income' ? styles.dayCardIncome : styles.dayCardExpense,
            ]}
          >
            <Text style={styles.dayLabel}>{formatHistoryDayLabel(selectedDate)}</Text>
            <Text
              style={[
                styles.dayTotal,
                kind === 'income' ? styles.dayTotalIncome : styles.dayTotalExpense,
              ]}
            >
              ₽{dayTotal.toLocaleString('ru-RU')}
            </Text>
          </View>
        ) : null}

        {monthDates.length > 0 && selectedDate ? (
          <TransactionList
            transactions={dayTransactions}
            kind={kind}
            showHeading={false}
            emptyTitle={
              kind === 'income' ? 'В этот день доходов не было' : 'В этот день расходов не было'
            }
            emptyHint=""
            onEdit={editTransaction}
            onRemove={removeTransaction}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
