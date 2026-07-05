import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAwareScrollView } from '../components/ui/KeyboardAwareScrollView';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { Input } from '../components/ui/Input';
import { SectionLabel } from '../components/ui/SectionLabel';
import { RecurringPaymentsHero } from '../components/operations/RecurringPaymentsHero';
import { EXPENSE_CATEGORIES } from '../constants/categories';
import { formatMoney } from '../lib/formatMoney';
import {
  deleteSubscription,
  fetchSubscriptions,
  insertSubscription,
  setSubscriptionActive,
} from '../lib/subscriptions';
import { PaymentDayCarouselPicker } from '../components/PaymentDayCarouselPicker';
import { isValidPaymentDay, paymentDayHint } from '../lib/paymentDay';
import type { Category, Subscription } from '../types';
import { useAppTheme } from '../contexts/ThemeContext';
import { spacing, typography } from '../theme/layout';
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

  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      content: { paddingHorizontal: spacing.xl, paddingBottom: 40 },
      title: { ...typography.h1, marginBottom: spacing.xs },
      subtitle: { ...typography.body, color: c.textMuted, marginBottom: spacing.lg, lineHeight: 21 },
      cardBlock: { marginBottom: spacing.sm, padding: spacing.md },
      categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
      itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      },
      itemMain: { flex: 1 },
      itemName: { ...typography.bodyLg, color: c.text, marginBottom: 4 },
      itemMeta: { ...typography.meta, color: c.textMuted, lineHeight: 18 },
      itemAmount: {
        fontSize: 17,
        fontWeight: '800',
        color: c.text,
        fontVariant: ['tabular-nums'],
      },
      itemActions: { alignItems: 'flex-end', gap: spacing.sm },
      deleteLink: { color: c.danger, fontSize: 13, fontWeight: '600' },
      empty: {
        padding: spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: c.border,
        borderStyle: 'dashed',
        borderRadius: radii.lg,
        backgroundColor: c.surfaceMuted,
      },
      emptyText: { ...typography.body, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
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

  const Root = embedded ? View : SafeAreaView;
  const rootProps = embedded
    ? { style: { flex: 1 } }
    : { style: styles.safeArea, edges: ['top', 'left', 'right'] as const };

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

        <RecurringPaymentsHero
          eyebrow="Подписки в месяц"
          total={activeTotal}
          empty={activeTotal <= 0}
          icon="repeat-outline"
          hint={
            activeTotal > 0
              ? `${items.filter((i) => i.isActive).length} активных сервисов`
              : 'Добавьте Netflix, iCloud или другой сервис'
          }
        />

        <SectionLabel>Новая подписка</SectionLabel>
        <Card style={styles.cardBlock} variant="flat">
          <Input
            containerStyle={{ marginBottom: spacing.sm }}
            placeholder="Название (Netflix, Spotify…)"
            value={name}
            onChangeText={setName}
          />
          <Input
            containerStyle={{ marginBottom: spacing.sm }}
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
              <Chip
                key={cat}
                label={cat}
                variant="expense"
                active={category === cat}
                onPress={() => setCategory(cat)}
              />
            ))}
          </View>
          <Button
            label={isSaving ? 'Сохраняю…' : 'Добавить подписку'}
            onPress={() => void handleAdd()}
            loading={isSaving}
          />
        </Card>

        <SectionLabel>Ваши подписки</SectionLabel>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Пока нет подписок. Добавьте первую выше.</Text>
          </View>
        ) : (
          items.map((item) => (
            <Card key={item.id} style={styles.cardBlock} variant="flat">
              <View style={styles.itemRow}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.category} · списание {item.billingDay}-го
                  </Text>
                </View>
                <Text style={styles.itemAmount}>{formatMoney(item.amount)}</Text>
              </View>
              <View style={[styles.itemRow, { marginTop: spacing.md }]}>
                <Text style={styles.itemMeta}>{item.isActive ? 'В плане платежей' : 'На паузе'}</Text>
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
            </Card>
          ))
        )}
      </KeyboardAwareScrollView>
    </Root>
  );
}
