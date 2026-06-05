/** Приводит ввод к формату E.164 для РФ (+7XXXXXXXXXX). */
export function normalizeRuPhoneE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return `+${digits}`;
  return null;
}

export function formatRuPhoneDisplay(e164: string) {
  const digits = e164.replace(/\D/g, '');
  if (digits.length !== 11 || !digits.startsWith('7')) return e164;
  const local = digits.slice(1);
  return `+7 ${local.slice(0, 3)} ${local.slice(3, 6)}-${local.slice(6, 8)}-${local.slice(8)}`;
}
