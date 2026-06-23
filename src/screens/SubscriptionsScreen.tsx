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
import { EXPENSE_CATEGORIES } from '../constants/categories';
import {
  deleteSubscription,
  fetchSubscriptions,
  insertSubscription,
  setSubscriptionActive,
} from '../lib/subscriptions';
import { PaymentDayCarouselPicker } from '../components/PaymentDayCarouselPicker';
import { isValidPaymentDay, paymentDayHint } from '../lib/paymentDay';
import type { ProfileStackParamList } from '../navigation/types';
import type { Category, Subscription } from '../types';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

type SubscriptionsScreenProps = {
  embedded?: boolean;
};

export function SubscriptionsScreen({ embedded = false }: SubscriptionsScreenProps = {}) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<Subscription[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [billingDay, setBillingDay] = useState(1);
  const [category, setCategory] = useState<Category>('Развлечения');
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
      categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
      chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.backgroundDeep,
      },
      chipActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
      chipText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
      chipTextActive: { color: c.accentDark },
      itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      },
      itemMain: { flex: 1 },
      itemName: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 4 },
      itemMeta: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
      itemAmount: { fontSize: 17, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] },
      itemActions: { alignItems: 'flex-end', gap: 8 },
      deleteLink: { color: c.danger, fontSize: 13, fontWeight: '600' },
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
        fontSize: 14,
        fontWeight: '600',
        color: c.accentDark,
      },
    })
  );

  const load = useCallback(async () => {
    const rows = await fetchSubscriptions();
    setItems(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const activeTotal = items
    .filter((item) => item.isActive)
    .reduce((sum, item) => sum + item.amount, 0);

  const handleAdd = async () => {
    const trimmedName = name.trim();
    const value = Number(amount.replace(',', '.'));
    if (!trimmedName) {
      Alert.alert('Укажите название', 'Например: Netflix, Spotify, iCloud.');
      return;
    }
    if (!value || value <= 0) {
      Alert.alert('Укажите сумму', 'Введите ежемесячную стоимость подписки.');
      return;
    }
    if (!isValidPaymentDay(billingDay)) {
      Alert.alert('День списания', paymentDayHint());
      return;
    }

    setIsSaving(true);
    try {
      const created = await insertSubscription({
        name: trimmedName,
        amount: value,
        category,
        billingDay,
      });
      setItems((prev) => [created, ...prev]);
      setName('');
      setAmount('');
      setBillingDay(1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить подписку.';
      Alert.alert('Ошибка', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (item: Subscription, next: boolean) => {
    setItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, isActive: next } : row))
    );
    void setSubscriptionActive(item.id, next).catch((error) => {
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, isActive: !next } : row))
      );
      const message = error instanceof Error ? error.message : 'Не удалось обновить.';
      Alert.alert('Ошибка', message);
    });
  };

  const handleDelete = (item: Subscription) => {
    Alert.alert('Удалить подписку?', item.name, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          setItems((prev) => prev.filter((row) => row.id !== item.id));
          void deleteSubscription(item.id).catch((error) => {
            void load();
            const message = error instanceof Error ? error.message : 'Не удалось удалить.';
            Alert.alert('Ошибка', message);
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
            <Text style={styles.title}>Подписки</Text>
            <Text style={styles.subtitle}>
              Ежемесячные платежи учитываются в расходах на главной автоматически.
            </Text>
          </>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Добавить подписку</Text>
          <Input
            containerStyle={{ marginBottom: 10 }}
            placeholder="Название (Netflix, Spotify…)"
            value={name}
            onChangeText={setName}
          />
          <Input
            containerStyle={{ marginBottom: 10 }}
            placeholder="Сумма ₽/мес"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          <PaymentDayCarouselPicker
            value={billingDay}
            onChange={setBillingDay}
            hint="В феврале и в коротких месяцах списание учитывается как в последний день."
          />
          <View style={styles.categories}>
            {EXPENSE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button
            label={isSaving ? 'Сохраняю…' : 'Добавить подписку'}
            onPress={() => void handleAdd()}
            loading={isSaving}
          />
        </View>

        <Text style={styles.cardLabel}>Ваши подписки</Text>
        {activeTotal > 0 ? (
          <Text style={styles.totalLine}>
            Активные: ₽{activeTotal.toLocaleString('ru-RU')} / мес
          </Text>
        ) : null}

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Пока нет подписок. Добавьте первую выше.</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.itemRow}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.category} · списание {item.billingDay}-го
                  </Text>
                </View>
                <Text style={styles.itemAmount}>₽{item.amount.toLocaleString('ru-RU')}</Text>
              </View>
              <View style={[styles.itemRow, { marginTop: 12 }]}>
                <Text style={styles.itemMeta}>{item.isActive ? 'Учитывается в расходах' : 'На паузе'}</Text>
                <View style={styles.itemActions}>
                  <Switch
                    value={item.isActive}
                    onValueChange={(next) => handleToggle(item, next)}
                    trackColor={{ false: colors.border, true: colors.accentSoft }}
                    thumbColor={item.isActive ? colors.accent : colors.textMuted}
                  />
                  <TouchableOpacity onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteLink}>Удалить</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </KeyboardAwareScrollView>
    </Root>
  );
}
