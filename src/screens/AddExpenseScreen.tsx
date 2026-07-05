import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { KeyboardAwareScrollView } from '../components/ui/KeyboardAwareScrollView';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { Input } from '../components/ui/Input';
import { QuickActionTile } from '../components/ui/QuickActionTile';
import { SectionLabel } from '../components/ui/SectionLabel';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants/categories';
import { Category, IncomeCategory, TransactionKind, TransactionSource } from '../types';
import { hasSupabase, supabase } from '../lib/supabase';
import { formatTransactionSaveError, getReadableErrorMessage } from '../lib/apiErrors';
import { TimeoutError, withOneRetry, withTimeout } from '../lib/asyncUtils';
import { appendTransactionToDashboardCache } from '../lib/dashboardCache';
import { insertTransaction } from '../lib/transactions';
import { formatMoney } from '../lib/formatMoney';
import { parseVoiceLocally } from '../lib/voiceParseFallback';
import { prepareReceiptImageBase64 } from '../lib/receiptImage';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { moneyText, spacing, typography } from '../theme/layout';
import { useThemedStyles } from '../theme/useThemedStyles';
import { AutoDismissToast } from '../components/ui/AutoDismissToast';

type AddExpenseScreenProps = {
  lockedKind?: TransactionKind;
  embedded?: boolean;
  firstExpenseCue?: boolean;
};

const categories = EXPENSE_CATEGORIES;
const incomeCategories = INCOME_CATEGORIES;

type ReceiptItem = { name: string; price: number };

// In Expo Go / some simulators this native module may be unavailable.
let SpeechRecognitionModule: any = null;
try {
  SpeechRecognitionModule = require('expo-speech-recognition')?.ExpoSpeechRecognitionModule ?? null;
} catch {
  SpeechRecognitionModule = null;
}

