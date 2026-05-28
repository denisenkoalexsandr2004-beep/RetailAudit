export type TariffCode = 'to_clarify' | 'audit' | 'audit_plus';

export function normalizeTariff(value: unknown): TariffCode {
  if (value === 'audit_plus') return 'audit_plus';
  if (value === 'audit') return 'audit';
  return 'to_clarify';
}

export function getTariffLabel(value: TariffCode, withPrice = false) {
  if (value === 'audit_plus') {
    return withPrice ? 'Аудит + переговоры · 150 000 ₽' : 'Аудит + переговоры';
  }
  if (value === 'audit') {
    return withPrice ? 'Аудит · 50 000 ₽' : 'Аудит';
  }
  return 'Уточнить тариф';
}
