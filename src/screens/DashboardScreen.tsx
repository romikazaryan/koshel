import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { CategoryChart } from '../components/CategoryChart';
import { HealthScoreCard } from '../components/HealthScoreCard';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { MonthlyBudgetCard } from '../components/MonthlyBudgetCard';
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
import { formatMonthLabel, getMonthRange, getTodayMonth, type MonthRef } from '../lib/month';
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
  fetchCapitalAssetsValued,
  getCapitalTotal,
  getActiveCapitalAssets,
} from '../lib/capital';
import { formatRecurringExpenseHint } from '../lib/recurringExpenseHint';
import { withTimeout } from '../lib/asyncUtils';
import { Transaction, Category, type Subscription, type Debt, type CapitalAsset } from '../types';
import type { HomeStackParamList, MainTabParamList } from '../navigation/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { FadeSlideIn } from '../components/animations/FadeSlideIn';
import { KoshelLogo } from '../components/brand/KoshelLogo';
import { LOGO_SIZE } from '../components/brand/koshelLogoStyles';
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
  const styles = useThemedStyles(({ colors: c, cardBase, radii }) =>
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
        paddingTop: 0,
        paddingBottom: 40,
      },
      hero: {
        backgroundColor: c.navy,
        marginHorizontal: -20,
        marginBottom: 20,
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 28,
        borderBottomLeftRadius: radii.xl,
        borderBottomRightRadius: radii.xl,
      },
      heroBrand: {
        marginBottom: 4,
      },
      heroTagline: {
        fontSize: 15,
        color: c.textOnDarkMuted,
        marginBottom: 6,
      },
      heroSub: {
        fontSize: 14,
        color: c.textOnDark,
        opacity: 0.85,
      },
      summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 12,
      },
      summaryCard: {
        flex: 1,
        ...cardBase,
        padding: 18,
        marginBottom: 0,
      },
      summaryCardAccent: {
        backgroundColor: c.accentSoft,
        borderColor: c.accent,
      },
      summaryLabel: {
        color: c.textMuted,
        fontSize: 12,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: '700',
      },
      summaryValue: {
        fontSize: 22,
        fontWeight: '800',
        color: c.text,
      },
      summaryHint: {
        fontSize: 11,
        color: c.textMuted,
        marginTop: 6,
        lineHeight: 14,
      },
      capitalCard: {
        ...cardBase,
        padding: 18,
        marginBottom: 16,
        backgroundColor: c.primarySoft,
        borderColor: c.border,
      },
      capitalValue: {
        fontSize: 24,
        fontWeight: '800',
        color: c.accent,
      },
      budgetHintCard: {
        backgroundColor: c.primarySoft,
        borderRadius: radii.lg,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: c.border,
      },
      budgetHintText: {
        fontSize: 14,
        lineHeight: 20,
        color: c.textSecondary,
      },
      card: {
        ...cardBase,
        padding: 18,
        marginBottom: 16,
      },
      cardTitle: {
        color: c.textMuted,
        fontSize: 12,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: '700',
      },
      budget: {
        fontSize: 38,
        fontWeight: '900',
        color: c.text,
      },
      cardSubtitle: {
        marginTop: 10,
        color: c.textMuted,
        fontSize: 14,
        lineHeight: 20,
      },
      analyzeButton: {
        marginTop: 20,
        backgroundColor: c.accent,
        borderRadius: radii.lg,
        paddingVertical: 18,
        paddingHorizontal: 20,
        shadowColor: c.accent,
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      },
      analyzeButtonText: {
        color: c.textOnAccent,
        fontWeight: '800',
        fontSize: 17,
        marginBottom: 4,
      },
      analyzeButtonHint: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 13,
      },
      analyzeButtonDisabled: {
        opacity: 0.75,
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
    () => transactions.filter((item) => item.kind === 'income'),
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
  const activeCapitalCount = useMemo(
    () => getActiveCapitalAssets(capitalAssets).length,
    [capitalAssets]
  );
  const hasLiveCapital = useMemo(
    () => capitalAssets.some((item) => item.isActive && item.valuationMode === 'market'),
    [capitalAssets]
  );
  const recurringExpenseHint = useMemo(
    () => formatRecurringExpenseHint(subscriptionsTotal, debtsTotal),
    [subscriptionsTotal, debtsTotal]
  );
  const totalExpenses = useMemo(
    () => transactionExpenses + subscriptionsTotal + debtsTotal,
    [transactionExpenses, subscriptionsTotal, debtsTotal]
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

        const capitalPromise = fetchCapitalAssetsValued().then(({ assets }) => {
          nextCapital = assets;
          setCapitalAssets(assets);
        });

        await Promise.all([txPromise, budgetPromise, subsPromise, debtsPromise, capitalPromise]);

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

  const openHistory = (kind: 'income' | 'expense') => {
    navigation.navigate('TransactionHistory', {
      kind,
      month: selectedMonth,
      initialTransactions: kind === 'income' ? monthIncomes : monthExpenses,
    });
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

    const total = totalExpenses
    const expensesByCategory = categorySummary.map((c) => ({
      category: c.category,
      amount: c.amount,
      percent: total > 0 ? Math.round((c.amount / total) * 100) : 0,
    }))

    try {
      setIsAnalyzing(true);
      const { data, error } = await supabase.functions.invoke('analyze-month', {
        body: {
          income: totalIncome,
          totalExpenses: totalExpenses,
          balance,
          healthScore,
          monthlyBudget,
          expensesByCategory,
        },
      })

      if (error) {
        const message = await getEdgeFunctionErrorMessage(error, data, 'Не удалось получить анализ месяца.')
        Alert.alert('Ошибка анализа', message)
        return
      }

      const payload = data as { ok?: boolean; recommendations?: string; reason?: string } | null
      const recommendations = payload?.recommendations
      if (!recommendations?.trim()) {
        const hint =
          payload?.reason === 'empty_recommendations'
            ? 'Сервер не смог сформировать текст. Попробуйте ещё раз.'
            : 'Пустые рекомендации от сервера.'
        Alert.alert('Ошибка', hint)
        return
      }

      navigation.navigate('Recommendations', { recommendations })
    } catch (e) {
      const message = await getEdgeFunctionErrorMessage(e, null, 'Не удалось получить анализ месяца.')
      Alert.alert('Ошибка анализа', message)
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Modal visible={isAnalyzing} transparent animationType="fade">
        <View style={styles.analyzeOverlay}>
          <View style={styles.analyzeOverlayCard}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.analyzeOverlayTitle}>Анализируем…</Text>
            <Text style={styles.analyzeOverlayHint}>Обычно 10–30 секунд</Text>
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
          <View style={styles.hero}>
            <KoshelLogo size={LOGO_SIZE.dashboard} color={colors.accent} style={styles.heroBrand} />
            <Text style={styles.heroTagline}>Ваши деньги под контролем</Text>
            <Text style={styles.heroSub}>Обзор за {formatMonthLabel(selectedMonth).toLowerCase()}</Text>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={60}>
          <MonthSwitcher value={selectedMonth} onChange={setSelectedMonth} />
        </FadeSlideIn>

      <FadeSlideIn delay={100}>
        <View style={styles.summaryRow}>
          <TouchableOpacity
            style={styles.summaryCard}
            onPress={() => openHistory('income')}
            activeOpacity={0.85}
          >
            <Text style={styles.summaryLabel}>Доход</Text>
            <Text style={styles.summaryValue}>₽{totalIncome.toLocaleString('ru-RU')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.summaryCard, styles.summaryCardAccent]}
            onPress={() => openHistory('expense')}
            activeOpacity={0.85}
          >
            <Text style={styles.summaryLabel}>Расходы</Text>
            <Text style={styles.summaryValue}>₽{totalExpenses.toLocaleString('ru-RU')}</Text>
            {recurringExpenseHint ? (
              <Text style={styles.summaryHint}>{recurringExpenseHint}</Text>
            ) : null}
          </TouchableOpacity>
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={120}>
        <TouchableOpacity style={styles.capitalCard} onPress={openCapital} activeOpacity={0.85}>
          <Text style={styles.summaryLabel}>Капитал</Text>
          <Text style={styles.capitalValue}>₽{capitalTotal.toLocaleString('ru-RU')}</Text>
          <Text style={styles.summaryHint}>
            {activeCapitalCount > 0
              ? `${activeCapitalCount} активов${hasLiveCapital ? ' · курсы обновлены' : ''} · не в расходах`
              : 'Крипта, валюта, вклады — добавьте в профиле'}
          </Text>
        </TouchableOpacity>
      </FadeSlideIn>

      {monthlyBudget != null ? (
        <MonthlyBudgetCard monthlyBudget={monthlyBudget} totalExpenses={totalExpenses} />
      ) : (
        <View style={styles.budgetHintCard}>
          <Text style={styles.budgetHintText}>
            Задайте лимит трат в разделе «Профиль» — на главной появится прогресс по расходам.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Баланс месяца</Text>
        <Text style={styles.budget}>₽{balance.toLocaleString('ru-RU')}</Text>
        <Text style={styles.cardSubtitle}>
          {totalIncome > 0
            ? `Доходы минус расходы за ${formatMonthLabel(selectedMonth).toLowerCase()}`
            : 'Добавьте доход на вкладке «Добавить»'}
        </Text>
      </View>

      <HealthScoreCard score={healthScore} />
      {showHeavyWidgets ? (
        <FadeSlideIn delay={180} duration={500}>
          <CategoryChart data={categorySummary} />
        </FadeSlideIn>
      ) : null}

      <TouchableOpacity
        style={[styles.analyzeButton, isAnalyzing && styles.analyzeButtonDisabled]}
        onPress={() => void handleAnalyzeMonth()}
        disabled={isAnalyzing}
      >
        <Text style={styles.analyzeButtonText}>
          {isAnalyzing ? 'Анализируем…' : 'Анализ месяца с AI'}
        </Text>
        <Text style={styles.analyzeButtonHint}>
          {isAnalyzing ? 'Подождите немного' : 'Рекомендации по вашим тратам'}
        </Text>
      </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
