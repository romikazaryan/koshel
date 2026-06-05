import * as Notifications from 'expo-notifications';
import type { Debt } from '../types';

const DEBT_NOTIFICATION_PREFIX = 'debt-reminder-';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function shouldScheduleReminder(debt: Debt): boolean {
  if (!debt.isActive || !debt.remindEnabled) return false;
  const today = new Date().toISOString().slice(0, 10);
  return debt.endDate >= today;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function rescheduleDebtReminders(debts: Debt[]): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item.identifier.startsWith(DEBT_NOTIFICATION_PREFIX))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
    );

    const granted = await ensureNotificationPermission();
    if (!granted) return;

    for (const debt of debts) {
      if (!shouldScheduleReminder(debt)) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `${DEBT_NOTIFICATION_PREFIX}${debt.id}`,
        content: {
          title: 'Напоминание о платеже',
          body: `${debt.name}: ₽${debt.monthlyPayment.toLocaleString('ru-RU')} · ${debt.paymentDay}-го числа`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          day: debt.paymentDay,
          hour: 9,
          minute: 0,
          repeats: true,
        },
      });
    }
  } catch (error) {
    console.warn('rescheduleDebtReminders failed', error);
  }
}
