import type { ApplicationRecord } from './db';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function postTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return 'not_configured' as const;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });

      if (response.ok) return 'sent' as const;
      if (response.status >= 400 && response.status < 500) return 'failed' as const;
    } catch {
      // Do not leak Telegram errors or payload data to users.
    } finally {
      clearTimeout(timeout);
    }
  }

  return 'failed' as const;
}

export async function sendApplicationToTelegram(application: ApplicationRecord) {
  const tariff = application.tariff === 'audit_plus' ? 'Аудит + переговоры · 150 000 ₽' : 'Аудит · 50 000 ₽';
  const networkLevel = {
    federal: 'Федеральные',
    regional: 'Региональные',
    local: 'Локальные'
  }[application.networkLevel || ''] || application.networkLevel || '';

  const text = [
    '<b>Новая заявка Retail Ready Аудит</b>',
    '',
    `<b>ID:</b> ${escapeHtml(application.id)}`,
    `<b>Тариф:</b> ${escapeHtml(tariff)}`,
    `<b>Имя:</b> ${escapeHtml(application.name)}`,
    `<b>Компания:</b> ${escapeHtml(application.company)}`,
    `<b>Телефон:</b> ${escapeHtml(application.phone)}`,
    application.telegram ? `<b>Telegram:</b> ${escapeHtml(application.telegram)}` : '',
    application.email ? `<b>Email:</b> ${escapeHtml(application.email)}` : '',
    '',
    `<b>Категория:</b> ${escapeHtml(application.category)}`,
    `<b>Продукт:</b> ${escapeHtml(application.productName)}`,
    `<b>Описание:</b> ${escapeHtml(application.description)}`,
    '',
    application.productionCost ? `<b>Цена товара:</b> ${escapeHtml(application.productionCost)} ₽` : '',
    application.retailPrice ? `<b>РРЦ:</b> ${escapeHtml(application.retailPrice)} ₽` : '',
    application.monthlyVolume ? `<b>Объём:</b> ${escapeHtml(application.monthlyVolume)} шт/мес` : '',
    networkLevel ? `<b>Уровень сетей:</b> ${escapeHtml(networkLevel)}` : '',
    application.federalNetworks ? `<b>Федеральные сети:</b> ${escapeHtml(application.federalNetworks)}` : '',
    application.regionalNetworks ? `<b>Региональные сети:</b> ${escapeHtml(application.regionalNetworks)}` : '',
    application.localNetworks ? `<b>Локальные сети:</b> ${escapeHtml(application.localNetworks)}` : '',
    application.unknownNetworks ? `<b>Другие сети:</b> ${escapeHtml(application.unknownNetworks)}` : '',
    application.networkNames ? `<b>Названия сетей:</b> ${escapeHtml(application.networkNames)}` : '',
    application.targetNetworks ? `<b>Комментарий по сетям:</b> ${escapeHtml(application.targetNetworks)}` : '',
    application.presentationUrl ? `<b>КП/презентация:</b> ${escapeHtml(application.presentationUrl)}` : '',
    application.notes ? `<b>Комментарий:</b> ${escapeHtml(application.notes)}` : ''
  ].filter(Boolean).join('\n');

  return postTelegramMessage(text);
}

export async function sendTelegramTestMessage() {
  const text = [
    '<b>Retail Ready Аудит</b>',
    'Telegram подключён корректно.',
    '',
    'Теперь новые заявки будут приходить менеджеру.'
  ].join('\n');

  return postTelegramMessage(text);
}
