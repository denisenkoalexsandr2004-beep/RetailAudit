import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { adminRateLimit } from '@/lib/security';
import { sendTelegramTestMessage } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_TELEGRAM_TEST !== 'true') {
    return NextResponse.json({ message: 'Not found.' }, { status: 404 });
  }

  const limited = adminRateLimit(request);
  if (limited) return limited;

  if (!isAdminRequest(request)) {
    return NextResponse.json({ message: 'Нет доступа.' }, { status: 401 });
  }

  const telegramStatus = await sendTelegramTestMessage();

  return NextResponse.json({
    telegramStatus,
    message: telegramStatus === 'sent'
      ? 'Тестовое Telegram-сообщение отправлено.'
      : telegramStatus === 'not_configured'
        ? 'Telegram не настроен: заполните TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.'
        : 'Telegram настроен, но сообщение не отправилось. Проверьте token/chat_id и доступ бота.'
  }, { status: telegramStatus === 'sent' ? 200 : 400 });
}
