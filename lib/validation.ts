import type { TariffCode } from './tariffs';
import { normalizeTariff } from './tariffs';

export type ApplicationInput = {
  name: string;
  company: string;
  phone: string;
  telegram?: string;
  email?: string;
  category: string;
  productName: string;
  description: string;
  tariff: TariffCode;
  productionCost?: string;
  retailPrice?: string;
  monthlyVolume?: string;
  targetNetworks?: string;
  networkLevel?: string;
  networkNames?: string;
  federalNetworks?: string;
  regionalNetworks?: string;
  localNetworks?: string;
  unknownNetworks?: string;
  presentationUrl?: string;
  presentationName?: string;
  presentationType?: string;
  presentationSize?: number;
  presentationFile?: {
    name: string;
    type: string;
    size: number;
    data: string;
  };
  notes?: string;
};

export type ValidationResult =
  | { ok: true; data: ApplicationInput }
  | { ok: false; message: string; field?: keyof ApplicationInput | 'captcha' | 'body' };

const allowedFields = new Set([
  'name',
  'company',
  'phone',
  'telegram',
  'email',
  'category',
  'productName',
  'product_name',
  'description',
  'tariff',
  'productionCost',
  'price',
  'retailPrice',
  'rrp',
  'monthlyVolume',
  'volume',
  'targetNetworks',
  'answer',
  'networkLevel',
  'network_level',
  'networkNames',
  'network_names',
  'federalNetworks',
  'federal_networks',
  'regionalNetworks',
  'regional_networks',
  'localNetworks',
  'local_networks',
  'unknownNetworks',
  'unknown_networks',
  'presentationFile',
  'notes',
  'website',
  'companyWebsite',
  'captchaToken'
]);

const maxLengths: Partial<Record<keyof ApplicationInput, number>> = {
  name: 80,
  company: 120,
  phone: 30,
  telegram: 40,
  email: 120,
  category: 80,
  productName: 120,
  description: 2000,
  productionCost: 20,
  retailPrice: 20,
  monthlyVolume: 30,
  targetNetworks: 500,
  networkLevel: 40,
  networkNames: 500,
  federalNetworks: 500,
  regionalNetworks: 500,
  localNetworks: 500,
  unknownNetworks: 500,
  presentationName: 180,
  presentationType: 120,
  notes: 1000
};

const clean = (value: unknown, maxLength = 2000) => String(value ?? '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/[<>]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .slice(0, maxLength);

const lettersOnly = (value: string) => clean(value).replace(/[^A-Za-zА-Яа-яЁё]/g, '');

function looksLikeNoise(value: string) {
  const letters = lettersOnly(value).toLowerCase();
  if (!letters) return true;
  if (/(.)\1{3,}/.test(letters)) return true;
  if (letters.length >= 5 && new Set(letters.split('')).size <= 2) return true;
  const vowels = (letters.match(/[аеёиоуыэюяaeiouy]/g) || []).length;
  return letters.length >= 5 && vowels === 0;
}

function hasBusinessText(value: string, minLetters: number) {
  return lettersOnly(value).length >= minLetters && !looksLikeNoise(value);
}

function validName(value: string) {
  const name = clean(value);
  return (
    name.length >= 5 &&
    name.length <= 80 &&
    /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё\s-]*$/.test(name) &&
    name.split(/\s+/).length >= 2 &&
    !looksLikeNoise(name)
  );
}

function validPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 && !/^(\d)\1+$/.test(digits);
}

function validTelegram(value: string) {
  if (!value) return true;
  return /^@?[A-Za-z0-9_]{5,32}$/.test(value) && !/^@?\d+$/.test(value);
}

function validEmail(value: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function validDescription(value: string) {
  const text = clean(value);
  return text.length >= 60 && text.split(/\s+/).filter(Boolean).length >= 8 && hasBusinessText(text, 25);
}

function validPositiveNumber(value?: string) {
  if (!value) return true;
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

function validNetworkLevel(value?: string) {
  if (!value) return true;
  return ['federal', 'regional', 'local'].includes(value);
}

function normalizePresentationFile(raw: unknown) {
  const file = raw as Record<string, unknown>;
  if (!file || typeof file !== 'object' || Array.isArray(file)) return undefined;

  const name = clean(file.name, maxLengths.presentationName);
  const type = clean(file.type, maxLengths.presentationType) || 'application/octet-stream';
  const data = String(file.data || '');
  const size = Number(file.size || 0);
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  if (!name || !data || !Number.isFinite(size)) return undefined;
  if (size <= 0 || size > 8 * 1024 * 1024) return undefined;
  if (!/\.(pdf|ppt|pptx|doc|docx)$/i.test(name) && !allowedTypes.includes(type)) return undefined;
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return undefined;

  return { name, type, size, data };
}

function hasUnknownFields(raw: Record<string, unknown>) {
  return Object.keys(raw).some(key => !allowedFields.has(key));
}

export async function verifyCaptcha(payload: unknown) {
  if (process.env.CAPTCHA_REQUIRED !== 'true') return true;
  const secret = process.env.CAPTCHA_SECRET;
  const verifyUrl = process.env.CAPTCHA_VERIFY_URL || 'https://hcaptcha.com/siteverify';
  const raw = (payload ?? {}) as Record<string, unknown>;
  const token = clean(raw.captchaToken, 4096);

  if (!secret || !token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal
    });
    clearTimeout(timeout);
    const result = await response.json().catch(() => null) as { success?: boolean } | null;
    return Boolean(result?.success);
  } catch {
    return false;
  }
}

