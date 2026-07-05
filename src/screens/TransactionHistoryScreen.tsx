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
import { Input } from '../components/ui/Input';
import { HorizontalChipCarousel } from '../components/ui/HorizontalChipCarousel';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { deleteTransaction, fetchTransactionsForMonth } from '../lib/transactions';
import { filterIncomeForDisplay } from '../lib/purchaseRefunds';
import { formatMoney } from '../lib/formatMoney';
import { exportTransactionsCsv } from '../lib/exportTransactions';
import { exportMonthReportPdf } from '../lib/exportMonthReport';
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
import { Ionicons } from '@expo/vector-icons';
import { moneyText, spacing, typography } from '../theme/layout';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const deleteInFlightRef = useRef<string | null>(null);
  const monthKeyRef = useRef(monthCacheKey(initialMonth));

  const styles = useThemedStyles(({ colors: c, cardBase, radii, shadows }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      scroll: { flex: 1 },
      content: { paddingHorizontal: spacing.xl, paddingBottom: 48 },
      exportActions: { flexDirection: 'row', gap: 6 },
      exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: c.borderLight,
        backgroundColor: c.surface,
        ...shadows.soft,
      },
      exportBtnDisabled: { opacity: 0.5 },
      exportBtnText: { ...typography.caption, color: c.text, fontWeight: '700', fontSize: 12 },
      searchInput: { marginBottom: spacing.md },
      totalCard: {
        ...cardBase,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderLeftWidth: 4,
      },
      totalCardIncome: { borderLeftColor: c.income },
      totalCardExpense: { borderLeftColor: c.expense },
      totalLabel: {
        ...typography.overline,
        color: c.textMuted,
        letterSpacing: 0.8,
        marginBottom: spacing.sm,
      },
      totalValue: {
        fontSize: 32,
        fontWeight: '900',
        color: c.text,
        letterSpacing: -0.8,
        ...moneyText,
      },
      totalValueIncome: { color: c.incomeDark },
      totalValueExpense: { color: c.expenseDark },
      dayCard: {
        ...cardBase,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderLeftWidth: 4,
      },
      dayCardIncome: {
        borderLeftColor: c.income,
      },
      dayCardExpense: {
        borderLeftColor: c.expense,
      },
      dayLabel: {
        ...typography.meta,
        color: c.textMuted,
        marginBottom: 4,
        textTransform: 'capitalize',
        fontWeight: '600',
      },
      dayTotal: {
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -0.5,
        ...moneyText,
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

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    displayTransactions.forEach((item) => {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return [
      { value: 'all', label: 'Все', count: displayTransactions.length },
      ...sorted.map(([category, count]) => ({ value: category, label: category, count })),
    ];
  }, [displayTransactions]);

  const isFiltering = searchQuery.trim().length > 0 || categoryFilter !== 'all';

  const filteredTransactions = useMemo(() => {
    if (!isFiltering) return [];
    const query = searchQuery.trim().toLowerCase();
    return displayTransactions
      .filter((item) => {
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (!query) return true;
        const haystack = `${item.title} ${item.category} ${item.note ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [displayTransactions, isFiltering, searchQuery, categoryFilter]);

  const filteredTotal = useMemo(() => sumTransactions(filteredTransactions), [filteredTransactions]);

  useEffect(() => {
    if (categoryFilter !== 'all' && !categoryOptions.some((o) => o.value === categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [categoryOptions, categoryFilter]);

  const handleExport = useCallback(async () => {
    const data = isFiltering ? filteredTransactions : displayTransactions;
    if (data.length === 0) {
      Alert.alert('Нечего экспортировать', 'За выбранный период нет операций.');
      return;
    }
    setIsExporting(true);
    try {
      const kindPart = kind === 'income' ? 'dohody' : 'rashody';
      const result = await exportTransactionsCsv(
        data,
        `koshel-${kindPart}-${monthCacheKey(selectedMonth)}`
      );
      if (result === 'unavailable') {
        Alert.alert('Недоступно', 'Поделиться файлом нельзя на этом устройстве.');
      }
    } catch (error) {
      Alert.alert(
        'Ошибка экспорта',
        error instanceof Error ? error.message : 'Не удалось создать файл.'
      );
    } finally {
      setIsExporting(false);
    }
  }, [isFiltering, filteredTransactions, displayTransactions, kind, selectedMonth]);

  const handleExportPdf = useCallback(async () => {
    if (kind !== 'expense') return;
    setIsExportingPdf(true);
    try {
      const allRows = await fetchTransactionsForMonth(selectedMonth);
      const income = allRows
        .filter((row) => row.kind === 'income')
        .reduce((sum, row) => sum + row.amount, 0);
      const expenses = allRows
        .filter((row) => row.kind === 'expense')
        .reduce((sum, row) => sum + row.amount, 0);
      const result = await exportMonthReportPdf({
        monthLabel: formatMonthLabel(selectedMonth),
        income,
        expenses,
        balance: income - expenses,
        monthlyBudget: null,
        transactions: allRows,
      });
      if (result === 'unavailable') {
        Alert.alert('Недоступно', 'Поделиться PDF на этом устройстве нельзя.');
      }
    } catch (error) {
      Alert.alert(
        'Ошибка отчёта',
        error instanceof Error ? error.message : 'Не удалось создать PDF.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  }, [kind, selectedMonth]);

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
        <ScreenHeader
          onBack={() => navigation.goBack()}
          title={TITLES[kind]}
          subtitle={formatMonthLabel(selectedMonth)}
          rightAction={
            <View style={styles.exportActions}>
              {kind === 'expense' ? (
                <TouchableOpacity
                  style={[styles.exportBtn, isExportingPdf && styles.exportBtnDisabled]}
                  onPress={() => void handleExportPdf()}
                  disabled={isExportingPdf || isExporting}
                  accessibilityRole="button"
                  accessibilityLabel="PDF-сводка месяца"
                >
                  <Ionicons name="document-outline" size={15} color={colors.accentDark} />
                  <Text style={styles.exportBtnText}>{isExportingPdf ? '…' : 'PDF'}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.exportBtn, isExporting && styles.exportBtnDisabled]}
                onPress={() => void handleExport()}
                disabled={isExporting || isExportingPdf}
                accessibilityRole="button"
                accessibilityLabel="Экспортировать операции в CSV"
              >
                <Ionicons name="share-outline" size={15} color={colors.accentDark} />
                <Text style={styles.exportBtnText}>{isExporting ? '…' : 'CSV'}</Text>
              </TouchableOpacity>
            </View>
          }
        />

        <MonthSwitcher value={selectedMonth} onChange={setSelectedMonth} />

        <Input
          containerStyle={styles.searchInput}
          placeholder="Поиск по названию или категории"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        <HorizontalChipCarousel
          options={categoryOptions}
          value={categoryFilter}
          onChange={setCategoryFilter}
        />

        {isFiltering ? (
          <>
            <View
              style={[
                styles.totalCard,
                kind === 'income' ? styles.totalCardIncome : styles.totalCardExpense,
              ]}
            >
              <Text style={styles.totalLabel}>Найдено · {filteredTransactions.length}</Text>
              <Text
                style={[
                  styles.totalValue,
                  kind === 'income' ? styles.totalValueIncome : styles.totalValueExpense,
                ]}
              >
                {formatMoney(filteredTotal)}
              </Text>
            </View>

            <TransactionList
              transactions={filteredTransactions}
              kind={kind}
              showHeading={false}
              emptyTitle="Ничего не найдено"
              emptyHint="Измените запрос или категорию"
              onEdit={editTransaction}
              onRemove={removeTransaction}
            />
          </>
        ) : (
          <>
            {monthDates.length > 0 && selectedDate ? (
              <DateCarouselPicker
                dates={monthDates}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            ) : null}

            <View
              style={[
                styles.totalCard,
                kind === 'income' ? styles.totalCardIncome : styles.totalCardExpense,
              ]}
            >
              <Text style={styles.totalLabel}>
                {kind === 'income' ? 'Всего доходов за месяц' : 'Всего расходов за месяц'}
              </Text>
              <Text
                style={[
                  styles.totalValue,
                  kind === 'income' ? styles.totalValueIncome : styles.totalValueExpense,
                ]}
              >
                {formatMoney(monthTotal)}
              </Text>
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
                  {formatMoney(dayTotal)}
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
