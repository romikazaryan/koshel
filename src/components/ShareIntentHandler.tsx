import { useLayoutEffect, useRef } from 'react';
import { useShareIntentContext } from 'expo-share-intent';
import { usePendingQuickCapture } from '../contexts/PendingQuickCaptureContext';
import { useSharedStatement } from '../contexts/SharedStatementContext';
import { isLikelyBankPushText, parseBankPushNotification } from '../lib/bankPushNotification';
import {
  detectAccountKindFromFileName,
  detectBankFromFileName,
  isSharedStatementFile,
} from '../lib/sharedBankStatement';
import { getProviderDefinition } from '../types/financialConnections';

/**
 * Обрабатывает «Поделиться»: PDF/CSV выписки и текст пуша банка.
 */
export function ShareIntentHandler() {
  const { isReady, hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { setPending } = useSharedStatement();
  const { setPending: setQuickCapturePending } = usePendingQuickCapture();
  const handledKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!isReady || !hasShareIntent) return;

    try {
      const file = shareIntent.files?.[0];
      if (file?.path) {
        const fileName = file.fileName?.trim() || 'выписка.pdf';
        const dedupeKey = `file:${file.path}|${fileName}|${file.size ?? 0}`;
        if (handledKeyRef.current === dedupeKey) return;
        handledKeyRef.current = dedupeKey;

        if (!isSharedStatementFile(fileName, file.mimeType)) {
          resetShareIntent();
          return;
        }

        const providerId = detectBankFromFileName(fileName);
        const provider = providerId ? getProviderDefinition(providerId) : undefined;

        setPending({
          uri: file.path,
          fileName,
          mimeType: file.mimeType,
          providerId: provider?.id,
          providerName: provider?.name,
          initialAccountKind: detectAccountKindFromFileName(fileName),
        });

        resetShareIntent();
        return;
      }

      const sharedText =
        (typeof shareIntent.text === 'string' ? shareIntent.text : '') ||
        (typeof (shareIntent as { meta?: { title?: string } }).meta?.title === 'string'
          ? (shareIntent as { meta?: { title?: string } }).meta?.title
          : '') ||
        '';

      const text = sharedText.trim();
      if (!text) {
        resetShareIntent();
        return;
      }

      const dedupeKey = `text:${text.slice(0, 120)}`;
      if (handledKeyRef.current === dedupeKey) return;
      handledKeyRef.current = dedupeKey;

      if (isLikelyBankPushText(text)) {
        const parsed = parseBankPushNotification(text);
        if (parsed) {
          setQuickCapturePending({
            amount: parsed.amount,
            kind: parsed.kind,
            title: parsed.title,
            category: parsed.category,
            source: 'share',
          });
          resetShareIntent();
          return;
        }
      }

      resetShareIntent();
    } catch (e) {
      console.warn('Share intent handler failed', e);
      resetShareIntent();
    }
  }, [isReady, hasShareIntent, shareIntent, resetShareIntent, setPending, setQuickCapturePending]);

  return null;
}
