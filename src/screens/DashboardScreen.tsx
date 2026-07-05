import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  InteractionManager,
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { DashboardAtmosphereHeader } from '../components/dashboard/DashboardAtmosphereHeader';
import { DashboardEmptyHint } from '../components/dashboard/DashboardEmptyHint';
import { DashboardOverviewHero } from '../components/dashboard/DashboardOverviewHero';
import { DashboardLinksBar } from '../components/dashboard/DashboardLinksBar';
import { DashboardInsightsSection } from '../components/dashboard/DashboardInsightsSection';
import { AnalyzeMonthOverlay } from '../components/dashboard/AnalyzeMonthOverlay';
import { useAuth } from '../contexts/AuthContext';
import { hasSupabase, supabase } from '../lib/supabase';
import { getEdgeFunctionErrorMessage } from '../lib/edgeFunctionErrors';
import {
  monthCacheKey,
  invalidateDashboardCache,
  readDashboardCache,
  readDashboardCacheSync,
  writeDashboardCache,
} from '../lib/dashboardCache';
import { refreshSessionOnce } from '../lib/authSession';
import { withNetworkRetries } from '../lib/asyncUtils';
import {
  buildMonthAnalysisPayload,
  getAnalysisDateRange,
  analysisPeriodHint,
  parseMonthAnalysisResult,
} from '../lib/monthAnalysisPayload';
import { fetchMonthlyBudget } from '../lib/userSettings';
import { formatMonthGenitive, formatMonthLabel, getMonthRange, getTodayMonth, type MonthRef } from '../lib/month';
import {
  getSubscriptionsTotalForMonth,
  fetchSubscriptions,
} from '../lib/subscriptions';
import {
  getDebtsTotalForMonth,
  fetchDebts,
} from '../lib/debts';
import {
  fetchCapitalAssets,
  fetchCapitalAssetsValued,
  getCapitalTotal,
} from '../lib/capital';
import { formatRecurringExpenseHint } from '../lib/recurringExpenseHint';
import { consumeFirstExpensePrompt } from '../lib/onboarding';
import { exportMonthReportPdf } from '../lib/exportMonthReport';
import type { AnalysisPeriodMonths } from '../types/monthAnalysis';
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

export function DashboardScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { openManualImport, setOnImportedListener } = useBankStatementImport();

  useEffect(() => {
    if (route.params?.openImport) {
      openManualImport();
      navigation.setParams({ openImport: undefined });
    }
  }, [route.params?.openImport, openManualImport, navigation]);
  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
      },
      container: {
        flex: 1,
      },
      contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 32,
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
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [isDashboardReady, setIsDashboardReady] = useState(false);
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
  // Подписки и долги — это план обязательных платежей, а не фактические траты.
  // Фактические расходы = только реальные операции (совпадает с экраном истории),
  // иначе при импорте выписки подписка считалась бы дважды.
  const recurringExpenseHint = useMemo(
    () => formatRecurringExpenseHint(subscriptionsTotal, debtsTotal),
    [subscriptionsTotal, debtsTotal]
  );
  const totalExpenses = useMemo(
    () => transactionExpenses - purchaseRefundTotal,
    [transactionExpenses, purchaseRefundTotal]
  );
  const balance = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);

  const categorySummary = useMemo(() => {
    const grouping = new Map<Category, number>();
    monthExpenses.forEach((item) => {
      const cat = item.category as Category;
      grouping.set(cat, (grouping.get(cat) ?? 0) + item.amount);
    });
    return Array.from(grouping.entries()).map(([category, amount]) => ({ category, amount }));
  }, [monthExpenses]);
  const healthScore = useMemo(() => {
    return calculateHealthScore(monthExpenses, Math.max(totalIncome, 1), balance);
  }, [monthExpenses, totalIncome, balance]);

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

      const client = supabase;
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
      let transactionsLoaded = false;

      try {
        const txPromise = withNetworkRetries(
          async () => {
            const result = await withTimeout(
              client
                .from('transactions')
                .select('id,title,amount,category,date,source,kind,note')
                .is('reconciled_with_id', null)
                .gte('date', range.start)
                .lte('date', range.end)
                .order('date', { ascending: false })
                .limit(100),
              15_000,
              'Сервер не ответил вовремя'
            );
            if (result.error) throw result.error;
            return result.data ?? [];
          },
          {
            attempts: 4,
            baseDelayMs: 280,
            onAuthRetry: refreshSessionOnce,
          }
        ).then((data) => {
          transactionsLoaded = true;
          nextTransactions = mapTransactions(data);
          setTransactions(nextTransactions);
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

        // Не кэшируем пустой дашборд при сбое сети — иначе нули «залипают» до переустановки.
        if (!transactionsLoaded) {
          console.warn('Dashboard transactions not loaded — cache skipped');
          return;
        }

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
        setIsDashboardReady(true);
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
      setIsDashboardReady(false);
      const cached = await readDashboardCache(user.id, selectedMonth);
      if (cancelled) return;

      if (cached) {
        setTransactions(cached.transactions);
        setSubscriptions(cached.subscriptions ?? []);
        setDebts(cached.debts ?? []);
        setCapitalAssets(cached.capitalAssets ?? []);
        setMonthlyBudget(cached.monthlyBudget);
        hasLoadedOnceRef.current = true;
        setIsDashboardReady(true);
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

  useFocusEffect(
    useCallback(() => {
      if (!isDashboardReady) return;
      void consumeFirstExpensePrompt(user?.id).then((shouldOpen) => {
        if (!shouldOpen) return;
        navigation.navigate('OperationsHub', {
          month: selectedMonth,
          initialTransactions: monthExpenses,
          firstExpenseCue: true,
        });
      });
    }, [isDashboardReady, user?.id, navigation, selectedMonth, monthExpenses])
  );

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

  const handleExportReport = async () => {
    if (transactions.length === 0 && totalIncome <= 0 && totalExpenses <= 0) {
      Alert.alert('Нет данных', 'Добавьте операции за месяц — тогда можно сформировать PDF-сводку.');
      return;
    }
    setIsExportingReport(true);
    try {
      const result = await exportMonthReportPdf({
        monthLabel: formatMonthLabel(selectedMonth),
        income: totalIncome,
        expenses: totalExpenses,
        balance,
        monthlyBudget,
        transactions,
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
      setIsExportingReport(false);
    }
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
      <AnalyzeMonthOverlay
        visible={isAnalyzing}
        hint={`${analysisPeriodHint(analysisPeriod)} · обычно 15–40 сек`}
      />

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
            onExportReport={() => void handleExportReport()}
            isExportingReport={isExportingReport}
          />
        </FadeSlideIn>

        {isDashboardReady && transactions.length === 0 ? (
          <FadeSlideIn delay={95}>
            <DashboardEmptyHint
              onAddExpense={() => openHistory('expense')}
              onAddIncome={() => openHistory('income')}
            />
          </FadeSlideIn>
        ) : null}

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
