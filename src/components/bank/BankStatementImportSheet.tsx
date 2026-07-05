import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop } from '../ui/BottomSheetBackdrop';
import { findOrCreateBankConnection, requestBankStatementImport } from '../../lib/financialConnections';
import { invalidateDashboardCache } from '../../lib/dashboardCache';
import {
  formatStatementReadError,
  parseBankStatementFile,
} from '../../lib/bankStatementFile';
import {
  accountKindImportHint,
  importRowCounts,
  rowsForImport,
  toBankStatementImportRows,
  type StatementCardKind,
  type StatementParseResult,
} from '../../lib/bankStatementImport';
import { SegmentedControl } from '../ui/SegmentedControl';
import { NavyShimmerPressable } from '../ui/NavyShimmerBackground';
import { useSwipeDownToClose } from '../../lib/useSwipeDownToClose';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  visible: boolean;
  providerId: string;
  providerName: string;
  connectionId?: string;
  initialFile?: { uri: string; fileName: string; mimeType?: string | null };
  initialAccountKind?: StatementCardKind;
  onClose: () => void;
  onImported: () => void;
};

function formatPreviewDate(date: string) {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}.${month}.${year}`;
}

function formatImportError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Не удалось импортировать';
}

function formatPreviewAmount(amount: number) {
  return `${Math.round(amount).toLocaleString('ru-RU')} ₽`;
}

function formatExcludedSample(
  sample: { title: string; amount: number; kind: string },
  formatAmount: (amount: number) => string
) {
  const sign = sample.kind === 'income' ? '+' : '−';
  return `${sign}${formatAmount(sample.amount)} · ${sample.title}`;
}

function formatPreviewMonth(ym: string) {
  const [year, month] = ym.split('-');
  const names = [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь',
  ];
  const idx = Number(month) - 1;
  return `${names[idx] ?? month} ${year}`;
}

function accountKindLabel(cardKind: StatementCardKind) {
  return cardKind === 'credit' ? 'Кредитная' : 'Дебетовая';
}

export function BankStatementImportSheet({
  visible,
  providerId,
  providerName,
  connectionId,
  initialFile,
  initialAccountKind,
  onClose,
  onImported,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { translateY, backdropOpacity, close, PanGestureHandler, panGestureProps } =
    useSwipeDownToClose(visible, onClose, { mode: 'header' });
  const [parsing, setParsing] = useState(false);
  const [parsingHint, setParsingHint] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<StatementParseResult | null>(null);
  const [accountKind, setAccountKind] = useState<StatementCardKind>('debit');
  const parsedFileKeyRef = useRef<string | null>(null);
  const parseRequestRef = useRef(0);

  const styles = useThemedStyles(({ colors: c, radii, cardBase }) =>
    StyleSheet.create({
      overlay: {
        flex: 1,
        justifyContent: 'flex-end',
      },
      dim: {
        ...StyleSheet.absoluteFill,
        backgroundColor: c.overlay,
      },
      sheet: {
        backgroundColor: c.surface,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        width: '100%',
        paddingBottom: Math.max(insets.bottom, 12),
      },
      handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: c.border,
        marginTop: 10,
        marginBottom: 8,
      },
      header: {
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.borderLight,
      },
      title: { fontSize: 20, fontWeight: '800', color: c.text, marginBottom: 4 },
      subtitle: { fontSize: 14, lineHeight: 20, color: c.textMuted },
      stack: {
        paddingHorizontal: 20,
        paddingTop: 16,
        gap: 10,
      },
      hint: {
        fontSize: 13,
        lineHeight: 19,
        color: c.textMuted,
      },
      accountKindBlock: {
        gap: 8,
      },
      accountKindLabel: { fontSize: 13, fontWeight: '600', color: c.textMuted },
      accountKindHint: {
        fontSize: 13,
        lineHeight: 19,
        color: c.textMuted,
      },
      pickBtn: {
        borderRadius: radii.md,
        paddingVertical: 14,
        minHeight: 48,
      },
      pickBtnText: { color: c.textOnAccent, fontWeight: '700', fontSize: 15 },
      previewCard: {
        ...cardBase,
        padding: 16,
        gap: 6,
      },
      previewMeta: { fontSize: 15, lineHeight: 22, color: c.textMuted },
      previewHighlight: { fontWeight: '700', color: c.text },
      previewMonthsHint: { fontSize: 13, lineHeight: 19, color: c.textMuted, marginTop: 2 },
      warningText: { fontSize: 13, lineHeight: 19, color: c.warning ?? c.textMuted },
      importBtn: {
        borderRadius: radii.md,
        paddingVertical: 14,
        minHeight: 48,
      },
      importBtnDisabled: { opacity: 0.6 },
      importBtnText: { color: c.textOnAccent, fontWeight: '700', fontSize: 15 },
      cancelBtn: {
        borderRadius: radii.md,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: c.border,
      },
      cancelBtnText: { color: c.text, fontWeight: '600', fontSize: 15 },
    })
  );

  const reset = useCallback(() => {
    setPreview(null);
    setParsing(false);
    setParsingHint(null);
    setImporting(false);
    setAccountKind(initialAccountKind ?? 'debit');
    parsedFileKeyRef.current = null;
    parseRequestRef.current += 1;
  }, [initialAccountKind]);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const parseFile = useCallback(
    async (file: { uri: string; fileName: string; mimeType?: string | null }) => {
      const requestId = parseRequestRef.current + 1;
      parseRequestRef.current = requestId;
      setParsing(true);
      setParsingHint(
        /\.pdf$/i.test(file.fileName) || file.mimeType === 'application/pdf'
          ? 'Читаем PDF…'
          : 'Разбираем файл…'
      );
      try {
        const parsed = await parseBankStatementFile({
          uri: file.uri,
          fileName: file.fileName,
          providerId,
          mimeType: file.mimeType,
        });
        if (parseRequestRef.current !== requestId) return;
        setPreview(parsed);
        if (parsed.detectedCardKind) {
          setAccountKind(parsed.detectedCardKind);
        } else if (initialAccountKind) {
          setAccountKind(initialAccountKind);
        }
      } catch (e) {
        if (parseRequestRef.current !== requestId) return;
        const message = formatStatementReadError(e);
        const title =
          /операци|CSV|PDF|выписк/i.test(message)
            ? 'Не удалось разобрать выписку'
            : 'Не удалось прочитать файл';
        Alert.alert(title, message);
      } finally {
        if (parseRequestRef.current === requestId) {
          setParsing(false);
          setParsingHint(null);
        }
      }
    },
    [providerId, initialAccountKind]
  );

  useEffect(() => {
    if (!visible || !initialFile) return;
    const key = `${initialFile.uri}|${initialFile.fileName}|${initialFile.mimeType ?? ''}`;
    if (parsedFileKeyRef.current === key) return;
    parsedFileKeyRef.current = key;
    void parseFile(initialFile);
  }, [visible, initialFile?.uri, initialFile?.fileName, initialFile?.mimeType, parseFile]);

  const pickFile = async () => {
    if (parsing || importing) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.ms-excel',
          'text/plain',
          'application/pdf',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      parsedFileKeyRef.current = `${asset.uri}|${asset.name ?? 'выписка.csv'}|${asset.mimeType ?? ''}`;
      await parseFile({
        uri: asset.uri,
        fileName: asset.name ?? 'выписка.csv',
        mimeType: asset.mimeType,
      });
    } catch (e) {
      const message = formatStatementReadError(e);
      const title =
        /операци|CSV|PDF|выписк/i.test(message)
          ? 'Не удалось разобрать выписку'
          : 'Не удалось прочитать файл';
      Alert.alert(title, message);
      setParsing(false);
      setParsingHint(null);
    }
  };

  const importContext = useMemo(
    () => ({ accountOwner: preview?.accountOwner ?? null }),
    [preview?.accountOwner]
  );

  const importStats = useMemo(() => {
    if (!preview) return null;
    const stats = importRowCounts(preview.rows, accountKind, importContext);
    const brokerSkipped = preview.skipped.length;
    return { ...stats, brokerSkipped, fileTotal: preview.rows.length + brokerSkipped };
  }, [preview, accountKind, importContext]);

  const detectedKindMismatch =
    preview?.detectedCardKind != null && preview.detectedCardKind !== accountKind;

  const handleImport = async () => {
    if (!preview || !importStats) return;

    if (detectedKindMismatch) {
      Alert.alert(
        'Неверный тип счёта',
        `В выписке похоже на ${accountKindLabel(preview.detectedCardKind!)} карту. Переключите тип счёта выше — иначе цифры будут неверными.`
      );
      return;
    }

    setImporting(true);
    try {
      const connection = await findOrCreateBankConnection({
        providerId,
        displayName: providerName,
        connectionId,
      });

      const rowsToSend = rowsForImport(preview.rows, accountKind, importContext);

      const result = await requestBankStatementImport({
        connectionId: connection.id,
        fileName: preview.fileName,
        accountKind,
        cardLast4: preview.cardLast4,
        accountOwner: preview.accountOwner ?? undefined,
        rows: toBankStatementImportRows(rowsToSend),
      });

      if (!result.ok) {
        Alert.alert('Импорт не удался', result.message);
        return;
      }

      if ((result.imported ?? 0) === 0) {
        Alert.alert(
          'Новых операций нет',
          result.message ??
            'Все операции из файла уже есть в приложении (дубликаты) или не прошли проверку.'
        );
        return;
      }

      const currentMonthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
      const monthHint =
        importStats.months.length > 0
          ? `\n\nОперации попадут в месяцы: ${importStats.months.map(formatPreviewMonth).join(', ')}. На главной переключите месяц, чтобы их увидеть.`
          : preview.dateFrom && preview.dateFrom < currentMonthStart
            ? '\n\nОперации за прошлые месяцы видны на главной после переключения месяца.'
            : '';
      const duplicateHint =
        (result.duplicates ?? 0) > 0
          ? `\n\n${result.duplicates} операций уже были в приложении и пропущены как дубликаты.`
          : '';
      const reconciledHint =
        (result.reconciled ?? 0) > 0
          ? `\n\n${result.reconciled} быстрых записей (голос/ручной) сверены с банком и скрыты из учёта.`
          : '';
      const summary = [
        result.message,
        `\n\nИз файла: ${importStats.expenseCount} расходов, ${importStats.incomeCount} доходов${
          importStats.refundCount > 0
            ? `, ${importStats.refundCount} возвратов покупок (уменьшат расходы)`
            : ''
        }`,
        duplicateHint,
        reconciledHint,
        monthHint,
      ].join('');
      Alert.alert('Готово', summary);
      await invalidateDashboardCache();
      onImported();
      onClose();
    } catch (e) {
      Alert.alert('Ошибка импорта', formatImportError(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="none" transparent presentationStyle="overFullScreen" onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }} pointerEvents="box-none">
      <View style={styles.overlay} pointerEvents="box-none">
        <BottomSheetBackdrop onPress={close} opacity={backdropOpacity} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <PanGestureHandler {...panGestureProps}>
            <View>
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text style={styles.title}>Банковская выписка</Text>
                <Text style={styles.subtitle}>
                  {providerName} · CSV или PDF — операции попадут в расходы и доходы
                </Text>
              </View>
            </View>
          </PanGestureHandler>

          <View style={styles.stack}>
            <View style={styles.accountKindBlock}>
              <Text style={styles.accountKindLabel}>Тип счёта в выписке</Text>
              <SegmentedControl
                options={[
                  { value: 'debit', label: 'Дебетовая' },
                  { value: 'credit', label: 'Кредитная' },
                ]}
                value={accountKind}
                onChange={setAccountKind}
                style={{ marginBottom: 0 }}
              />
              <Text style={styles.accountKindHint}>{accountKindImportHint(accountKind)}</Text>
            </View>

            <Text style={styles.hint}>
              {initialFile
                ? 'Файл получен через «Поделиться». Проверьте тип счёта и импортируйте операции.'
                : 'Скачайте выписку в личном кабинете банка (CSV или PDF с текстом, не скан).'}
            </Text>

            <NavyShimmerPressable
              style={styles.pickBtn}
              contentStyle={{ alignItems: 'center', justifyContent: 'center', minHeight: 48 }}
              onPress={() => void pickFile()}
              disabled={parsing || importing}
              glow="compact"
            >
              {parsing ? (
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <ActivityIndicator color={colors.textOnAccent} />
                  {parsingHint ? (
                    <Text style={[styles.pickBtnText, { fontSize: 12, fontWeight: '600' }]}>
                      {parsingHint}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.pickBtnText}>
                  {preview ? 'Выбрать другой файл' : 'Выбрать CSV или PDF'}
                </Text>
              )}
            </NavyShimmerPressable>

            {preview ? (
              <View style={styles.previewCard}>
                <Text style={styles.previewMeta}>
                  Счёт: <Text style={styles.previewHighlight}>{accountKindLabel(accountKind)}</Text>
                </Text>
                <Text style={styles.previewMeta}>
                  Банк: <Text style={styles.previewHighlight}>{providerName}</Text>
                </Text>
                {preview.dateFrom && preview.dateTo ? (
                  <Text style={styles.previewMeta}>
                    Период:{' '}
                    <Text style={styles.previewHighlight}>
                      {formatPreviewDate(preview.dateFrom)} — {formatPreviewDate(preview.dateTo)}
                    </Text>
                  </Text>
                ) : null}
                <Text style={styles.previewMeta}>
                  В файле:{' '}
                  <Text style={styles.previewHighlight}>{importStats?.fileTotal ?? preview.rows.length}</Text>
                  {' · '}
                  К импорту:{' '}
                  <Text style={styles.previewHighlight}>{importStats?.importCount ?? preview.rows.length}</Text>
                </Text>
                {importStats && importStats.importCount > 0 ? (
                  <Text style={styles.previewMeta}>
                    Расходы:{' '}
                    <Text style={styles.previewHighlight}>
                      {importStats.expenseCount} ({formatPreviewAmount(importStats.importExpenseTotal)})
                    </Text>
                    {' · '}
                    Доходы:{' '}
                    <Text style={styles.previewHighlight}>
                      {importStats.incomeCount} ({formatPreviewAmount(importStats.importIncomeTotal)})
                    </Text>
                    {importStats.refundCount > 0 ? (
                      <>
                        {' · '}
                        Возвраты:{' '}
                        <Text style={styles.previewHighlight}>
                          {importStats.refundCount} ({formatPreviewAmount(importStats.refundTotal)})
                        </Text>
                      </>
                    ) : null}
                  </Text>
                ) : null}
                {importStats && importStats.excludedCount > 0 ? (
                  <Text style={styles.previewMeta}>
                    Не импортируем {importStats.excludedCount}: {importStats.excludedLabel}
                  </Text>
                ) : null}
                {importStats && importStats.excludedSamples.length > 0 ? (
                  <Text style={styles.previewMonthsHint}>
                    Примеры исключённых:{' '}
                    {importStats.excludedSamples
                      .map((sample) => formatExcludedSample(sample, formatPreviewAmount))
                      .join(' · ')}
                  </Text>
                ) : null}
                {importStats && importStats.brokerSkipped > 0 ? (
                  <Text style={styles.previewMeta}>
                    Пропущено {importStats.brokerSkipped} (пополнение брокерского счёта)
                  </Text>
                ) : null}
                {preview.cardLast4 ? (
                  <Text style={styles.previewMeta}>
                    Карта: <Text style={styles.previewHighlight}>···{preview.cardLast4}</Text>
                  </Text>
                ) : null}
                {detectedKindMismatch ? (
                  <Text style={styles.warningText}>
                    В файле похоже на {accountKindLabel(preview.detectedCardKind!)} — проверьте тип
                    счёта выше, если цифры в превью кажутся неверными.
                  </Text>
                ) : null}
                {importStats && importStats.months.length > 0 ? (
                  <Text style={styles.previewMonthsHint}>
                    После импорта переключите на главной:{' '}
                    {importStats.months.map(formatPreviewMonth).join(', ')}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {preview ? (
              <NavyShimmerPressable
                style={[styles.importBtn, importing && styles.importBtnDisabled]}
                contentStyle={{ alignItems: 'center', justifyContent: 'center', minHeight: 48 }}
                onPress={() => void handleImport()}
                disabled={importing || (importStats?.importCount ?? 0) === 0 || detectedKindMismatch}
                glow="compact"
              >
                {importing ? (
                  <ActivityIndicator color={colors.textOnAccent} />
                ) : (
                  <Text style={styles.importBtnText}>
                    Импортировать {importStats?.importCount ?? preview.rows.length} операций
                  </Text>
                )}
              </NavyShimmerPressable>
            ) : null}

            <TouchableOpacity style={styles.cancelBtn} onPress={close} disabled={importing}>
              <Text style={styles.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
