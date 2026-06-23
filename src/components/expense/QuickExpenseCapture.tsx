import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Category } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { appendTransactionToDashboardCache } from '../../lib/dashboardCache';
import { insertTransaction } from '../../lib/transactions';
import { useThemedStyles } from '../../theme/useThemedStyles';

const QUICK_AMOUNTS = [300, 500, 1000, 2000] as const;
const QUICK_CATEGORIES: Category[] = ['Продукты', 'Кафе', 'Транспорт', 'Другое'];

type Props = {
  embedded?: boolean;
  onSaved?: () => void;
  onToast?: (message: string) => void;
};

export function QuickExpenseCapture({ embedded = false, onSaved, onToast }: Props) {
  const { user } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const styles = useThemedStyles(({ colors: c, cardBase, radii }) =>
    StyleSheet.create({
      wrap: {
        ...(embedded ? {} : cardBase),
        padding: embedded ? 20 : 16,
        marginBottom: embedded ? 0 : 16,
      },
      title: {
        fontSize: 15,
        fontWeight: '800',
        color: c.text,
        marginBottom: 4,
      },
      hint: {
        fontSize: 13,
        lineHeight: 18,
        color: c.textMuted,
        marginBottom: 12,
      },
      row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
      },
      chip: {
        borderRadius: radii.pill,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: c.backgroundDeep,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      chipActive: {
        backgroundColor: c.accentSoft,
        borderColor: c.accent,
      },
      chipText: {
        fontSize: 14,
        fontWeight: '600',
        color: c.textSecondary,
      },
      chipTextActive: {
        color: c.accentDark,
        fontWeight: '700',
      },
      categoryChip: {
        borderRadius: radii.pill,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      savingRow: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      savingText: {
        fontSize: 13,
        color: c.textMuted,
      },
    })
  );

  const saveQuickExpense = async (amount: number, category: Category) => {
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      const saved = await insertTransaction({
        title: category,
        amount,
        category,
        date: new Date().toISOString().slice(0, 10),
        kind: 'expense',
        source: 'manual',
        note: 'Быстрая запись',
      });
      await appendTransactionToDashboardCache(user.id, saved);
      setSelectedAmount(null);
      onSaved?.();
      onToast?.(`Сохранено: ${amount.toLocaleString('ru-RU')} ₽ · ${category}`);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {!embedded ? (
        <>
          <Text style={styles.title}>Быстрая трата</Text>
          <Text style={styles.hint}>Сумма → категория. Выписка потом сверит и уберёт дубли.</Text>
        </>
      ) : (
        <Text style={styles.hint}>Сумма → категория. Выписка сверит и уберёт дубли.</Text>
      )}

      <View style={styles.row}>
        {QUICK_AMOUNTS.map((amount) => {
          const active = selectedAmount === amount;
          return (
            <TouchableOpacity
              key={amount}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedAmount(amount)}
              disabled={saving}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {amount.toLocaleString('ru-RU')} ₽
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedAmount != null ? (
        <View style={[styles.row, { marginTop: 10 }]}>
          {QUICK_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={styles.categoryChip}
              onPress={() => void saveQuickExpense(selectedAmount, category)}
              disabled={saving}
            >
              <Text style={styles.chipText}>{category}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {saving ? (
        <View style={styles.savingRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.savingText}>Сохраняем…</Text>
        </View>
      ) : null}
    </View>
  );
}

export { QUICK_AMOUNTS, QUICK_CATEGORIES };