export function validateApplication(payload: unknown): ValidationResult {
  const raw = (payload ?? {}) as Record<string, unknown>;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, field: 'body', message: 'Некорректный формат заявки.' };
  }
  if (hasUnknownFields(raw)) {
    return { ok: false, field: 'body', message: 'Заявка содержит неподдерживаемые поля.' };
  }
  if (clean(raw.website) || clean(raw.companyWebsite)) {
    return { ok: false, field: 'body', message: 'Заявка отклонена антиспам-фильтром.' };
  }

  const data: ApplicationInput = {
    name: clean(raw.name, maxLengths.name),
    company: clean(raw.company, maxLengths.company),
    phone: clean(raw.phone, maxLengths.phone),
    telegram: clean(raw.telegram, maxLengths.telegram),
    email: clean(raw.email, maxLengths.email),
    category: clean(raw.category, maxLengths.category),
    productName: clean(raw.productName || raw.product_name, maxLengths.productName),
    description: clean(raw.description, maxLengths.description),
    tariff: normalizeTariff(raw.tariff),
    productionCost: clean(raw.productionCost || raw.price, maxLengths.productionCost),
    retailPrice: clean(raw.retailPrice || raw.rrp, maxLengths.retailPrice),
    monthlyVolume: clean(raw.monthlyVolume || raw.volume, maxLengths.monthlyVolume),
    targetNetworks: clean(raw.targetNetworks || raw.answer, maxLengths.targetNetworks),
    networkLevel: clean(raw.networkLevel || raw.network_level, maxLengths.networkLevel),
    networkNames: clean(raw.networkNames || raw.network_names, maxLengths.networkNames),
    federalNetworks: clean(raw.federalNetworks || raw.federal_networks, maxLengths.federalNetworks),
    regionalNetworks: clean(raw.regionalNetworks || raw.regional_networks, maxLengths.regionalNetworks),
    localNetworks: clean(raw.localNetworks || raw.local_networks, maxLengths.localNetworks),
    unknownNetworks: clean(raw.unknownNetworks || raw.unknown_networks, maxLengths.unknownNetworks),
    presentationFile: normalizePresentationFile(raw.presentationFile),
    notes: clean(raw.notes, maxLengths.notes)
  };

  if (!validName(data.name)) return { ok: false, field: 'name', message: 'Укажите реальное имя и фамилию.' };
  if (!hasBusinessText(data.company, 3)) return { ok: false, field: 'company', message: 'Укажите корректное название компании.' };
  if (!validPhone(data.phone)) return { ok: false, field: 'phone', message: 'Укажите корректный телефон.' };
  if (!validTelegram(data.telegram || '')) return { ok: false, field: 'telegram', message: 'Telegram укажите в формате @username.' };
  if (!validEmail(data.email || '')) return { ok: false, field: 'email', message: 'Укажите корректный email.' };
  if (!data.category) return { ok: false, field: 'category', message: 'Выберите категорию продукта.' };
  if (!hasBusinessText(data.productName, 3)) return { ok: false, field: 'productName', message: 'Укажите корректное название продукта.' };
  if (!validDescription(data.description)) {
    return { ok: false, field: 'description', message: 'Опишите продукт подробнее: минимум 8 слов по делу.' };
  }
  if (!validPositiveNumber(data.productionCost)) return { ok: false, field: 'productionCost', message: 'Цена товара должна быть больше 0.' };
  if (!validPositiveNumber(data.retailPrice)) return { ok: false, field: 'retailPrice', message: 'РРЦ должна быть больше 0.' };
  if (data.productionCost && data.retailPrice && Number(data.retailPrice) <= Number(data.productionCost)) {
    return { ok: false, field: 'retailPrice', message: 'РРЦ должна быть выше себестоимости.' };
  }
  if (!validPositiveNumber(data.monthlyVolume)) return { ok: false, field: 'monthlyVolume', message: 'Объём производства должен быть больше 0.' };
  if (data.targetNetworks && !hasBusinessText(data.targetNetworks, 3)) {
    return { ok: false, field: 'targetNetworks', message: 'Укажите названия сетей или оставьте поле пустым.' };
  }
  if (!validNetworkLevel(data.networkLevel)) return { ok: false, field: 'targetNetworks', message: 'Выберите уровень сетей.' };
  if (data.networkNames && !hasBusinessText(data.networkNames, 3)) {
    return { ok: false, field: 'targetNetworks', message: 'Укажите названия сетей или оставьте поле пустым.' };
  }
  const separatedNetworks = [data.federalNetworks, data.regionalNetworks, data.localNetworks, data.unknownNetworks].filter(Boolean).join(' ');
  if (separatedNetworks && !hasBusinessText(separatedNetworks, 3)) {
    return { ok: false, field: 'targetNetworks', message: 'Укажите названия сетей или оставьте поле пустым.' };
  }
  if (raw.presentationFile && !data.presentationFile) {
    return { ok: false, field: 'body', message: 'КП можно загрузить только в формате PDF, PPT, PPTX, DOC или DOCX до 8 МБ.' };
  }

  return { ok: true, data };
}
