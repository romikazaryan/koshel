import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { DashboardAtmosphereHeader } from '../components/dashboard/DashboardAtmosphereHeader';
import { DashboardOverviewHero } from '../components/dashboard/DashboardOverviewHero';
import { DashboardLinksBar } from '../components/dashboard/DashboardLinksBar';
import { DashboardInsightsSection } from '../components/dashboard/DashboardInsightsSection';
import { useAuth } from '../contexts/AuthContext';
import { hasSupabase, supabase } from '../lib/supabase';
import { getEdgeFunctionErrorMessage } from '../lib/edgeFunctionErrors';
import {
  monthCacheKey,
  readDashboardCache,
  readDashboardCacheSync,
  writeDashboardCache,
} from '../lib/dashboardCache';
import { fetchMonthlyBudget } from '../lib/userSettings';
import { formatMonthGenitive, formatMonthLabel, getMonthRange, getTodayMonth, type MonthRef } from '../lib/month';
import {
  buildMonthAnalysisPayload,
  getAnalysisDateRange,
  analysisPeriodHint,
  parseMonthAnalysisResult,
} from '../lib/monthAnalysisPayload';
import type { AnalysisPeriodMonths } from '../types/monthAnalysis';
import {
  getActiveSubscriptionsForMonth,
  getSubscriptionsTotalForMonth,
  fetchSubscriptions,
} from '../lib/subscriptions';
import {
  getActiveDebtsForMonth,
  getDebtsTotalForMonth,
  fetchDebts,
} from '../lib/debts';
import {
  fetchCapitalAssets,
  fetchCapitalAssetsValued,
  getCapitalTotal,
} from '../lib/capital';
import { formatRecurringExpenseHint } from '../lib/recurringExpenseHint';
import { isEarnedIncome, sumPurchaseRefunds } from '../lib/purchaseRefunds';
import { withTimeout } from '../lib/asyncUtils';
import { Transaction, Category, type Subscription, type Debt, type CapitalAsset } from '../types';
import type { HomeStackParamList, MainTabParamList } from '../navigation/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { FadeSlideIn } from '../components/animations/FadeSlideIn';
import { useBankStatementImport } from '../contexts/BankStatementImportContext';
import { PendingQuickCaptureHandler } from '../components/PendingQuickCaptureHandler';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<HomeStackParamList, 'Dashboard'>;

const calculateHealthScore = (transactions: Transaction[], income: number, balance: number) => {
  let score = 100;
  const essential = transactions.filter((item) => item.category === 'ЖКХ' || item.category === 'Продукты' || item.category === 'Транспорт').reduce((sum, item) => sum + item.amount, 0);
  const fun = transactions.filter((item) => item.category === 'Развлечения').reduce((sum, item) => sum + item.amount, 0);
  const average = transactions.reduce((sum, item) => sum + item.amount, 0) / Math.max(transactions.length, 1);
  const largeSpontaneous = transactions.filter((item) => item.category === 'Развлечения' && item.amount > average * 0.3).length;

  if (essential > income * 0.5) score -= 20;
  if (fun > income * 0.2) score -= 20;
  if (balance <= 0) score -= 30;
  score -= largeSpontaneous * 10;
  return Math.max(0, score);
};

