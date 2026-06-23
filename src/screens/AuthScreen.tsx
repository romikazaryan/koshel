import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { normalizeRuPhoneE164 } from '../lib/phone';
import { FadeSlideIn } from '../components/animations/FadeSlideIn';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { KoshelLogo } from '../components/brand/KoshelLogo';
import { LOGO_SIZE } from '../components/brand/koshelLogoStyles';
import { useThemedStyles } from '../theme/useThemedStyles';

type AuthMethod = 'email' | 'phone';
type EmailMode = 'signIn' | 'signUp';
type PhoneStep = 'phone' | 'code';

export function AuthScreen() {
  const { signIn, signUp, sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: 'transparent' },
      container: { flexGrow: 1, padding: 24, paddingTop: 72, justifyContent: 'center' },
      logo: { marginBottom: 8, alignSelf: 'center' },
      subtitle: { fontSize: 16, color: c.textSecondary, marginBottom: 28 },
      tabs: {
        flexDirection: 'row',
        marginBottom: 16,
        backgroundColor: c.primarySoft,
        borderRadius: radii.md,
        padding: 4,
      },
      tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radii.sm },
      tabActive: { backgroundColor: c.surface, ...shadows.soft },
      tabText: { fontWeight: '600', color: c.textMuted },
      tabTextActive: { color: c.text, fontWeight: '700' },
      subTabs: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 8,
      },
      subTab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      },
      subTabActive: { borderColor: c.accent, backgroundColor: c.accentSoft },
      subTabText: { fontWeight: '600', color: c.textMuted, fontSize: 14 },
      subTabTextActive: { color: c.accentDark },
      field: { marginBottom: 16 },
      label: { fontSize: 13, color: c.textMuted, marginBottom: 8, fontWeight: '600' },
      hint: { marginTop: 8, fontSize: 12, color: c.textMuted, lineHeight: 18 },
      phoneSent: { fontSize: 14, color: c.textSecondary, marginBottom: 16 },
      otpInput: { letterSpacing: 4, textAlign: 'center', fontSize: 22, fontWeight: '700' },
    })
  );

  const [method, setMethod] = useState<AuthMethod>('email');
  const [emailMode, setEmailMode] = useState<EmailMode>('signIn');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('phone');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMethod = (next: AuthMethod) => {
    setMethod(next);
    setPhoneStep('phone');
    setOtpCode('');
    setPhoneE164(null);
  };

  const submitEmail = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Ошибка', 'Введите email и пароль.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен быть не короче 6 символов.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (emailMode === 'signIn') {
        await signIn(trimmedEmail, password);
      } else {
        const { needsEmailConfirmation } = await signUp(trimmedEmail, password);
        if (needsEmailConfirmation) {
          Alert.alert(
            'Проверьте почту',
            'Откройте ссылку из письма на этом iPhone — должно открыться приложение koshel. Если открывается пустая страница localhost — в Supabase настройте URL (см. docs/AUTH_SETUP.md) или отключите Confirm email.'
          );
          setEmailMode('signIn');
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось выполнить вход.';
      Alert.alert('Ошибка', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitPhoneOtpRequest = async () => {
    const normalized = phoneE164 ?? normalizeRuPhoneE164(phone);
    if (!normalized) {
      Alert.alert('Ошибка', 'Введите номер: 10 цифр, например 9001234567 или +79001234567.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPhoneOtp(normalized);
      setPhoneE164(normalized);
      setPhoneStep('code');
      Alert.alert('Код отправлен', 'Введите код из SMS.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось отправить SMS.';
      Alert.alert('Ошибка', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitPhoneVerify = async () => {
    if (!phoneE164) return;
    const code = otpCode.replace(/\D/g, '');
    if (code.length < 4) {
      Alert.alert('Ошибка', 'Введите код из SMS.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyPhoneOtp(phoneE164, code);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Неверный код.';
      Alert.alert('Ошибка', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtitle =
    method === 'email'
      ? emailMode === 'signIn'
        ? 'Войдите по email'
        : 'Регистрация по email'
      : phoneStep === 'phone'
        ? 'Войдите по номеру телефона'
        : 'Введите код из SMS';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
      >
        <FadeSlideIn delay={0} duration={520}>
          <KoshelLogo size={LOGO_SIZE.auth} style={styles.logo} />
        </FadeSlideIn>
        <FadeSlideIn delay={80}>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </FadeSlideIn>

        <FadeSlideIn delay={140}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, method === 'email' && styles.tabActive]}
            onPress={() => switchMethod('email')}
            disabled={isSubmitting}
          >
            <Text style={[styles.tabText, method === 'email' && styles.tabTextActive]}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, method === 'phone' && styles.tabActive]}
            onPress={() => switchMethod('phone')}
            disabled={isSubmitting}
          >
            <Text style={[styles.tabText, method === 'phone' && styles.tabTextActive]}>Телефон</Text>
          </TouchableOpacity>
        </View>
        </FadeSlideIn>

        {method === 'email' && (
          <FadeSlideIn delay={200}>
          <>
            <View style={styles.subTabs}>
              <TouchableOpacity
                style={[styles.subTab, emailMode === 'signIn' && styles.subTabActive]}
                onPress={() => setEmailMode('signIn')}
                disabled={isSubmitting}
              >
                <Text style={[styles.subTabText, emailMode === 'signIn' && styles.subTabTextActive]}>
                  Вход
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subTab, emailMode === 'signUp' && styles.subTabActive]}
                onPress={() => setEmailMode('signUp')}
                disabled={isSubmitting}
              >
                <Text style={[styles.subTabText, emailMode === 'signUp' && styles.subTabTextActive]}>
                  Регистрация
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <Input
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Пароль</Text>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType={emailMode === 'signIn' ? 'password' : 'newPassword'}
                placeholder="минимум 6 символов"
                editable={!isSubmitting}
              />
            </View>

            <Button
              label={emailMode === 'signIn' ? 'Войти' : 'Зарегистрироваться'}
              onPress={() => void submitEmail()}
              loading={isSubmitting}
              style={{ marginTop: 8 }}
            />
          </>
          </FadeSlideIn>
        )}

        {method === 'phone' && phoneStep === 'phone' && (
          <FadeSlideIn delay={200}>
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Номер телефона</Text>
              <Input
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                placeholder="9001234567"
                hint="Россия: +7 и 10 цифр. Код придёт в SMS."
                editable={!isSubmitting}
              />
            </View>

            <Button
              label="Получить код"
              onPress={() => void submitPhoneOtpRequest()}
              loading={isSubmitting}
              style={{ marginTop: 8 }}
            />
          </>
          </FadeSlideIn>
        )}

        {method === 'phone' && phoneStep === 'code' && (
          <FadeSlideIn delay={200}>
          <>
            <Text style={styles.phoneSent}>Код отправлен на {phoneE164}</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Код из SMS</Text>
              <Input
                style={styles.otpInput}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                placeholder="123456"
                maxLength={8}
                editable={!isSubmitting}
              />
            </View>

            <Button
              label="Войти"
              onPress={() => void submitPhoneVerify()}
              loading={isSubmitting}
              style={{ marginTop: 8 }}
            />

            <Button
              label="Изменить номер"
              variant="ghost"
              size="md"
              onPress={() => {
                setPhoneStep('phone');
                setOtpCode('');
              }}
              disabled={isSubmitting}
              style={{ marginTop: 10 }}
            />

            <Button
              label="Отправить код снова"
              variant="ghost"
              size="md"
              onPress={() => void submitPhoneOtpRequest()}
              disabled={isSubmitting}
              style={{ marginTop: 2 }}
            />
          </>
          </FadeSlideIn>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
