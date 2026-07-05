import { useState } from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAwareScrollView } from '../components/ui/KeyboardAwareScrollView';
import { Button } from '../components/ui/Button';
import { connectTInvestToken, requestTInvestSync } from '../lib/financialConnections';
import type { ProfileStackParamList } from '../navigation/types';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TinvestConnect'>;

export function TinvestConnectScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const styles = useThemedStyles(({ colors: c, radii, cardBase }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      content: { padding: 20, paddingBottom: 40 },
      backText: { color: c.accentDark, fontSize: 16, fontWeight: '600', marginBottom: 12 },
      title: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 6 },
      subtitle: { fontSize: 14, lineHeight: 21, color: c.textMuted, marginBottom: 20 },
      card: { ...cardBase, padding: 16, marginBottom: 16 },
      step: { fontSize: 15, lineHeight: 22, color: c.textSecondary, marginBottom: 10 },
      link: { color: c.accentDark, fontWeight: '600' },
      label: { fontSize: 14, fontWeight: '600', color: c.textSecondary, marginBottom: 8 },
      input: {
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radii.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: c.text,
        backgroundColor: c.backgroundDeep,
        marginBottom: 8,
      },
      hint: { fontSize: 12, lineHeight: 18, color: c.textMuted, marginBottom: 16 },
      warning: {
        padding: 14,
        borderRadius: radii.md,
        backgroundColor: c.warningSoft,
        borderWidth: 1,
        borderColor: c.warning,
      },
      warningText: { fontSize: 13, lineHeight: 19, color: c.textSecondary },
    })
  );

  const handleConnect = async () => {
    const trimmed = token.trim();
    if (trimmed.length < 20) {
      Alert.alert('Нужен токен', 'Вставьте read-only токен из настроек T-Invest.');
      return;
    }

    setIsConnecting(true);
    try {
      const result = await connectTInvestToken(trimmed);
      if (!result.ok || !result.connectionId) {
        Alert.alert('Не удалось подключить', result.message);
        return;
      }

      const sync = await requestTInvestSync(result.connectionId);
      Alert.alert(
        sync.ok ? 'T-Invest подключён' : 'Подключено, но синк не прошёл',
        sync.ok
          ? `${result.message}\n${sync.message}\n\nПортфель — во вкладке «Финансы» → Капитал.`
          : `${result.message}\n${sync.message}`
      );
      setToken('');
      navigation.navigate('BankConnections');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardBottomPadding={48}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>

        <Text style={styles.title}>T-Invest</Text>
        <Text style={styles.subtitle}>
          Нужен токен «только чтение» — koshel сможет видеть портфель, но не совершать сделки.
        </Text>

        <View style={styles.card}>
          <Text style={styles.step}>1. Откройте приложение T-Invest → Настройки</Text>
          <Text style={styles.step}>2. T-Invest API → Выпустить токен → «Только чтение»</Text>
          <Text style={styles.step}>3. Скопируйте токен (показывается один раз)</Text>
          <Text style={styles.step}>
            4. Вставьте ниже и нажмите «Подключить»
          </Text>
          <TouchableOpacity
            onPress={() => void Linking.openURL('https://developer.tbank.ru/invest/intro/intro/token')}
          >
            <Text style={styles.link}>Инструкция на сайте T-Bank →</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Read-only токен</Text>
        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setToken}
          placeholder="t.xxxxx…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          editable={!isConnecting}
        />
        <Text style={styles.hint}>
          Токен хранится на сервере koshel (Supabase), не в приложении. Можно отозвать в T-Invest в
          любой момент.
        </Text>

        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Покупки и продажи акций не попадают в «Расходы» — только дивиденды и комиссии. Сами
            бумаги появятся в «Капитале».
          </Text>
        </View>

        <Button
          label="Подключить и синхронизировать"
          onPress={() => void handleConnect()}
          loading={isConnecting}
          disabled={isConnecting}
          style={{ marginTop: 20 }}
        />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
