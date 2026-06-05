import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Transaction, TransactionKind, TransactionSource } from '../types';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  transactions: Transaction[];
  kind: TransactionKind;
  showHeading?: boolean;
  onEdit?: (transaction: Transaction) => void;
  onRemove?: (id: string) => void;
};

const SOURCE_LABELS: Record<TransactionSource, string> = {
  manual: 'Вручную',
  voice: 'Голос',
  receipt: 'Чек',
  bank: 'Банк',
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
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

export function TransactionList({ transactions, kind, showHeading = true, onEdit, onRemove }: Props) {
  const styles = useThemedStyles(({ colors, radii, shadows }) =>
    StyleSheet.create({
      wrap: { marginTop: 8 },
      title: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 12,
      },
      empty: {
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
      },
      emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 6 },
      emptyHint: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
      card: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...shadows.soft,
      },
      stripe: { width: 4 },
      stripeIncome: { backgroundColor: colors.accent },
      stripeExpense: { backgroundColor: colors.navyMid },
      cardBody: { flex: 1, padding: 14 },
      rowTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
        gap: 12,
      },
      itemTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
      amount: { fontSize: 16, fontWeight: '800', color: colors.text },
      amountIncome: { color: colors.accentDark },
      rowBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1 },
      category: { color: colors.textMuted, fontSize: 13 },
      date: { color: colors.textMuted, fontSize: 13 },
      source: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
      dot: { color: colors.textMuted, marginHorizontal: 4 },
      actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
      edit: { color: colors.accentDark, fontSize: 13, fontWeight: '700' },
      remove: { color: colors.danger, fontSize: 13, fontWeight: '600' },
    })
  );

  const meta = LIST_META[kind];
  const isIncome = kind === 'income';

  return (
    <View style={styles.wrap}>
      {showHeading ? <Text style={styles.title}>{meta.title}</Text> : null}
      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{meta.emptyTitle}</Text>
          <Text style={styles.emptyHint}>{meta.emptyHint}</Text>
        </View>
      ) : (
        transactions.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={[styles.stripe, isIncome ? styles.stripeIncome : styles.stripeExpense]} />
            <View style={styles.cardBody}>
              <View style={styles.rowTop}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.amount, isIncome && styles.amountIncome]}>
                  {isIncome ? '+' : ''}₽{item.amount.toLocaleString('ru-RU')}
                </Text>
              </View>
              <View style={styles.rowBottom}>
                <View style={styles.meta}>
                  <Text style={styles.category}>{item.category}</Text>
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
                    <TouchableOpacity onPress={() => onEdit(item)} hitSlop={8}>
                      <Text style={styles.edit}>Изменить</Text>
                    </TouchableOpacity>
                  ) : null}
                  {onRemove ? (
                    <TouchableOpacity onPress={() => onRemove(item.id)} hitSlop={8}>
                      <Text style={styles.remove}>Удалить</Text>
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
