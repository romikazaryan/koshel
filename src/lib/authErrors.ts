export function mapAuthErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Неверный email или пароль.';
  }
  if (lower.includes('user already registered')) {
    return 'Пользователь с таким email уже зарегистрирован.';
  }
  if (lower.includes('password should be at least')) {
    return 'Пароль слишком короткий (минимум 6 символов).';
  }
  if (lower.includes('unable to validate email address')) {
    return 'Некорректный email.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Подтвердите email по ссылке из письма, затем войдите снова.';
  }
  if (lower.includes('invalid phone number') || lower.includes('phone number is invalid')) {
    return 'Некорректный номер телефона. Введите 10 цифр после +7.';
  }
  if (lower.includes('token has expired') || lower.includes('otp_expired')) {
    return 'Код устарел. Запросите новый.';
  }
  if (lower.includes('invalid token') || lower.includes('otp')) {
    return 'Неверный код из SMS.';
  }
  if (lower.includes('sms') && lower.includes('rate')) {
    return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  }
  return message;
}
