export type TariffCode = 'to_clarify' | 'audit' | 'audit_plus' | 'contract';

export function normalizeTariff(value: unknown): TariffCode {
  if (value === 'contract') return 'contract';
  if (value === 'audit_plus') return 'audit_plus';
  if (value === 'audit') return 'audit';
  return 'to_clarify';
}

export function getTariffLabel(value: TariffCode, withPrice = false) {
  if (value === 'contract') {
    return withPrice ? 'Сопровождение до контракта · 300–500 тыс. ₽' : 'Сопровождение до контракта';
  }
  if (value === 'audit_plus') {
    return withPrice ? 'Ответ сети и договорённость · 150 000 ₽' : 'Ответ сети и договорённость';
  }
  if (value === 'audit') {
    return withPrice ? 'Диагностика и проверка КП · 50 000 ₽' : 'Диагностика и проверка КП';
  }
  return 'Подобрать маршрут';
}