export function DashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { openManualImport, setOnImportedListener } = useBankStatementImport();
  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      safeArea: {
        flex: 1,
        backgroundColor: c.background,
      },
      container: {
        flex: 1,
      },
      contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 32,
      },
      analyzeOverlay: {
        flex: 1,
        backgroundColor: c.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      },
      analyzeOverlayCard: {
        backgroundColor: c.surface,
        borderRadius: 20,
        paddingVertical: 28,
        paddingHorizontal: 32,
        alignItems: 'center',
        minWidth: 260,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      analyzeOverlayTitle: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '700',
        color: c.text,
      },
      analyzeOverlayHint: {
        marginTop: 8,
        fontSize: 14,
        color: c.textMuted,
        textAlign: 'center',
      },
    })
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPeriod, setAnalysisPeriod] = useState<AnalysisPeriodMonths>(6);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [capitalAssets, setCapitalAssets] = useState<CapitalAsset[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [isUserRefreshing, setIsUserRefreshing] = useState(false);
  const [showHeavyWidgets, setShowHeavyWidgets] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const loadInFlightRef = useRef(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthRef>(() => getTodayMonth());
  const monthExpenses = useMemo(
    () => transactions.filter((item) => item.kind === 'expense'),
    [transactions]
  );
  const monthIncomes = useMemo(
    () => transactions.filter(isEarnedIncome),
    [transactions]
  );
  const purchaseRefundTotal = useMemo(
    () => sumPurchaseRefunds(transactions),
    [transactions]
  );

  const totalIncome = useMemo(
    () => monthIncomes.reduce((sum, item) => sum + item.amount, 0),
    [monthIncomes]
  );
  const transactionExpenses = useMemo(
    () => monthExpenses.reduce((sum, item) => sum + item.amount, 0),
    [monthExpenses]
  );
  const subscriptionsTotal = useMemo(
    () => getSubscriptionsTotalForMonth(subscriptions, selectedMonth),
    [subscriptions, selectedMonth]
  );
  const debtsTotal = useMemo(
    () => getDebtsTotalForMonth(debts, selectedMonth),
    [debts, selectedMonth]
  );
  const capitalTotal = useMemo(() => getCapitalTotal(capitalAssets), [capitalAssets]);
  const recurringExpenseHint = useMemo(
    () => formatRecurringExpenseHint(subscriptionsTotal, debtsTotal),
    [subscriptionsTotal, debtsTotal]
  );
  const totalExpenses = useMemo(
    () => transactionExpenses - purchaseRefundTotal + subscriptionsTotal + debtsTotal,
    [transactionExpenses, purchaseRefundTotal, subscriptionsTotal, debtsTotal]
  );
  const balance = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);

  const categorySummary = useMemo(() => {
    const grouping = new Map<Category, number>();
    monthExpenses.forEach((item) => {
      const cat = item.category as Category;
      grouping.set(cat, (grouping.get(cat) ?? 0) + item.amount);
    });
    getActiveSubscriptionsForMonth(subscriptions, selectedMonth).forEach((sub) => {
      const cat = sub.category as Category;
      grouping.set(cat, (grouping.get(cat) ?? 0) + sub.amount);
    });
    getActiveDebtsForMonth(debts, selectedMonth).forEach((debt) => {
      grouping.set('Другое', (grouping.get('Другое') ?? 0) + debt.monthlyPayment);
    });
    return Array.from(grouping.entries()).map(([category, amount]) => ({ category, amount }));
  }, [monthExpenses, subscriptions, debts, selectedMonth]);
  const healthScore = useMemo(() => {
    const subAsExpenses: Transaction[] = getActiveSubscriptionsForMonth(
      subscriptions,
      selectedMonth
    ).map((sub) => ({
      id: `sub-${sub.id}`,
      title: sub.name,
      amount: sub.amount,
      category: sub.category,
      date: '',
      kind: 'expense' as const,
    }));
    const debtAsExpenses: Transaction[] = getActiveDebtsForMonth(debts, selectedMonth).map(
      (debt) => ({
        id: `debt-${debt.id}`,
        title: debt.name,
        amount: debt.monthlyPayment,
        category: 'Другое',
        date: '',
        kind: 'expense' as const,
      })
    );
    return calculateHealthScore(
      [...monthExpenses, ...subAsExpenses, ...debtAsExpenses],
      Math.max(totalIncome, 1),
      balance
    );
  }, [monthExpenses, subscriptions, debts, selectedMonth, totalIncome, balance]);

  const mapTransactions = useCallback(
    (rows: Array<Record<string, unknown>>): Transaction[] =>
      rows.map((item) => ({
        id: String(item.id),
        title: String(item.title ?? (item.kind === 'income' ? 'Доход' : 'Расход')),
        amount: Number(item.amount ?? 0),
        category: String(item.category ?? 'Другое'),
        date: String(item.date ?? new Date().toISOString().slice(0, 10)),
        kind: item.kind === 'income' ? 'income' : 'expense',
        note: item.note ? String(item.note) : undefined,
        source: (item.source as Transaction['source']) ?? 'manual',
      })),
    []
  );

  const loadDashboard = useCallback(
    async (options?: { force?: boolean }) => {
      if (!supabase) {
        console.warn('Supabase client is not configured. Transactions will show mock data.');
        return;
      }
      if (!user?.id) return;
      if (loadInFlightRef.current && !options?.force) return;

      const range = getMonthRange(selectedMonth);
      const userId = user.id;

      loadInFlightRef.current = true;
      const safetyTimer = setTimeout(() => {
        loadInFlightRef.current = false;
      }, 18_000);

      let nextTransactions: Transaction[] = [];
      let nextSubscriptions: Subscription[] = [];
      let nextDebts: Debt[] = [];
      let nextCapital: CapitalAsset[] = [];
      let nextBudget: number | null = null;

      try {
        const txPromise = withTimeout(
          supabase
            .from('transactions')
            .select('id,title,amount,category,date,source,kind,note')
            .is('reconciled_with_id', null)
            .gte('date', range.start)
            .lte('date', range.end)
            .order('date', { ascending: false })
            .limit(100),
          15_000,
          'Сервер не ответил вовремя'
        ).then((result) => {
          const { data, error } = result;
          if (error) {
            console.warn('Supabase load error', error.message);
            return;
          }
          if (data) {
            nextTransactions = mapTransactions(data);
            setTransactions(nextTransactions);
          }
        });

        const budgetPromise = fetchMonthlyBudget(userId).then((budget) => {
          nextBudget = budget;
          setMonthlyBudget(budget);
        });

        const subsPromise = fetchSubscriptions().then((rows) => {
          nextSubscriptions = rows;
          setSubscriptions(rows);
        });

        const debtsPromise = fetchDebts().then((rows) => {
          nextDebts = rows;
          setDebts(rows);
        });

        const capitalPromise = fetchCapitalAssets().then((rows) => {
          nextCapital = rows;
          setCapitalAssets(rows);
        });

        await Promise.all([txPromise, budgetPromise, subsPromise, debtsPromise, capitalPromise]);

        // Живые котировки для суммы капитала — в фоне, не блокируем главную.
        void fetchCapitalAssetsValued()
          .then(({ assets }) => {
            setCapitalAssets(assets);
          })
          .catch((error) => {
            console.warn('Capital live refresh failed', error);
          });

        await writeDashboardCache({
          userId,
          monthKey: monthCacheKey(selectedMonth),
          transactions: nextTransactions,
          subscriptions: nextSubscriptions,
          debts: nextDebts,
          capitalAssets: nextCapital,
          monthlyBudget: nextBudget,
          fetchedAt: Date.now(),
        });
        lastFetchAtRef.current = Date.now();
      } catch (err) {
        console.warn('Failed to load dashboard from Supabase', err);
      } finally {
        clearTimeout(safetyTimer);
        hasLoadedOnceRef.current = true;
        loadInFlightRef.current = false;
      }
    },
    [mapTransactions, selectedMonth, user?.id]
  );

  const handlePullRefresh = useCallback(async () => {
    setIsUserRefreshing(true);
    try {
      await loadDashboard({ force: true });
    } finally {
      setIsUserRefreshing(false);
    }
  }, [loadDashboard]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    void (async () => {
      const cached = await readDashboardCache(user.id, selectedMonth);
      if (cancelled) return;

      if (cached) {
        setTransactions(cached.transactions);
        setSubscriptions(cached.subscriptions ?? []);
        setDebts(cached.debts ?? []);
        setCapitalAssets(cached.capitalAssets ?? []);
        setMonthlyBudget(cached.monthlyBudget);
        hasLoadedOnceRef.current = true;
        lastFetchAtRef.current = cached.fetchedAt;
        void loadDashboard();
        return;
      }

      setTransactions([]);
      setCapitalAssets([]);
      setMonthlyBudget(null);
      void loadDashboard();
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, selectedMonth, loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;

      const cached = readDashboardCacheSync(user.id, selectedMonth);
      if (cached && cached.fetchedAt >= lastFetchAtRef.current) {
        setTransactions(cached.transactions);
        setSubscriptions(cached.subscriptions ?? []);
        setDebts(cached.debts ?? []);
        setCapitalAssets(cached.capitalAssets ?? []);
        setMonthlyBudget(cached.monthlyBudget);
        lastFetchAtRef.current = cached.fetchedAt;
        hasLoadedOnceRef.current = true;
      }

      if (!hasLoadedOnceRef.current) return;
      const staleMs = 45_000;
      if (Date.now() - lastFetchAtRef.current < staleMs) return;
      void loadDashboard();
    }, [loadDashboard, selectedMonth, user?.id])
  );

  useEffect(() => {
    setShowHeavyWidgets(false);
    const task = InteractionManager.runAfterInteractions(() => {
      setShowHeavyWidgets(true);
    });
    return () => task.cancel();
  }, [selectedMonth]);

  useEffect(() => {
    setOnImportedListener(() => {
      void loadDashboard({ force: true });
    });
    return () => setOnImportedListener(null);
  }, [loadDashboard, setOnImportedListener]);

  const openHistory = (kind: 'income' | 'expense') => {
    const params = {
      month: selectedMonth,
      initialTransactions: kind === 'income' ? monthIncomes : monthExpenses,
    };
    if (kind === 'expense') {
      navigation.navigate('OperationsHub', params);
      return;
    }
    navigation.navigate('IncomeMain', params);
  };

  const openCapital = () => {
    navigation
      .getParent<BottomTabNavigationProp<MainTabParamList>>()
      ?.navigate('Finances', { screen: 'Capital' });
  };

  const handleAnalyzeMonth = async () => {
    if (!hasSupabase || !supabase) {
      Alert.alert('Ошибка', 'Supabase не настроен.')
      return
    }

    if (totalExpenses <= 0 && totalIncome <= 0 && monthlyBudget == null) {
      Alert.alert(
        'Нет данных за месяц',
        'Добавьте расход или доход, либо задайте лимит трат в профиле — тогда AI сможет сделать анализ.'
      )
      return
    }

    try {
      setIsAnalyzing(true);

      const analysisRange = getAnalysisDateRange(selectedMonth, analysisPeriod);
      const { data: historyRows, error: historyError } = await withTimeout(
        supabase
          .from('transactions')
          .select('id,title,amount,category,date,source,kind,note')
          .is('reconciled_with_id', null)
          .gte('date', analysisRange.start)
          .lte('date', analysisRange.end)
          .order('date', { ascending: false })
          .limit(5000),
        20_000,
        'Не удалось загрузить историю операций'
      );

      if (historyError) {
        Alert.alert('Ошибка', historyError.message || 'Не удалось загрузить операции для анализа.')
        return
      }

      const historyTransactions = mapTransactions(historyRows ?? []);
      const analysisPayload = buildMonthAnalysisPayload({
        transactions: historyTransactions,
        subscriptions,
        debts,
        selectedMonth,
        periodMonths: analysisPeriod,
        monthlyBudget,
        healthScore,
      });

      const { data, error } = await supabase.functions.invoke('analyze-month', {
        body: analysisPayload,
      })

      if (error) {
        const message = await getEdgeFunctionErrorMessage(error, data, 'Не удалось получить анализ месяца.')
        Alert.alert('Ошибка анализа', message)
        return
      }

      const payload = data as {
        ok?: boolean
        analysis?: unknown
        recommendations?: string
        reason?: string
      } | null

      const analysis = parseMonthAnalysisResult(payload?.analysis)

      if (!analysis && !payload?.recommendations?.trim()) {
        const hint =
          payload?.reason === 'empty_recommendations'
            ? 'Сервер не смог сформировать рекомендации. Попробуйте ещё раз.'
            : 'Пустой ответ от сервера.'
        Alert.alert('Ошибка', hint)
        return
      }

      navigation.navigate('Recommendations', {
        analysis: analysis ?? undefined,
        recommendations: payload?.recommendations,
        monthLabel: analysisPayload.periodLabel,
      })
    } catch (e) {
      const message = await getEdgeFunctionErrorMessage(e, null, 'Не удалось получить анализ месяца.')
      Alert.alert('Ошибка анализа', message)
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <PendingQuickCaptureHandler onSaved={() => void loadDashboard({ force: true })} />
      <Modal visible={isAnalyzing} transparent animationType="fade">
        <View style={styles.analyzeOverlay}>
          <View style={styles.analyzeOverlayCard}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.analyzeOverlayTitle}>Анализируем…</Text>
            <Text style={styles.analyzeOverlayHint}>
              {analysisPeriodHint(analysisPeriod)} · обычно 15–40 сек
            </Text>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isUserRefreshing}
            onRefresh={() => void handlePullRefresh()}
            tintColor={colors.accent}
          />
        }
      >
        <FadeSlideIn delay={0} duration={450}>
          <DashboardAtmosphereHeader
            month={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </FadeSlideIn>

        <FadeSlideIn delay={50} duration={450}>
          <DashboardOverviewHero
            balance={balance}
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            recurringExpenseHint={recurringExpenseHint}
            onOpenIncome={() => openHistory('income')}
            onOpenExpenses={() => openHistory('expense')}
          />
        </FadeSlideIn>

        <FadeSlideIn delay={90}>
          <DashboardLinksBar
            capitalTotal={capitalTotal}
            onImportStatement={openManualImport}
            onOpenCapital={openCapital}
            onOpenImports={() => navigation.navigate('StatementImports')}
          />
        </FadeSlideIn>

        <FadeSlideIn delay={100} duration={500}>
          <DashboardInsightsSection
            monthlyBudget={monthlyBudget}
            totalExpenses={totalExpenses}
            healthScore={healthScore}
            categorySummary={categorySummary}
            showChart={showHeavyWidgets}
            monthLabel={formatMonthLabel(selectedMonth)}
            chartSubtitle={`за ${formatMonthGenitive(selectedMonth)}`}
            analysisPeriod={analysisPeriod}
            onPeriodChange={setAnalysisPeriod}
            onAnalyze={() => void handleAnalyzeMonth()}
            analyzing={isAnalyzing}
          />
        </FadeSlideIn>
      </ScrollView>
    </SafeAreaView>
  );
}
