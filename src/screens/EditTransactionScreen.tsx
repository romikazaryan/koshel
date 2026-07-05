import { useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from '../components/ui/KeyboardAwareScrollView';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { Input } from '../components/ui/Input';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants/categories';
import { updateTransaction } from '../lib/transactions';
import type { HomeStackParamList } from '../navigation/types';
import { useAppTheme } from '../contexts/ThemeContext';
import { spacing } from '../theme/layout';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<HomeStackParamList, 'EditTransaction'>;

function isValidDate(dateStr: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

export function EditTransactionScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
      field: { marginBottom: spacing.lg },
      chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
      metaBox: {
        borderWidth: 1,
        borderColor: c.borderLight,
        borderRadius: radii.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        backgroundColor: c.surfaceMuted,
      },
      metaText: {
        fontSize: 13,
        lineHeight: 18,
        color: c.textMuted,
      },
    })
  );

  const transaction = route.params?.transaction;
  const isIncome = transaction?.kind === 'income';
  const isImported =
    transaction?.source === 'bank' || transaction?.source === 'broker';

  const [title, setTitle] = useState(transaction?.title ?? '');
  const [note, setNote] = useState(
    isImported ? '' : (transaction?.note ?? transaction?.title ?? '').trim()
  );
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [date, setDate] = useState(transaction?.date ?? '');
  const [category, setCategory] = useState(transaction?.category ?? 'Другое');
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const importNoteRef = useRef(transaction?.note);

  const scrollFocusedFieldIntoView = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  if (!transaction?.id) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader onBack={() => navigation.goBack()} title="Запись не найдена" />
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    const value = Number(amount.replace(',', '.').replace(/\s/g, ''));
    if (!value || value <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму.');
      return;
    }
    if (!isValidDate(date.trim())) {
      Alert.alert('Ошибка', 'Дата в формате ГГГГ-ММ-ДД, например 2026-06-02.');
      return;
    }

    setIsSaving(true);
    try {
      await updateTransaction({
        id: transaction.id,
        kind: transaction.kind,
        amount: value,
        category,
        title,
        note: isImported ? importNoteRef.current : note,
        date: date.trim(),
      });
      navigation.goBack();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось сохранить.';
      Alert.alert('Ошибка', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        backLabel="Назад"
        title={isIncome ? 'Редактировать доход' : 'Редактировать расход'}
      />
      <KeyboardAwareScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardBottomPadding={120}>
        <View style={styles.field}>
          <Input label="Сумма" keyboardType="numeric" value={amount} onChangeText={setAmount} />
        </View>

        <View style={styles.field}>
          <Input
            label="Название"
            value={title}
            onChangeText={setTitle}
            placeholder={isIncome ? 'Зарплата за май' : 'Например, Ozon'}
          />
        </View>

        <View style={styles.field}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>
            Категория
          </Text>
          <View style={styles.chipRow}>
            {categories.map((item) => (
              <Chip
                key={item}
                label={item}
                active={category === item}
                variant={isIncome ? 'income' : 'expense'}
                onPress={() => setCategory(item)}
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Input
            label="Дата"
            placeholder="2026-06-02"
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
          />
        </View>

        {isImported && importNoteRef.current ? (
          <View style={styles.field}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>
              Из выписки
            </Text>
            <View style={styles.metaBox}>
              <Text style={styles.metaText}>{importNoteRef.current}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.field}>
            <Input
              label={isIncome ? 'Описание' : 'Заметка'}
              style={{ minHeight: 88, textAlignVertical: 'top' }}
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={isIncome ? 'Зарплата за май' : 'Например, обед'}
              onFocus={scrollFocusedFieldIntoView}
            />
          </View>
        )}

        <Button
          label="Сохранить"
          onPress={() => void handleSave()}
          loading={isSaving}
          style={{ marginTop: spacing.sm }}
        />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
