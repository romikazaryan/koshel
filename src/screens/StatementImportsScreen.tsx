import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Button } from '../components/ui/Button';
import {
  deleteStatementImport,
  fetchStatementImports,
  type StatementImportItem,
} from '../lib/financialConnections';
import { invalidateDashboardCache } from '../lib/dashboardCache';
import type { HomeStackParamList } from '../navigation/types';
import { useAppTheme } from '../contexts/ThemeContext';
import { LUXURY_GOLD } from '../theme/premium';
import { spacing, typography } from '../theme/layout';
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

function importsCountLabel(count: number) {
  if (count === 1) return '1 выписка';
  if (count >= 2 && count <= 4) return `${count} выписки`;
  return `${count} выписок`;
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
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
      card: {
        ...cardBase,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: c.borderLight,
        gap: 6,
      },
      cardTitle: { ...typography.h3, fontSize: 16 },
      cardMeta: { ...typography.body, fontSize: 14, lineHeight: 20, color: c.textMuted },
      empty: {
        ...cardBase,
        padding: spacing.xl,
        alignItems: 'center',
        borderRadius: radii.xl,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      emptyIcon: { marginBottom: spacing.md },
      emptyTitle: { ...typography.h3, marginBottom: spacing.sm, textAlign: 'center' },
      emptyText: { ...typography.body, color: c.textMuted, textAlign: 'center', lineHeight: 22 },
      loader: { marginTop: spacing.xl },
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        backLabel="Главная"
        title="Импортированные выписки"
        subtitle="Удаление выписки убирает все связанные операции"
      />

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
        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.accent} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="document-text-outline"
              size={40}
              color={LUXURY_GOLD}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>Выписок пока нет</Text>
            <Text style={styles.emptyText}>
              Загрузите CSV или PDF с главного экрана — операции появятся в истории.
            </Text>
          </View>
        ) : (
          <>
            <SectionLabel>{importsCountLabel(items.length)}</SectionLabel>
            {items.map((item) => {
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
                      Импорт до обновления — удалятся все операции этого счёта.
                    </Text>
                  ) : null}
                  <Button
                    label={busyId === item.id ? 'Удаляем…' : 'Удалить выписку'}
                    variant="danger"
                    size="md"
                    onPress={() => confirmDelete(item)}
                    loading={busyId === item.id}
                    disabled={busyId === item.id}
                    style={{ marginTop: spacing.sm }}
                  />
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
