export const PAYMENT_DAY_MIN = 1;
export const PAYMENT_DAY_MAX = 31;

export function isValidPaymentDay(day: number) {
  return Number.isInteger(day) && day >= PAYMENT_DAY_MIN && day <= PAYMENT_DAY_MAX;
}

export function paymentDayHint() {
  return `Укажите число от ${PAYMENT_DAY_MIN} до ${PAYMENT_DAY_MAX}. В феврале и в месяцах без 31-го напоминание придёт в последний день месяца.`;
}
