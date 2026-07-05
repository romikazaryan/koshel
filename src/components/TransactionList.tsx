import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction, TransactionKind } from '../types';
import { formatMoney } from '../lib/formatMoney';
import { useAppTheme } from '../contexts/ThemeContext';
import { moneyText, spacing, typography } from '../theme/layout';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  transactions: Transaction[];
  kind: TransactionKind;
  showHeading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  onEdit?: (transaction: Transaction) => void;
  onRemove?: (id: string) => void;
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Вручную',
  voice: 'Голос',
  receipt: 'Чек',
  bank: 'Банк',
  broker: 'T-Invest',
};

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-');
  if (!d || !m) return dateStr;
  return `${d}.${m}`;
}

const LIST_META: Record<TransactionKind, { title: string; emptyTitle: string; emptyHint: string }> = {
  expense: {
    title: 'История расходов',
    emptyTitle: 'Пока нет расходов',
    emptyHint: 'Вкладка «Добавить» → Расход',
  },
  income: {
    title: 'История доходов',
    emptyTitle: 'Пока нет доходов',
    emptyHint: 'Вкладка «Добавить» → Доход',
  },
};

export function TransactionList({
  transactions,
  kind,
  showHeading = true,
  emptyTitle,
  emptyHint,
  onEdit,
  onRemove,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors, radii }) =>
    StyleSheet.create({
      wrap: { marginTop: spacing.sm },
      title: {
        ...typography.h3,
        color: colors.text,
        marginBottom: spacing.md,
      },
      empty: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.xl,
        padding: spacing.xxl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
        borderStyle: 'dashed',
        gap: spacing.sm,
      },
      emptyTitle: { ...typography.bodyLg, fontWeight: '700', color: colors.text },
      emptyHint: { ...typography.meta, color: colors.textMuted, textAlign: 'center' },
      card: {
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        marginBottom: spacing.sm,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderLight,
      },
      accent: { width: 3 },
      accentIncome: { backgroundColor: colors.income },
      accentExpense: { backgroundColor: colors.expense },
      cardBody: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
      rowTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
        gap: spacing.md,
      },
      itemTitle: { flex: 1, ...typography.bodyLg, color: colors.text, fontWeight: '700' },
      amount: {
        ...typography.h3,
        color: colors.text,
        ...moneyText,
      },
      amountIncome: { color: colors.incomeDark },
      rowBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
      },
      meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1, gap: 4 },
      categoryPill: {
        ...typography.caption,
        fontSize: 10,
        color: colors.textSecondary,
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        overflow: 'hidden',
      },
      date: { ...typography.caption, color: colors.textMuted },
      source: { ...typography.caption, color: colors.textMuted },
      dot: { color: colors.textMuted, fontSize: 10 },
      actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
      actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceMuted,
      },
    })
  );

  const meta = LIST_META[kind];
  const isIncome = kind === 'income';
  const resolvedEmptyTitle = emptyTitle ?? meta.emptyTitle;
  const resolvedEmptyHint = emptyHint ?? meta.emptyHint;

  return (
    <View style={styles.wrap}>
      {showHeading ? <Text style={styles.title}>{meta.title}</Text> : null}
      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{resolvedEmptyTitle}</Text>
          {resolvedEmptyHint ? <Text style={styles.emptyHint}>{resolvedEmptyHint}</Text> : null}
        </View>
      ) : (
        transactions.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={[styles.accent, isIncome ? styles.accentIncome : styles.accentExpense]} />
            <View style={styles.cardBody}>
              <View style={styles.rowTop}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.amount, isIncome && styles.amountIncome]}>
                  {formatMoney(item.amount, { signed: isIncome })}
                </Text>
              </View>
              <View style={styles.rowBottom}>
                <View style={styles.meta}>
                  <Text style={styles.categoryPill}>{item.category}</Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.date}>{formatDate(item.date)}</Text>
                  {!isIncome && item.source ? (
                    <>
                      <Text style={styles.dot}>·</Text>
                      <Text style={styles.source}>{SOURCE_LABELS[item.source] ?? item.source}</Text>
                    </>
                  ) : null}
                </View>
                <View style={styles.actions}>
                  {onEdit ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => onEdit(item)}
                      hitSlop={4}
                      accessibilityLabel="Изменить"
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.incomeDark} />
                    </TouchableOpacity>
                  ) : null}
                  {onRemove ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => onRemove(item.id)}
                      hitSlop={4}
                      accessibilityLabel="Удалить"
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}
