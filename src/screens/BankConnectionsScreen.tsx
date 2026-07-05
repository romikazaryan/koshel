import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SectionLabel } from '../components/ui/SectionLabel';
import { NavyHeroBlock } from '../components/ui/NavyHeroBlock';
import {
  fetchFinancialAccounts,
  fetchFinancialConnections,
  requestTInvestSync,
  revokeFinancialConnection,
} from '../lib/financialConnections';
import type { MainTabParamList, ProfileStackParamList } from '../navigation/types';
import { useAppTheme } from '../contexts/ThemeContext';
import { heroOnDark } from '../theme/premium';
import { spacing } from '../theme/layout';
import { NavyShimmerPressable } from '../components/ui/NavyShimmerBackground';
import { useThemedStyles } from '../theme/useThemedStyles';
import {
  CONNECTION_STATUS_LABELS,
  FINANCIAL_PROVIDERS,
  getProviderDefinition,
  PROVIDER_KIND_LABELS,
  type FinancialConnection,
  type FinancialProviderKind,
  type FinancialAccount,
} from '../types/financialConnections';

type Props = NativeStackScreenProps<ProfileStackParamList, 'BankConnections'>;

export function BankConnectionsScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const [segment, setSegment] = useState<FinancialProviderKind>('bank');
  const [connections, setConnections] = useState<FinancialConnection[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const styles = useThemedStyles(({ colors: c, radii, shadows, cardBase }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      content: { paddingBottom: spacing.xl },
      scrollBody: { paddingHorizontal: spacing.xl },
      heroInner: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
      },
      heroText: {
        fontSize: 14,
        lineHeight: 21,
        color: heroOnDark.subtitle,
      },
      segmentWrap: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
      },
      providerCard: {
        ...cardBase,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      providerName: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 4 },
      providerDesc: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 12 },
      badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
        backgroundColor: c.backgroundDeep,
        marginBottom: 12,
      },
      badgeText: { fontSize: 12, fontWeight: '600', color: c.textMuted },
      actionBtn: {
        borderRadius: radii.md,
        paddingVertical: 12,
        alignItems: 'center',
      },
      actionBtnSecondary: {
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      },
      actionBtnDisabled: {
        backgroundColor: c.backgroundDeep,
        opacity: 0.6,
      },
      actionBtnText: { color: c.textOnAccent, fontWeight: '700', fontSize: 15 },
      actionBtnTextSecondary: { color: c.text, fontWeight: '700', fontSize: 15 },
      connectionCard: {
        ...cardBase,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      connectionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      },
      connectionName: { fontSize: 16, fontWeight: '700', color: c.text, flex: 1 },
      statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        backgroundColor: c.incomeSoft,
      },
      statusText: { fontSize: 12, fontWeight: '600', color: c.incomeDark },
      meta: { fontSize: 13, color: c.textMuted, marginBottom: 12 },
      rowActions: { flexDirection: 'row', gap: 10 },
      rowAction: { flex: 1 },
      empty: {
        ...cardBase,
        padding: 20,
        alignItems: 'center',
      },
      emptyText: { color: c.textMuted, textAlign: 'center', lineHeight: 20 },
      legal: {
        marginTop: 16,
        padding: 14,
        borderRadius: radii.md,
        backgroundColor: c.surfaceMuted,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      legalText: { fontSize: 13, lineHeight: 19, color: c.textMuted },
    })
  );

  const load = useCallback(async () => {
    const [conn, acc] = await Promise.all([fetchFinancialConnections(), fetchFinancialAccounts()]);
    setConnections(conn.filter((c) => c.status !== 'revoked'));
    setAccounts(acc);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const providers = FINANCIAL_PROVIDERS.filter((p) => p.kind === segment);
  const activeConnections = connections.filter((c) => c.providerKind === segment);

  const openStatementImport = () => {
    navigation
      .getParent<BottomTabNavigationProp<MainTabParamList>>()
      ?.navigate('Home', { screen: 'Dashboard', params: { openImport: true } });
  };

  const handleConnectProvider = (providerId: string) => {
    if (providerId === 'tinkoff_invest') {
      navigation.navigate('TinvestConnect');
      return;
    }
    openStatementImport();
  };

  const handleSync = async (connection: FinancialConnection) => {
    setBusyId(connection.id);
    try {
      const result = await requestTInvestSync(connection.id);
      Alert.alert(result.ok ? 'Синхронизация' : 'Ошибка', result.message);
      if (result.ok) await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = (connection: FinancialConnection) => {
    Alert.alert(
      'Отключить?',
      'Подключение будет удалено вместе с импортированными акциями и связанными операциями брокера.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отключить',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(connection.id);
              try {
                const result = await revokeFinancialConnection(connection.id);
                if (!result.ok) {
                  Alert.alert('Ошибка', result.message);
                  return;
                }
                Alert.alert('Отключено', result.message);
                await load();
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        backLabel="Профиль"
        title="Подключения"
        subtitle="Банки, брокеры и синхронизация"
      />

      <NavyHeroBlock>
        <View style={styles.heroInner}>
          <Text style={styles.heroText}>
            T-Invest — через read-only токен. Выписки банков — с главной. Автосинхронизация
            дебетовых карт — после Open Finance с T‑Банком.
          </Text>
        </View>
      </NavyHeroBlock>

      <View style={styles.segmentWrap}>
        <SegmentedControl<FinancialProviderKind>
          options={(
            ['bank', 'broker', 'crypto'] as FinancialProviderKind[]
          ).map((value) => ({
            value,
            label: PROVIDER_KIND_LABELS[value],
          }))}
          value={segment}
          onChange={setSegment}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
        }
      >
        <View style={styles.scrollBody}>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <>
            {activeConnections.length > 0 ? (
              <>
                <SectionLabel>Подключено</SectionLabel>
                {activeConnections.map((conn) => {
                  const def = getProviderDefinition(conn.providerId);
                  const linkedAccounts = accounts.filter((a) => a.connectionId === conn.id);
                  return (
                    <View key={conn.id} style={styles.connectionCard}>
                      <View style={styles.connectionRow}>
                        <Text style={styles.connectionName}>
                          {conn.displayName ?? def?.name ?? conn.providerId}
                        </Text>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusText}>
                            {CONNECTION_STATUS_LABELS[conn.status]}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.meta}>
                        {linkedAccounts.length > 0
                          ? `Счетов: ${linkedAccounts.length}`
                          : 'Счета появятся после синхронизации'}
                        {conn.lastSyncAt
                          ? ` · синк ${new Date(conn.lastSyncAt).toLocaleString('ru-RU')}`
                          : ''}
                      </Text>
                      <View style={styles.rowActions}>
                        {conn.providerId === 'tinkoff_invest' ? (
                          <NavyShimmerPressable
                            style={[styles.actionBtn, styles.rowAction]}
                            contentStyle={{ alignItems: 'center' }}
                            onPress={() => void handleSync(conn)}
                            disabled={busyId === conn.id}
                            glow="compact"
                          >
                            <Text style={styles.actionBtnText}>
                              {busyId === conn.id ? '…' : 'Обновить'}
                            </Text>
                          </NavyShimmerPressable>
                        ) : null}
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionBtnSecondary, styles.rowAction]}
                          onPress={() => handleRevoke(conn)}
                          disabled={busyId === conn.id}
                        >
                          <Text style={styles.actionBtnTextSecondary}>Отключить</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}

            <SectionLabel>Доступные провайдеры</SectionLabel>
            {providers.map((provider) => (
              <View key={provider.id} style={styles.providerCard}>
                <Text style={styles.providerName}>{provider.name}</Text>
                <Text style={styles.providerDesc}>{provider.description}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {provider.statementImport
                      ? 'Выписка CSV/PDF'
                      : provider.availability === 'coming_soon'
                        ? 'Скоро · Open Finance'
                        : 'Доступно'}
                  </Text>
                </View>
                {provider.id === 'tinkoff_invest' || provider.statementImport ? (
                  <NavyShimmerPressable
                    style={styles.actionBtn}
                    contentStyle={{ alignItems: 'center' }}
                    onPress={() => handleConnectProvider(provider.id)}
                    disabled={provider.id !== 'tinkoff_invest' && !provider.statementImport}
                    glow="compact"
                  >
                    <Text style={styles.actionBtnText}>
                      {provider.id === 'tinkoff_invest'
                        ? 'Подключить'
                        : provider.statementImport
                          ? 'Загрузить выписку'
                          : 'Скоро'}
                    </Text>
                  </NavyShimmerPressable>
                ) : (
                  <View style={[styles.actionBtn, styles.actionBtnDisabled]}>
                    <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>Скоро</Text>
                  </View>
                )}
              </View>
            ))}

            {providers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Провайдеры для этого раздела скоро появятся.</Text>
              </View>
            ) : null}

            <View style={styles.legal}>
              <Text style={styles.legalText}>
                koshel получает доступ только с вашего явного согласия. Токены хранятся на защищённом
                сервере, не в приложении.
              </Text>
            </View>
          </>
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
