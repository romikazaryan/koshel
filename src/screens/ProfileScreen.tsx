import { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme, type ThemePreference } from '../contexts/ThemeContext';
import { fetchMonthlyBudget, saveMonthlyBudget } from '../lib/userSettings';
import type { ProfileStackParamList } from '../navigation/types';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

export function ProfileScreen(_props: Props) {
  const { user, signOut } = useAuth();
  const { colors, preference, setPreference } = useAppTheme();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const [budgetInput, setBudgetInput] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: c.background },
      content: { padding: 20, paddingBottom: 40 },
      title: { fontSize: 28, fontWeight: '800', color: c.accent, marginBottom: 6 },
      subtitle: { fontSize: 15, color: c.textMuted, marginBottom: 24 },
      card: {
        backgroundColor: c.surface,
        borderRadius: radii.lg,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: c.borderLight,
        ...shadows.soft,
      },
      cardLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 8,
      },
      cardHint: {
        fontSize: 14,
        lineHeight: 20,
        color: c.textMuted,
        marginBottom: 14,
      },
      cardValue: { fontSize: 17, fontWeight: '600', color: c.text },
      cardValueMuted: { fontSize: 15, color: c.textMuted },
      input: {
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 17,
        color: c.text,
        marginBottom: 12,
        backgroundColor: c.backgroundDeep,
      },
      saveButton: {
        backgroundColor: c.accent,
        borderRadius: radii.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 10,
      },
      saveButtonText: { color: c.textOnAccent, fontWeight: '700', fontSize: 16 },
      buttonDisabled: { opacity: 0.6 },
      clearLink: {
        textAlign: 'center',
        color: c.textMuted,
        fontSize: 14,
        fontWeight: '600',
      },
      signOutButton: {
        marginTop: 16,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.dangerSoft,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
      },
      signOutText: { color: c.danger, fontWeight: '700', fontSize: 16 },
      menuCard: {
        backgroundColor: c.surface,
        borderRadius: radii.lg,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: c.borderLight,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...shadows.soft,
      },
      menuTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 4 },
      menuHint: { fontSize: 13, color: c.textMuted, lineHeight: 18, flex: 1, paddingRight: 12 },
      menuArrow: { fontSize: 22, color: c.accentDark, fontWeight: '600' },
      themeHint: {
        fontSize: 14,
        color: c.textMuted,
        marginBottom: 12,
        lineHeight: 20,
      },
    })
  );

  const loadBudget = useCallback(async () => {
    try {
      const value = await fetchMonthlyBudget(user?.id);
      setBudgetInput(value != null ? String(Math.round(value)) : '');
    } catch (error) {
      console.warn('Profile loadBudget failed', error);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadBudget();
    }, [loadBudget])
  );

  const handleSaveBudget = async () => {
    const trimmed = budgetInput.trim().replace(/\s/g, '').replace(',', '.');
    if (!trimmed) {
      Alert.alert('Укажите сумму', 'Введите лимит трат на месяц в рублях.');
      return;
    }

    const value = Number(trimmed);
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму больше нуля.');
      return;
    }

    setIsSavingBudget(true);
    try {
      await saveMonthlyBudget(value);
      Alert.alert('Сохранено', 'Лимит трат обновлён. На главной появится прогресс.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось сохранить.';
      Alert.alert('Ошибка', message);
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleClearBudget = () => {
    Alert.alert('Убрать лимит?', 'На главной прогресс по лимиту скрыт.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Убрать',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsSavingBudget(true);
            try {
              await saveMonthlyBudget(null);
              setBudgetInput('');
              Alert.alert('Готово', 'Лимит трат отключён.');
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Не удалось сохранить.';
              Alert.alert('Ошибка', message);
            } finally {
              setIsSavingBudget(false);
            }
          })();
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Выйти из аккаунта?', 'Сессия на этом устройстве будет завершена.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          void signOut().catch((e) => {
            const message = e instanceof Error ? e.message : 'Не удалось выйти.';
            Alert.alert('Ошибка', message);
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Профиль</Text>
        <Text style={styles.subtitle}>Аккаунт и настройки приложения</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Тема оформления</Text>
          <Text style={styles.themeHint}>
            «Авто» следует настройкам iPhone (светлая / тёмная).
          </Text>
          <SegmentedControl<ThemePreference>
            options={[
              { value: 'system', label: 'Авто' },
              { value: 'light', label: 'Светлая' },
              { value: 'dark', label: 'Тёмная' },
            ]}
            value={preference}
            onChange={setPreference}
            style={{ marginBottom: 0 }}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Вы вошли как</Text>
          <Text style={styles.cardValue}>{user?.email ?? user?.phone ?? '—'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Лимит трат на месяц</Text>
          <Text style={styles.cardHint}>
            Сколько вы планируете потратить за месяц. На главной покажем прогресс по расходам.
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Например, 50000"
            placeholderTextColor={colors.textMuted}
            value={budgetInput}
            onChangeText={setBudgetInput}
            editable={!isSavingBudget}
          />
          <TouchableOpacity
            style={[styles.saveButton, isSavingBudget && styles.buttonDisabled]}
            onPress={() => void handleSaveBudget()}
            disabled={isSavingBudget}
          >
            <Text style={styles.saveButtonText}>
              {isSavingBudget ? 'Сохраняю...' : 'Сохранить лимит'}
            </Text>
          </TouchableOpacity>
          {budgetInput.trim() ? (
            <TouchableOpacity onPress={handleClearBudget} disabled={isSavingBudget}>
              <Text style={styles.clearLink}>Убрать лимит</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Версия</Text>
          <Text style={styles.cardValueMuted}>koshel {appVersion}</Text>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
