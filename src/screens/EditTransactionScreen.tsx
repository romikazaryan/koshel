import { useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from '../components/ui/KeyboardAwareScrollView';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants/categories';
import { updateTransaction } from '../lib/transactions';
import type { HomeStackParamList } from '../navigation/types';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<HomeStackParamList, 'EditTransaction'>;

function isValidDate(dateStr: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

export function EditTransactionScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: c.background },
      content: { padding: 20, paddingBottom: 40 },
      backButton: { marginBottom: 12 },
      backText: { color: c.accentDark, fontSize: 16, fontWeight: '600' },
      title: { fontSize: 26, fontWeight: '800', color: c.text, marginBottom: 20 },
      field: { marginBottom: 18 },
      label: { fontSize: 14, fontWeight: '600', color: c.textMuted, marginBottom: 8 },
      input: {
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: c.text,
        backgroundColor: c.surface,
      },
      textArea: { minHeight: 88, textAlignVertical: 'top' },
      pillRow: { flexDirection: 'row', flexWrap: 'wrap' },
      pillSpacing: { marginRight: 8, marginBottom: 8 },
      pill: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      },
      pillActive: { backgroundColor: c.accent, borderColor: c.accent },
      pillText: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
      pillTextActive: { color: c.textOnAccent },
      saveButton: {
        marginTop: 8,
        backgroundColor: c.accent,
        borderRadius: radii.lg,
        paddingVertical: 16,
        alignItems: 'center',
      },
      saveDisabled: { opacity: 0.6 },
      saveText: { color: c.textOnAccent, fontWeight: '700', fontSize: 16 },
      metaBox: {
        borderWidth: 1,
        borderColor: c.borderLight,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
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
        <View style={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Запись не найдена</Text>
        </View>
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
      <KeyboardAwareScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardBottomPadding={120}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{isIncome ? 'Редактировать доход' : 'Редактировать расход'}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Сумма</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Название</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={isIncome ? 'Зарплата за май' : 'Например, Ozon'}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Категория</Text>
          <View style={styles.pillRow}>
            {categories.map((item) => {
              const selected = category === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.pill, styles.pillSpacing, selected && styles.pillActive]}
                  onPress={() => setCategory(item)}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Дата</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-06-02"
            placeholderTextColor={colors.textMuted}
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
          />
        </View>

        {isImported && importNoteRef.current ? (
          <View style={styles.field}>
            <Text style={styles.label}>Из выписки</Text>
            <View style={styles.metaBox}>
              <Text style={styles.metaText}>{importNoteRef.current}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>{isIncome ? 'Описание' : 'Заметка'}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={isIncome ? 'Зарплата за май' : 'Например, обед'}
              placeholderTextColor={colors.textMuted}
              onFocus={scrollFocusedFieldIntoView}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveDisabled]}
          onPress={() => void handleSave()}
          disabled={isSaving}
        >
          <Text style={styles.saveText}>{isSaving ? 'Сохраняю...' : 'Сохранить'}</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
