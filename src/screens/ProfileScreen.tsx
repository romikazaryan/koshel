import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAwareScrollView } from '../components/ui/KeyboardAwareScrollView';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ProfileAccountCard } from '../components/profile/ProfileAccountCard';
import { ProfileMenuRow } from '../components/profile/ProfileMenuRow';
import { SectionLabel } from '../components/ui/SectionLabel';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme, type ThemePreference } from '../contexts/ThemeContext';
import { fetchMonthlyBudget, saveMonthlyBudget } from '../lib/userSettings';
import type { ProfileStackParamList } from '../navigation/types';
import { spacing, typography } from '../theme/layout';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

export function ProfileScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { preference, setPreference } = useAppTheme();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const [budgetInput, setBudgetInput] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  const accountLabel = user?.email ?? user?.phone ?? 'Аккаунт';

  const styles = useThemedStyles(({ colors: c, radii, shadows, cardBase }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
      pageTitle: {
        ...typography.h1,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
      },
      pageSubtitle: {
        ...typography.body,
        color: c.textMuted,
        marginBottom: spacing.lg,
      },
      card: {
        ...cardBase,
        borderRadius: radii.xl,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: c.borderLight,
        ...shadows.soft,
      },
      cardHint: {
        ...typography.body,
        color: c.textMuted,
        lineHeight: 20,
        marginBottom: spacing.md,
      },
      versionText: {
        ...typography.body,
        color: c.textMuted,
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
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardBottomPadding={48} avoidKeyboard={false}>
        <Text style={styles.pageTitle}>Профиль</Text>
        <Text style={styles.pageSubtitle}>Аккаунт и настройки</Text>

        <ProfileAccountCard accountLabel={accountLabel} />

        <SectionLabel>Оформление</SectionLabel>
        <View style={styles.card}>
          <Text style={styles.cardHint}>«Авто» следует настройкам iPhone (светлая / тёмная).</Text>
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

        <SectionLabel>Лимит трат</SectionLabel>
        <View style={styles.card}>
          <Text style={styles.cardHint}>
            План расходов на месяц — на главной покажем прогресс.
          </Text>
          <Input
            containerStyle={{ marginBottom: 12 }}
            keyboardType="numeric"
            placeholder="Например, 50000"
            value={budgetInput}
            onChangeText={setBudgetInput}
            editable={!isSavingBudget}
          />
          <Button
            label="Сохранить лимит"
            onPress={() => void handleSaveBudget()}
            loading={isSavingBudget}
          />
          {budgetInput.trim() ? (
            <Button
              label="Убрать лимит"
              variant="ghost"
              size="md"
              onPress={handleClearBudget}
              disabled={isSavingBudget}
              style={{ marginTop: 4 }}
            />
          ) : null}
        </View>

        <SectionLabel>Обучение</SectionLabel>
        <ProfileMenuRow
          icon="map-outline"
          title="Тур по приложению"
          hint="Короткий обзор главных разделов"
          onPress={() => navigation.navigate('AppTour')}
        />
        <ProfileMenuRow
          icon="clipboard-outline"
          title="Стартовый опрос"
          hint="Доход, лимит, подушка и цели"
          onPress={() => navigation.navigate('Onboarding')}
        />

        <SectionLabel>Подключения</SectionLabel>
        <ProfileMenuRow
          icon="link-outline"
          title="Банки и брокеры"
          hint="T-Invest, выписки, Open Finance"
          onPress={() => navigation.navigate('BankConnections')}
        />

        <SectionLabel>Система</SectionLabel>
        <View style={styles.card}>
          <Text style={styles.versionText}>koshel {appVersion}</Text>
        </View>

        <Button
          label="Выйти из аккаунта"
          variant="danger"
          onPress={handleSignOut}
          style={{ marginTop: spacing.md }}
        />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