export function AddExpenseScreen({
  lockedKind,
  embedded = false,
  firstExpenseCue = false,
}: AddExpenseScreenProps = {}) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      receiptOverlay: {
        flex: 1,
        backgroundColor: c.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      },
      receiptOverlayCard: {
        backgroundColor: c.surface,
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        minWidth: 260,
        shadowColor: c.shadow,
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
      },
      receiptOverlayTitle: {
        marginTop: 16,
        fontSize: 17,
        fontWeight: '700',
        color: c.text,
        textAlign: 'center',
      },
      receiptOverlayHint: {
        marginTop: 8,
        fontSize: 14,
        color: c.textMuted,
        textAlign: 'center',
        lineHeight: 20,
      },
      scroll: { flex: 1 },
      contentContainer: { padding: spacing.xl, paddingBottom: 48 },
      kindToggle: {
        flexDirection: 'row',
        backgroundColor: c.backgroundDeep,
        borderRadius: radii.lg,
        padding: 4,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      kindOption: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: radii.sm,
        alignItems: 'center',
      },
      kindOptionActive: {
        backgroundColor: c.surface,
        ...shadows.soft,
      },
      kindOptionActiveIncome: {
        borderWidth: 1,
        borderColor: c.incomeMuted,
      },
      kindOptionActiveExpense: {
        borderWidth: 1,
        borderColor: c.expenseMuted,
      },
      kindOptionText: {
        fontSize: 15,
        fontWeight: '600',
        color: c.textMuted,
      },
      kindOptionTextActive: {
        fontWeight: '800',
      },
      kindOptionTextActiveIncome: {
        color: c.incomeDark,
      },
      kindOptionTextActiveExpense: {
        color: c.expenseDark,
      },
      header: {
        ...typography.h1,
        color: c.text,
        letterSpacing: -0.6,
        marginBottom: 4,
      },
      headerHint: {
        ...typography.body,
        color: c.textMuted,
        marginBottom: spacing.lg,
        lineHeight: 21,
      },
      kindBanner: {
        borderRadius: radii.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
      },
      kindBannerIncome: {
        backgroundColor: c.incomeSoft,
        borderColor: c.incomeMuted,
      },
      kindBannerExpense: {
        backgroundColor: c.expenseSoft,
        borderColor: c.expenseMuted,
      },
      kindBannerText: {
        ...typography.overline,
        letterSpacing: 1.2,
      },
      kindBannerTextIncome: { color: c.incomeDark },
      kindBannerTextExpense: { color: c.expenseDark },
      formCard: {
        backgroundColor: c.surface,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: c.borderLight,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        gap: spacing.md,
        ...shadows.soft,
      },
      chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
      },
      voiceHint: {
        ...typography.meta,
        color: c.textMuted,
        lineHeight: 19,
        marginBottom: spacing.md,
        textAlign: 'center',
      },
      voiceStatusCard: {
        backgroundColor: c.surfaceMuted,
        borderRadius: radii.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      voiceStatusTitle: {
        color: c.text,
        fontWeight: '700',
        fontSize: 14,
        marginBottom: 6,
      },
      voiceTranscript: {
        color: c.textSecondary,
        fontSize: 15,
        fontStyle: 'italic',
        marginBottom: 6,
      },
      voicePreviewText: {
        fontSize: 20,
        fontWeight: '800',
        color: c.text,
        ...moneyText,
      },
      firstExpenseBanner: {
        backgroundColor: c.accentSoft,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: c.accent,
        padding: spacing.md,
        marginBottom: spacing.lg,
      },
      firstExpenseTitle: {
        ...typography.bodyLg,
        color: c.text,
        marginBottom: 4,
      },
      firstExpenseHint: {
        ...typography.meta,
        color: c.textMuted,
        lineHeight: 18,
      },
      actionsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
      amountInput: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -0.5,
        ...moneyText,
      },
      field: { marginBottom: spacing.lg },
      label: {
        ...typography.meta,
        color: c.textSecondary,
        marginBottom: spacing.sm,
        fontWeight: '700',
      },
      input: {
        backgroundColor: c.surfaceMuted,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: c.borderLight,
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
        fontSize: 16,
        color: c.text,
      },
      textArea: { minHeight: 96, textAlignVertical: 'top' as const },
      pillRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
      categoryPill: {
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radii.pill,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: c.surface,
      },
      categoryPillActiveExpense: { backgroundColor: c.expense, borderColor: c.expense },
      pillText: { color: c.textSecondary, fontWeight: '600' as const },
      pillTextActive: { color: c.textOnAccent },
      primaryButton: {
        flex: 1,
        backgroundColor: c.expense,
        borderRadius: radii.lg,
        paddingVertical: 16,
        alignItems: 'center',
      },
      secondaryButton: {
        flex: 1,
        backgroundColor: c.surface,
        borderRadius: radii.lg,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      buttonText: { color: c.textOnAccent, fontWeight: '700' as const },
      buttonTextSecondary: { color: c.expenseDark, fontWeight: '700' as const },
      saveButton: {
        borderRadius: radii.lg,
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: c.expense,
      },
      saveText: { color: c.textOnAccent, fontWeight: '700' as const },
      itemRow: { flexDirection: 'row' as const, gap: spacing.sm, marginBottom: spacing.sm },
      itemName: { flex: 1 },
      itemPrice: { width: 110 },
      cameraWrap: { flex: 1, padding: 20, backgroundColor: c.background },
      cameraTitle: { fontSize: 22, fontWeight: '800', marginBottom: 14, color: c.text },
      cameraBox: {
        flex: 1,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: '#000',
      },
      cameraActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
      totalText: { fontSize: 28, fontWeight: '900', color: c.text, marginTop: 4 },
    })
  );

  const [entryKind, setEntryKind] = useState<TransactionKind>(lockedKind ?? 'expense')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<Category>('Продукты')
  const [incomeCategory, setIncomeCategory] = useState<IncomeCategory>('Зарплата')
  const [isSaving, setIsSaving] = useState(false)
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const saveInFlightRef = useRef(false)
  const formScrollRef = useRef<ScrollView>(null)

  const scrollFocusedFieldIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      formScrollRef.current?.scrollToEnd({ animated: true })
    })
  }, [])

  // Modes: form -> voice parse -> form, or form -> camera -> receipt review -> save.
  const [mode, setMode] = useState<'form' | 'camera' | 'receiptReview'>('form')
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'processing' | 'ready'>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [voicePreview, setVoicePreview] = useState<{
    sum: number;
    category: Category;
    note: string;
  } | null>(null)
  const [isProcessingAi, setIsProcessingAi] = useState(false)
  const lastTranscriptRef = useRef('')
  const isParsingTranscriptRef = useRef(false)
  const voiceStatusRef = useRef(voiceStatus)

  const isListening = voiceStatus === 'listening'

  useEffect(() => {
    voiceStatusRef.current = voiceStatus
  }, [voiceStatus])

  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [isCameraReady, setIsCameraReady] = useState(false)

  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([])
  const [receiptCategory, setReceiptCategory] = useState<Category>('Другое')
  const [receiptNote, setReceiptNote] = useState('')
  const [entrySource, setEntrySource] = useState<TransactionSource>('manual')
  const [receiptStep, setReceiptStep] = useState<'photo' | 'compress' | 'upload' | null>(null)

  const receiptTotal = useMemo(
    () => receiptItems.reduce((sum, i) => sum + (Number.isFinite(i.price) ? i.price : 0), 0),
    [receiptItems]
  )

  const speech = SpeechRecognitionModule as any
  const isSpeechAvailable = Boolean(speech?.start && speech?.stop && speech?.requestPermissionsAsync)

  const ensureSupabase = () => {
    if (!hasSupabase || !supabase) {
      Alert.alert(
        'Ошибка',
        'Supabase не настроен. Скопируйте .env.example в .env и заполните SUPABASE_URL и SUPABASE_ANON_KEY.'
      )
      return false
    }
    return true
  }

  const switchEntryKind = (next: TransactionKind) => {
    setEntryKind(next)
    setVoicePreview(null)
    setVoiceStatus('idle')
    setMode('form')
    setEntrySource('manual')
  }

  const handleSave = async (payload?: {
    amount?: number;
    category?: string;
    note?: string;
    source?: TransactionSource;
    kind?: TransactionKind;
  }) => {
    const value = payload?.amount ?? Number(amount.replace(',', '.'))
    if (!value || value <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму.')
      return
    }

    if (!ensureSupabase() || !supabase) return
    if (saveInFlightRef.current) return

    saveInFlightRef.current = true
    setIsSaving(true)
    try {
      const date = new Date().toISOString().slice(0, 10)
      const saveKind = payload?.kind ?? entryKind
      const saveCategory =
        payload?.category ?? (saveKind === 'income' ? incomeCategory : category)
      const saveNote = payload?.note ?? note
      const title =
        saveNote.trim() ||
        (saveKind === 'income' ? `${saveCategory}` : `${saveCategory} расход`)
      const saveSource = saveKind === 'income' ? 'manual' : (payload?.source ?? entrySource)

      const saved = await insertTransaction({
        title,
        amount: value,
        category: saveCategory,
        note: saveNote,
        date,
        source: saveSource,
        kind: saveKind,
      })

      if (user?.id) {
        await appendTransactionToDashboardCache(user.id, saved)
      }

      setEntrySource('manual')
      setAmount('')
      setNote('')
      setCategory('Продукты')
      setVoicePreview(null)
      setVoiceStatus('idle')
      setMode('form')
      setSaveToast(saveKind === 'income' ? 'Доход сохранён' : 'Расход сохранён')
    } catch (e) {
      const message = formatTransactionSaveError(
        e,
        entryKind === 'income' ? 'Не удалось сохранить доход.' : 'Не удалось сохранить расход.'
      )
      Alert.alert('Ошибка сохранения', message)
    } finally {
      saveInFlightRef.current = false
      setIsSaving(false)
    }
  }

  const applyVoiceResult = useCallback((sum: number, nextCategory: Category, noteText: string) => {
    setAmount(String(sum))
    setCategory(nextCategory)
    setNote(noteText)
    setEntrySource('voice')
    setVoicePreview({ sum, category: nextCategory, note: noteText })
    setVoiceStatus('ready')
    setMode('form')
  }, [])

  const handleTranscript = useCallback(
    async (transcript: string) => {
      const phrase = transcript.trim()
      if (!phrase || isParsingTranscriptRef.current) return
      if (!ensureSupabase() || !supabase) return

      isParsingTranscriptRef.current = true
      setVoiceStatus('processing')
      setIsProcessingAi(true)
      setVoicePreview(null)
      setLiveTranscript(phrase)

      const applyFromCloud = (data: unknown) => {
        if (!(data as { ok?: boolean })?.ok) return false
        const sum = Number((data as { sum?: number })?.sum)
        const nextCategoryRaw = (data as { category?: string })?.category
        const nextCategory = categories.includes(nextCategoryRaw as Category)
          ? (nextCategoryRaw as Category)
          : ('Другое' as Category)
        const noteText = String((data as { note?: string })?.note ?? phrase).trim()
        if (!Number.isFinite(sum) || sum <= 0) return false
        applyVoiceResult(sum, nextCategory, noteText || phrase)
        return true
      }

      const local = parseVoiceLocally(phrase)
      if (local) {
        applyVoiceResult(local.sum, local.category, local.note)
        setIsProcessingAi(false)
        isParsingTranscriptRef.current = false
        return
      }

      try {
        const { data, error } = await withTimeout(
          supabase.functions.invoke('voice-to-expense', {
            body: { transcript: phrase },
          }),
          12_000,
          'Сервер не ответил вовремя'
        )
        if (error) throw error
        if (applyFromCloud(data)) return

        Alert.alert(
          'Не понял фразу',
          'Назовите сумму цифрами, например: «кофе 350» или «такси 890 рублей». Можно поправить поля вручную.'
        )
        setVoiceStatus('idle')
      } catch (e) {
        const timedOut = e instanceof TimeoutError
        Alert.alert(
          timedOut ? 'Долго ждём ответ' : 'Ошибка распознавания',
          timedOut
            ? 'Попробуйте фразу с цифрами («кофе 350») или введите расход вручную.'
            : 'Не удалось связаться с сервером. Проверьте интернет или введите расход вручную.'
        )
        setVoiceStatus('idle')
      } finally {
        setIsProcessingAi(false)
        isParsingTranscriptRef.current = false
      }
    },
    [applyVoiceResult, categories, ensureSupabase]
  )

  const speechListenersRef = useRef<Array<{ remove?: () => void }>>([])

  const removeSpeechListeners = useCallback(() => {
    speechListenersRef.current.forEach((sub) => sub?.remove?.())
    speechListenersRef.current = []
  }, [])

  const ensureSpeechListeners = useCallback(() => {
    if (!isSpeechAvailable || typeof speech?.addListener !== 'function') return
    if (speechListenersRef.current.length > 0) return

    try {
      const resultSub = speech.addListener('result', (event: any) => {
        const transcript = typeof event?.results?.[0]?.transcript === 'string' ? event.results[0].transcript : ''
        if (!transcript.trim()) return

        const trimmed = transcript.trim()
        lastTranscriptRef.current = trimmed
        setLiveTranscript(trimmed)

        const localPreview = parseVoiceLocally(trimmed)
        if (localPreview) {
          setVoicePreview(localPreview)
        }

        if (event?.isFinal) {
          if (isParsingTranscriptRef.current) return
          setVoiceStatus('processing')
          speech.stop?.()
          void handleTranscript(trimmed)
          return
        }

        if (localPreview && trimmed.length >= 4 && !isParsingTranscriptRef.current) {
          setVoiceStatus('processing')
          speech.stop?.()
          void handleTranscript(trimmed)
        }
      })

      const errorSub = speech.addListener('error', (event: any) => {
        setVoiceStatus('idle')
        setLiveTranscript('')
        const code = event?.error
        if (code === 'no-speech') {
          Alert.alert('Не слышу', 'Повторите фразу чуть громче.')
        } else if (code !== 'aborted') {
          Alert.alert('Голос', 'Не удалось распознать речь. Попробуйте ещё раз.')
        }
      })

      const endSub = speech.addListener('end', () => {
        if (isParsingTranscriptRef.current) return
        const pending = lastTranscriptRef.current.trim()
        if (pending && voiceStatusRef.current === 'listening') {
          setVoiceStatus('processing')
          void handleTranscript(pending)
        } else if (voiceStatusRef.current === 'listening') {
          setVoiceStatus('idle')
        }
      })

      speechListenersRef.current = [resultSub, errorSub, endSub].filter(Boolean)
    } catch (e) {
      console.warn('Speech listeners setup failed', e)
    }
  }, [handleTranscript, isSpeechAvailable, speech])

  useEffect(() => () => removeSpeechListeners(), [removeSpeechListeners])

  const startVoice = async () => {
    if (!isSpeechAvailable) {
      Alert.alert(
        'Голос недоступен',
        'В текущей сборке отсутствует нативный модуль распознавания речи. Продолжайте через ручной ввод или скан чека.'
      )
      return
    }

    if (!ensureSupabase()) return
    try {
      const perm = await speech.requestPermissionsAsync?.()
      if (!perm?.granted) {
        Alert.alert('Нет доступа', 'Разрешите доступ к микрофону и распознаванию речи в настройках iPhone.')
        return
      }
    } catch (e) {
      const message = getReadableErrorMessage(e, 'Не удалось получить разрешения.')
      Alert.alert('Ошибка разрешений', message)
      return
    }

    const start = speech.start
    if (typeof start !== 'function') {
      Alert.alert('Ошибка', 'SpeechRecognition API недоступен в этой сборке.')
      return
    }
    try {
      ensureSpeechListeners()
      setVoicePreview(null)
      setLiveTranscript('')
      lastTranscriptRef.current = ''
      setVoiceStatus('listening')
      start.call(speech, {
        lang: 'ru-RU',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
      })
    } catch (e) {
      setVoiceStatus('idle')
      const message = getReadableErrorMessage(e, 'Ошибка запуска голосового ввода.')
      Alert.alert('Ошибка', message)
    }
  }

  const stopVoice = async () => {
    try {
      speech.stop?.()
    } catch {
      // ignore
    } finally {
      if (voiceStatusRef.current === 'listening') {
        const pending = lastTranscriptRef.current.trim()
        if (pending) {
          void handleTranscript(pending)
        } else {
          setVoiceStatus('idle')
        }
      }
    }
  }

  const toggleVoice = () => {
    if (isListening) {
      void stopVoice()
      return
    }
    void startVoice()
  }

  const startCameraFlow = async () => {
    try {
      if (!cameraPermission?.granted) {
        const res = await requestCameraPermission()
        if (!res?.granted) {
          Alert.alert('Нет доступа к камере', 'Разрешите доступ к камере в настройках устройства.')
          return
        }
      }
      setIsCameraReady(false)
      setMode('camera')
    } catch (e) {
      const message = getReadableErrorMessage(e, 'Не удалось открыть камеру.')
      Alert.alert('Ошибка', message)
    }
  }

  const captureAndAnalyzeReceipt = async () => {
    if (!cameraRef.current) return
    if (!isCameraReady) {
      Alert.alert('Подождите', 'Камера ещё запускается. Попробуйте через секунду.')
      return
    }
    if (!ensureSupabase() || !supabase) return
    const client = supabase

    setIsProcessingAi(true)
    setReceiptStep('photo')
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 0.72,
        skipProcessing: true,
      })

      if (!photo?.uri) {
        Alert.alert('Ошибка', 'Не удалось сохранить фото чека.')
        return
      }

      setReceiptStep('compress')
      const imageBase64 = await prepareReceiptImageBase64(photo.uri)

      setReceiptStep('upload')
      const { data, error } = await withOneRetry(async () =>
        client.functions.invoke('receipt-ocr', {
          body: { imageBase64 },
        })
      )
      if (error) throw error

      const ok = (data as any)?.ok
      if (!ok) {
        const reason = (data as any)?.reason ?? (data as any)?.error ?? 'ocr_failed'
        throw new Error(`OCR/распознавание не удалось (${reason}).`)
      }

      const itemsRaw = Array.isArray((data as any)?.items) ? (data as any).items : []
      const nextItems: ReceiptItem[] = itemsRaw
        .map((it: any) => ({ name: String(it?.name ?? '').trim(), price: Number(it?.price) }))
        .filter((it: ReceiptItem) => it.name.length > 0 && Number.isFinite(it.price))

      if (nextItems.length === 0) {
        throw new Error('Не удалось извлечь позиции чека.')
      }

      const nextCategoryRaw = (data as any)?.category
      const nextCategory = categories.includes(nextCategoryRaw as Category)
        ? (nextCategoryRaw as Category)
        : ('Другое' as Category)

      setReceiptItems(nextItems)
      setReceiptCategory(nextCategory)
      setReceiptNote(
        `Чек: ${nextItems
          .slice(0, 4)
          .map((i) => `${i.name} ${i.price}₽`)
          .join(', ')}${nextItems.length > 4 ? '...' : ''}`
      )
      setMode('receiptReview')
    } catch (e) {
      const message = getReadableErrorMessage(e, 'Не удалось распознать чек.')
      Alert.alert('Ошибка распознавания', message)
      setMode('form')
    } finally {
      setIsProcessingAi(false)
      setReceiptStep(null)
    }
  }

  const receiptProgressLabel =
    receiptStep === 'photo'
      ? 'Делаем снимок…'
      : receiptStep === 'compress'
        ? 'Сжимаем фото…'
        : receiptStep === 'upload'
          ? 'Распознаём чек…'
          : 'Обработка…'

  const handleReceiptItemChange = (idx: number, patch: Partial<ReceiptItem>) => {
    setReceiptItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const showKindToggle = !lockedKind
  const showHeader = !embedded || lockedKind === 'income'
  const isNested = embedded || Boolean(lockedKind)
  const Root = isNested ? View : SafeAreaView
  const rootProps = isNested
    ? { style: { flex: 1 } }
    : { style: styles.safeArea, edges: ['top', 'left', 'right'] as const }

  return (
    <Root {...rootProps}>
      <Modal visible={isProcessingAi && receiptStep != null} transparent animationType="fade">
        <View style={styles.receiptOverlay}>
          <View style={styles.receiptOverlayCard}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.receiptOverlayTitle}>{receiptProgressLabel}</Text>
            <Text style={styles.receiptOverlayHint}>
              {receiptStep === 'upload' ? 'Обычно 5–15 секунд' : 'Подготовка фото…'}
            </Text>
          </View>
        </View>
      </Modal>

      {mode === 'form' && (
        <KeyboardAwareScrollView
          ref={formScrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.contentContainer,
            embedded && { paddingTop: 0 },
          ]}
          keyboardBottomPadding={120}
        >
          {showKindToggle ? (
            <View style={styles.kindToggle}>
              <TouchableOpacity
                style={[
                  styles.kindOption,
                  entryKind === 'expense' && styles.kindOptionActive,
                  entryKind === 'expense' && styles.kindOptionActiveExpense,
                ]}
                onPress={() => switchEntryKind('expense')}
              >
                <Text
                  style={[
                    styles.kindOptionText,
                    entryKind === 'expense' && styles.kindOptionTextActive,
                    entryKind === 'expense' && styles.kindOptionTextActiveExpense,
                  ]}
                >
                  Расход
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.kindOption,
                  entryKind === 'income' && styles.kindOptionActive,
                  entryKind === 'income' && styles.kindOptionActiveIncome,
                ]}
                onPress={() => switchEntryKind('income')}
              >
                <Text
                  style={[
                    styles.kindOptionText,
                    entryKind === 'income' && styles.kindOptionTextActive,
                    entryKind === 'income' && styles.kindOptionTextActiveIncome,
                  ]}
                >
                  Доход
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {showHeader ? (
            <>
              <Text style={styles.header}>
                {entryKind === 'income' ? 'Новый доход' : 'Новый расход'}
              </Text>
              <Text style={styles.headerHint}>
                {entryKind === 'income'
                  ? 'Зарплата, подработка и другие поступления'
                  : 'Голос, чек или ручной ввод'}
              </Text>
            </>
          ) : lockedKind ? (
            <View
              style={[
                styles.kindBanner,
                entryKind === 'income' ? styles.kindBannerIncome : styles.kindBannerExpense,
              ]}
            >
              <Text
                style={[
                  styles.kindBannerText,
                  entryKind === 'income' ? styles.kindBannerTextIncome : styles.kindBannerTextExpense,
                ]}
              >
                {entryKind === 'income' ? 'Поступление' : 'Расход'}
              </Text>
            </View>
          ) : null}

          {firstExpenseCue ? (
            <View style={styles.firstExpenseBanner}>
              <Text style={styles.firstExpenseTitle}>Добавьте первую трату</Text>
              <Text style={styles.firstExpenseHint}>
                Назовите сумму голосом, отсканируйте чек или введите вручную — так заработает аналитика на
                главной.
              </Text>
            </View>
          ) : null}

          {entryKind === 'expense' ? (
            <>
              <View style={styles.actionsRow}>
                <QuickActionTile
                  icon="mic-outline"
                  label={
                    !isSpeechAvailable
                      ? 'Голос недоступен'
                      : isListening
                        ? 'Стоп'
                        : isProcessingAi
                          ? 'Обработка…'
                          : 'Голос'
                  }
                  onPress={toggleVoice}
                  active={isListening}
                  disabled={!isSpeechAvailable || isProcessingAi}
                />
                <QuickActionTile
                  icon="scan-outline"
                  label="Скан чека"
                  onPress={startCameraFlow}
                  disabled={isProcessingAi || isListening}
                />
              </View>

              <Text style={styles.voiceHint}>
                Скажите: «кофе 350», «такси 890», «в Пятёрочке 2 500»
              </Text>
            </>
          ) : null}

          {entryKind === 'expense' && (voiceStatus !== 'idle' || liveTranscript.length > 0 || voicePreview) && (
            <View style={styles.voiceStatusCard}>
              <Text style={styles.voiceStatusTitle}>
                {voiceStatus === 'listening'
                  ? 'Слушаю…'
                  : voiceStatus === 'processing'
                    ? 'Понимаю фразу…'
                    : voicePreview
                      ? 'Готово — проверьте и сохраните'
                      : 'Голос'}
              </Text>
              {liveTranscript ? <Text style={styles.voiceTranscript}>«{liveTranscript}»</Text> : null}
              {voicePreview ? (
                <Text style={styles.voicePreviewText}>
                  {formatMoney(voicePreview.sum)} · {voicePreview.category}
                </Text>
              ) : null}
            </View>
          )}

          <View style={styles.formCard}>
            <SectionLabel>Сумма и категория</SectionLabel>

            <Input
              label="Сумма, ₽"
              placeholder="0"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              style={styles.amountInput}
            />

            <View>
              <Text style={styles.label}>Категория</Text>
              <View style={styles.chipRow}>
                {(entryKind === 'income' ? incomeCategories : categories).map((item) => {
                  const selected =
                    entryKind === 'income' ? incomeCategory === item : category === item;
                  return (
                    <Chip
                      key={item}
                      label={item}
                      active={selected}
                      variant={entryKind === 'income' ? 'income' : 'expense'}
                      onPress={() =>
                        entryKind === 'income'
                          ? setIncomeCategory(item as IncomeCategory)
                          : setCategory(item as Category)
                      }
                    />
                  );
                })}
              </View>
            </View>

            <Input
              label={entryKind === 'income' ? 'Описание' : 'Заметка'}
              placeholder={
                entryKind === 'income' ? 'Например, зарплата за май' : 'Например, обед с коллегами'
              }
              value={note}
              onChangeText={setNote}
              multiline
              style={styles.textArea}
              onFocus={scrollFocusedFieldIntoView}
            />
          </View>

          <Button
            label={
              isSaving
                ? 'Сохраняю…'
                : entryKind === 'income'
                  ? 'Сохранить доход'
                  : 'Сохранить расход'
            }
            variant={entryKind === 'income' ? 'income' : 'expense'}
            onPress={() => void handleSave()}
            loading={isSaving}
            disabled={isSaving || isProcessingAi}
          />
        </KeyboardAwareScrollView>
      )}

      {mode === 'camera' && (
        <View style={styles.cameraWrap}>
          <Text style={styles.cameraTitle}>Сканирование чека</Text>
          <View style={styles.cameraBox}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              ratio="16:9"
              onCameraReady={() => setIsCameraReady(true)}
            />
          </View>

          <View style={styles.cameraActions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => void captureAndAnalyzeReceipt()}
              disabled={isProcessingAi || !isCameraReady}
            >
              <Text style={styles.buttonText}>{isCameraReady ? 'Снять' : 'Камера...'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode('form')} disabled={isProcessingAi}>
              <Text style={styles.buttonTextSecondary}>Назад</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {mode === 'receiptReview' && (
        <KeyboardAwareScrollView
          ref={formScrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.contentContainer}
          keyboardBottomPadding={120}
        >
          <Text style={styles.header}>Подтверждение чека</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Позиции</Text>
            <View>
              {receiptItems.map((it, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <TextInput
                    style={[styles.input, styles.itemName]}
                    value={it.name}
                    onChangeText={(t) => handleReceiptItemChange(idx, { name: t })}
                    placeholder={`Позиция ${idx + 1}`}
                    onFocus={scrollFocusedFieldIntoView}
                  />
                  <TextInput
                    style={[styles.input, styles.itemPrice]}
                    keyboardType="numeric"
                    value={String(it.price)}
                    onChangeText={(t) => handleReceiptItemChange(idx, { price: Number(t.replace(',', '.')) })}
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Категория</Text>
            <View style={styles.pillRow}>
              {categories.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.categoryPill, receiptCategory === item && styles.categoryPillActiveExpense]}
                  onPress={() => setReceiptCategory(item)}
                >
                  <Text style={[styles.pillText, receiptCategory === item && styles.pillTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Итого</Text>
            <Text style={styles.totalText}>{formatMoney(receiptTotal)}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Заметка</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Комментарий к расходу"
              value={receiptNote}
              onChangeText={setReceiptNote}
              multiline
              onFocus={scrollFocusedFieldIntoView}
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() =>
              void handleSave({
                amount: receiptTotal,
                category: receiptCategory,
                note: receiptNote,
                source: 'receipt',
                kind: 'expense',
              })
            }
            disabled={isSaving || isProcessingAi}
          >
            <Text style={styles.saveText}>{isSaving ? 'Сохраняю...' : 'Сохранить расход'}</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      )}

      <AutoDismissToast message={saveToast} onHide={() => setSaveToast(null)} />
    </Root>
  )
}
