import { useCallback, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAwareScrollView } from '../components/ui/KeyboardAwareScrollView';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  deleteDebt,
  fetchDebts,
  formatDebtEndLabel,
  insertDebt,
  setDebtActive,
  setDebtReminders,
} from '../lib/debts';
import { getDefaultDebtEndDate, getPaymentDayFromIsoDate, isValidIsoDate } from '../lib/endDate';
import { ensureNotificationPermission, rescheduleDebtReminders } from '../lib/debtReminders';
import { EndDateCarouselPicker } from '../components/EndDateCarouselPicker';
import type { ProfileStackParamList } from '../navigation/types';
import type { Debt } from '../types';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

type DebtsScreenProps = {
  embedded?: boolean;
};

export function DebtsScreen({ embedded = false }: DebtsScreenProps = {}) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<Debt[]>([]);
  const [name, setName] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [paymentDay, setPaymentDay] = useState('1');
  const [endDate, setEndDate] = useState('');
  const [remindEnabled, setRemindEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      content: { padding: 20, paddingBottom: 40 },
      backButton: { marginBottom: 8 },
      backText: { color: c.accentDark, fontSize: 16, fontWeight: '600' },
      title: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -0.5, marginBottom: 6 },
      subtitle: { fontSize: 15, color: c.textMuted, marginBottom: 20, lineHeight: 21 },
      card: {
        backgroundColor: c.surface,
        borderRadius: radii.lg,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: c.borderLight,
        ...shadows.soft,
      },
      cardLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 10,
      },
      row: { flexDirection: 'row', gap: 10 },
      rowItem: { flex: 1 },
      remindRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      },
      remindText: { flex: 1, paddingRight: 12 },
      remindTitle: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 4 },
      remindHint: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
      itemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      },
      itemMain: { flex: 1 },
      itemName: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 4 },
      itemMeta: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
      itemAmount: { fontSize: 17, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] },
      switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
      },
      switchLabel: { fontSize: 13, color: c.textMuted },
      deleteLink: { color: c.danger, fontSize: 13, fontWeight: '600', marginTop: 10 },
      empty: {
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: c.border,
        borderStyle: 'dashed',
        borderRadius: radii.lg,
      },
      emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
      totalLine: {
        marginTop: 4,
        marginBottom: 10,
        fontSize: 14,
        fontWeight: '600',
        color: c.accentDark,
      },
    })
  );

  const syncReminders = useCallback(async (rows: Debt[]) => {
    await rescheduleDebtReminders(rows);
  }, []);

  const load = useCallback(async () => {
    const rows = await fetchDebts();
    setItems(rows);
    await syncReminders(rows);
  }, [syncReminders]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const activeTotal = items
    .filter((item) => item.isActive)
    .reduce((sum, item) => sum + item.monthlyPayment, 0);

  const handleAdd = async () => {
    const trimmedName = name.trim();
    const value = Number(monthlyPayment.replace(',', '.'));
    if (!trimmedName) {
      Alert.alert('Укажите название', 'Например: Ипотека, Автокредит.');
      return;
    }
    if (!value || value <= 0) {
      Alert.alert('Укажите платёж', 'Введите сумму ежемесячного платежа.');
      return;
    }
    if (!isValidIsoDate(endDate)) {
      Alert.alert('Срок выплат', 'Выберите корректную дату окончания.');
      return;
    }
    if (endDate < new Date().toISOString().slice(0, 10)) {
      Alert.alert('Срок выплат', 'Дата окончания должна быть сегодня или позже.');
      return;
    }

    if (remindEnabled) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Уведомления',
          'Разрешите уведомления в настройках iPhone — тогда koshel сможет напоминать о платежах.'
        );
      }
    }

    setIsSaving(true);
    try {
      const created = await insertDebt({
        name: trimmedName,
        monthlyPayment: value,
        paymentDay: getPaymentDayFromIsoDate(endDate),
        endDate,
        remindEnabled,
      });
      const next = [created, ...items];
      setItems(next);
      await syncReminders(next);
      setName('');
      setMonthlyPayment('');
      setEndDate(getDefaultDebtEndDate());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить.';
      Alert.alert('Ошибка', message);
    } finally {
      setIsSaving(false);
    }
  };

  const patchItem = (id: string, patch: Partial<Debt>) => {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleToggleActive = (item: Debt, next: boolean) => {
    patchItem(item.id, { isActive: next });
    const nextItems = items.map((row) => (row.id === item.id ? { ...row, isActive: next } : row));
    void setDebtActive(item.id, next)
      .then(() => syncReminders(nextItems))
      .catch((error) => {
        patchItem(item.id, { isActive: !next });
        Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось обновить.');
      });
  };

  const handleToggleRemind = (item: Debt, next: boolean) => {
    void (async () => {
      if (next) {
        const granted = await ensureNotificationPermission();
        if (!granted) {
          Alert.alert('Уведомления', 'Включите уведомления для koshel в настройках iPhone.');
          return;
        }
      }
      patchItem(item.id, { remindEnabled: next });
      const nextItems = items.map((row) =>
        row.id === item.id ? { ...row, remindEnabled: next } : row
      );
      try {
        await setDebtReminders(item.id, next);
        await syncReminders(nextItems);
      } catch (error) {
        patchItem(item.id, { remindEnabled: !next });
        Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось обновить.');
      }
    })();
  };

  const handleDelete = (item: Debt) => {
    Alert.alert('Удалить задолженность?', item.name, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          const next = items.filter((row) => row.id !== item.id);
          setItems(next);
          void deleteDebt(item.id)
            .then(() => syncReminders(next))
            .catch((error) => {
              void load();
              Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось удалить.');
            });
        },
      },
    ]);
  };

  const Root = embedded ? View : SafeAreaView
  const rootProps = embedded
    ? { style: { flex: 1 } }
    : { style: styles.safeArea, edges: ['top', 'left', 'right'] as const }

  return (
    <Root {...rootProps}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, embedded && { paddingTop: 0 }]}
        keyboardBottomPadding={100}
      >
        {!embedded ? (
          <>
            <Text style={styles.title}>Задолженности</Text>
            <Text style={styles.subtitle}>
              Кредиты и другие долги. Платежи учитываются в расходах на главной, а в день платежа
              придёт напоминание.
            </Text>
          </>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Добавить долг</Text>
          <Input
            containerStyle={{ marginBottom: 10 }}
            placeholder="Название (ипотека, кредит…)"
            value={name}
            onChangeText={setName}
          />
          <Input
            containerStyle={{ marginBottom: 10 }}
            placeholder="Платёж ₽/мес"
            keyboardType="numeric"
            value={monthlyPayment}
            onChangeText={setMonthlyPayment}
          />
          <Text style={[styles.cardLabel, { marginTop: 2, marginBottom: 4 }]}>Дата платежа</Text>
          <Text style={[styles.remindHint, { marginBottom: 8 }]}>
            Выберите день последнего платежа — в это же число каждый месяц придёт напоминание.
          </Text>
          <EndDateCarouselPicker value={endDate} onChange={setEndDate} />
          <View style={styles.remindRow}>
            <View style={styles.remindText}>
              <Text style={styles.remindTitle}>Напоминание</Text>
              <Text style={styles.remindHint}>
                {getPaymentDayFromIsoDate(endDate)}-го числа в 9:00
              </Text>
            </View>
            <Switch
              value={remindEnabled}
              onValueChange={setRemindEnabled}
              trackColor={{ false: colors.border, true: colors.accentSoft }}
              thumbColor={remindEnabled ? colors.accent : colors.textMuted}
            />
          </View>
          <Button
            label={isSaving ? 'Сохраняю…' : 'Добавить'}
            onPress={() => void handleAdd()}
            loading={isSaving}
          />
        </View>

        <Text style={styles.cardLabel}>Ваши долги</Text>
        {activeTotal > 0 ? (
          <Text style={styles.totalLine}>
            Активные платежи: ₽{activeTotal.toLocaleString('ru-RU')} / мес
          </Text>
        ) : null}

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Пока нет задолженностей. Добавьте первую выше.</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.itemRow}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    Платёж {item.paymentDay}-го · {formatDebtEndLabel(item.endDate)}
                  </Text>
                </View>
                <Text style={styles.itemAmount}>
                  ₽{item.monthlyPayment.toLocaleString('ru-RU')}
                </Text>
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  {item.isActive ? 'Учитывается в расходах' : 'На паузе'}
                </Text>
                <Switch
                  value={item.isActive}
                  onValueChange={(next) => handleToggleActive(item, next)}
                  trackColor={{ false: colors.border, true: colors.accentSoft }}
                  thumbColor={item.isActive ? colors.accent : colors.textMuted}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Напоминание</Text>
                <Switch
                  value={item.remindEnabled}
                  onValueChange={(next) => handleToggleRemind(item, next)}
                  trackColor={{ false: colors.border, true: colors.accentSoft }}
                  thumbColor={item.remindEnabled ? colors.accent : colors.textMuted}
                />
              </View>

              <TouchableOpacity onPress={() => handleDelete(item)}>
                <Text style={styles.deleteLink}>Удалить</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </KeyboardAwareScrollView>
    </Root>
  );
}
