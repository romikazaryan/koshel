import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { usePendingQuickCapture } from '../contexts/PendingQuickCaptureContext';
import { appendTransactionToDashboardCache } from '../lib/dashboardCache';
import { insertTransaction } from '../lib/transactions';

type Props = {
  onSaved?: () => void;
};

export function PendingQuickCaptureHandler({ onSaved }: Props) {
  const { user } = useAuth();
  const { pending, consumePending } = usePendingQuickCapture();
  const handlingRef = useRef(false);

  useEffect(() => {
    if (!pending || !user?.id || handlingRef.current) return;
    handlingRef.current = true;

    const item = consumePending();
    if (!item) {
      handlingRef.current = false;
      return;
    }

    const sign = item.kind === 'income' ? '+' : '−';
    Alert.alert(
      'Добавить из уведомления банка?',
      `${sign}${Math.round(item.amount).toLocaleString('ru-RU')} ₽ · ${item.title}`,
      [
        {
          text: 'Отмена',
          style: 'cancel',
          onPress: () => {
            handlingRef.current = false;
          },
        },
        {
          text: 'Добавить',
          onPress: () => {
            void (async () => {
              try {
                const saved = await insertTransaction({
                  title: item.title,
                  amount: item.amount,
                  category: item.category,
                  date: new Date().toISOString().slice(0, 10),
                  kind: item.kind,
                  source: item.source === 'share' ? 'manual' : 'manual',
                  note: item.source === 'share' ? 'Из уведомления банка' : undefined,
                });
                await appendTransactionToDashboardCache(user.id, saved);
                onSaved?.();
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Не удалось сохранить';
                Alert.alert('Ошибка', message);
              } finally {
                handlingRef.current = false;
              }
            })();
          },
        },
      ],
      { cancelable: true, onDismiss: () => {
        handlingRef.current = false;
      } }
    );
  }, [pending, user?.id, consumePending, onSaved]);

  return null;
}
