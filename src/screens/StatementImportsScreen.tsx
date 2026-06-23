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
import {
  deleteStatementImport,
  fetchStatementImports,
  type StatementImportItem,
} from '../lib/financialConnections';
import { invalidateDashboardCache } from '../lib/dashboardCache';
import type { HomeStackParamList } from '../navigation/types';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<HomeStackParamList, 'StatementImports'>;

function formatImportedAt(value: string | null) {
  if (!value) return 'Дата неизвестна';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function accountKindLabel(kind: string | null) {
  if (kind === 'credit') return 'кредитная';
  if (kind === 'debit') return 'дебетовая';
  return null;
}

export function StatementImportsScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<StatementImportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const styles = useThemedStyles(({ colors: c, radii, cardBase }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: c.background },
      content: { padding: 20, paddingBottom: 40 },
      backText: { color: c.accentDark, fontSize: 16, fontWeight: '600', marginBottom: 12 },
      title: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 6 },
      subtitle: { fontSize: 14, lineHeight: 20, color: c.textMuted, marginBottom: 16 },
      card: {
        ...cardBase,
        padding: 16,
        marginBottom: 10,
        gap: 6,
      },
      cardTitle: { fontSize: 16, fontWeight: '700', color: c.text },
      cardMeta: { fontSize: 14, lineHeight: 20, color: c.textMuted },
      deleteBtn: {
        marginTop: 8,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: c.expense,
        paddingVertical: 10,
        alignItems: 'center',
      },
      deleteBtnText: { color: c.expense, fontWeight: '700', fontSize: 15 },
      empty: {
        ...cardBase,
        padding: 24,
        alignItems: 'center',
      },
      emptyText: { color: c.textMuted, textAlign: 'center', lineHeight: 20 },
      loader: { marginTop: 40 },
    })
  );

  const load = useCallback(async () => {
    try {
      const next = await fetchStatementImports();
      setItems(next);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось загрузить выписки');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const confirmDelete = (item: StatementImportItem) => {
    const count = item.importedCount || item.rowCount;
    Alert.alert(
      'Удалить выписку?',
      `Будут удалены ${count} операций из «${item.fileName}». Это действие нельзя отменить.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => void handleDelete(item),
        },
      ]
    );
  };

  const handleDelete = async (item: StatementImportItem) => {
    setBusyId(item.id);
    try {
      const result =
        item.kind === 'legacy'
          ? await deleteStatementImport({ legacyAccountId: item.accountId })
          : await deleteStatementImport({ importId: item.id });

      if (!result.ok) {
        Alert.alert('Не удалось удалить', result.message);
        return;
      }

      await invalidateDashboardCache();
      await load();
      Alert.alert('Готово', result.message ?? 'Операции удалены');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Импортированные выписки</Text>
        <Text style={styles.subtitle}>
          Удаление выписки убирает все связанные с ней операции из расходов и доходов.
        </Text>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.accent} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Пока нет импортированных выписок. Загрузите CSV или PDF на главной.
            </Text>
          </View>
        ) : (
          items.map((item) => {
            const kind = accountKindLabel(item.accountKind);
            const cardLabel = item.cardLast4 ? ` ···${item.cardLast4}` : '';
            const count = item.importedCount || item.rowCount;
            return (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.fileName}</Text>
                <Text style={styles.cardMeta}>
                  {item.providerName} · {item.accountName}
                  {kind ? ` · ${kind}${cardLabel}` : cardLabel}
                </Text>
                <Text style={styles.cardMeta}>
                  {count} операций · {formatImportedAt(item.importedAt)}
                </Text>
                {item.kind === 'legacy' ? (
                  <Text style={styles.cardMeta}>
                    Импорт до обновления приложения — удалятся все операции этого счёта без
                    привязки к файлу.
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => confirmDelete(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator color={colors.expense} />
                  ) : (
                    <Text style={styles.deleteBtnText}>Удалить выписку</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
