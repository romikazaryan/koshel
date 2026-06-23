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
import { SegmentedControl } from '../components/ui/SegmentedControl';
import {
  createPendingConnection,
  fetchFinancialAccounts,
  fetchFinancialConnections,
  requestBankSync,
  requestTInvestSync,
  revokeFinancialConnection,
} from '../lib/financialConnections';
import type { ProfileStackParamList } from '../navigation/types';
import { useAppTheme } from '../contexts/ThemeContext';
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
      content: { padding: 20, paddingBottom: 40 },
      backText: { color: c.accentDark, fontSize: 16, fontWeight: '600', marginBottom: 12 },
      title: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 6 },
      subtitle: { fontSize: 14, lineHeight: 20, color: c.textMuted, marginBottom: 16 },
      sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
        marginTop: 8,
      },
      providerCard: {
        ...cardBase,
        padding: 16,
        marginBottom: 10,
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
        backgroundColor: c.accent,
        borderRadius: radii.md,
        paddingVertical: 12,
        alignItems: 'center',
      },
      actionBtnSecondary: {
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      },
      actionBtnText: { color: c.textOnAccent, fontWeight: '700', fontSize: 15 },
      actionBtnTextSecondary: { color: c.text, fontWeight: '700', fontSize: 15 },
      connectionCard: {
        ...cardBase,
        padding: 16,
        marginBottom: 10,
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

  const handleConnectProvider = (providerId: string, providerName: string) => {
    if (providerId === 'tinkoff_invest') {
      navigation.navigate('TinvestConnect');
      return;
    }
    void handleConnectDemo(providerId, providerName);
  };

  const handleSync = async (connection: FinancialConnection) => {
    setBusyId(connection.id);
    try {
      const result =
        connection.providerId === 'tinkoff_invest'
          ? await requestTInvestSync(connection.id)
          : await requestBankSync(connection.id);
      Alert.alert(result.ok ? 'Синхронизация' : 'Ошибка', result.message);
      if (result.ok) await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleConnectDemo = async (providerId: string, providerName: string) => {
    setBusyId(providerId);
    try {
      const existing = connections.find(
        (c) => c.providerId === providerId && c.status !== 'revoked'
      );
      const connection =
        existing ??
        (await createPendingConnection({
          providerKind: segment,
          providerId,
          displayName: providerName,
        }));

      const result = await requestBankSync(connection.id);
      if (result.ok) {
        Alert.alert('Готово', `${result.message}\n\nЭто демо до подключения реального банка.`);
        await load();
      } else {
        Alert.alert(
          'Синхронизация',
          `${result.message}\n\nЕсли функция ещё не задеплоена — выполните миграцию и deploy bank-sync в Supabase.`
        );
      }
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось подключить');
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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
        }
      >
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backText}>← Профиль</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Подключения</Text>
        <Text style={styles.subtitle}>
          T-Invest — через read-only токен. Банковские выписки загружайте кнопкой на главной.
          Автосинхронизация банков — после Open Finance.
        </Text>

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

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <>
            {activeConnections.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Подключено</Text>
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
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.rowAction]}
                          onPress={() => void handleSync(conn)}
                          disabled={busyId === conn.id}
                        >
                          <Text style={styles.actionBtnText}>
                            {busyId === conn.id ? '…' : 'Обновить'}
                          </Text>
                        </TouchableOpacity>
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

            <Text style={styles.sectionTitle}>Доступные провайдеры</Text>
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
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleConnectProvider(provider.id, provider.name)}
                  disabled={busyId === provider.id}
                >
                  <Text style={styles.actionBtnText}>
                    {busyId === provider.id
                      ? 'Подключение…'
                      : provider.id === 'tinkoff_invest'
                        ? 'Подключить'
                        : 'Попробовать демо'}
                  </Text>
                </TouchableOpacity>
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
      </ScrollView>
    </SafeAreaView>
  );
}
