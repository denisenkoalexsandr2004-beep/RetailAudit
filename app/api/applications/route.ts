import { NextResponse } from 'next/server';
import { createApplication, updateTelegramStatus } from '@/lib/storage';
import { applyCors, corsPreflight, rateLimit, readJsonBody } from '@/lib/security';
import { sendApplicationToTelegram } from '@/lib/telegram';
import { validateApplication, verifyCaptcha } from '@/lib/validation';

export const runtime = 'nodejs';

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  const limited = rateLimit(request, 'applications');
  if (limited) return applyCors(limited, request);

  const body = await readJsonBody(request);
  if (!body.ok) return applyCors(body.response, request);

  const payload = body.data;

  const validation = validateApplication(payload);
  if (!validation.ok) {
    return applyCors(NextResponse.json({ message: validation.message, field: validation.field }, { status: 422 }), request);
  }

  const captchaOk = await verifyCaptcha(payload);
  if (!captchaOk) {
    return applyCors(NextResponse.json({ message: 'Проверка captcha не пройдена.', field: 'captcha' }, { status: 422 }), request);
  }

  let application;
  try {
    application = await createApplication(validation.data);
  } catch (error) {
    console.error('Application create failed', error);
    return applyCors(NextResponse.json({ message: 'Заявка временно не принята. Попробуйте позже.' }, { status: 500 }), request);
  }

  let telegramStatus: 'sent' | 'failed' | 'not_configured' = 'not_configured';
  try {
    telegramStatus = await sendApplicationToTelegram(application);
  } catch {
    telegramStatus = 'failed';
  }
  try {
    await updateTelegramStatus(application.id, telegramStatus);
  } catch (error) {
    console.error('Telegram status update failed', error);
    telegramStatus = 'failed';
  }

  return applyCors(NextResponse.json({
    id: application.id,
    applicationId: application.id,
    telegramStatus,
    message: telegramStatus === 'sent'
      ? 'Заявка принята и отправлена менеджеру.'
      : telegramStatus === 'not_configured'
        ? 'Заявка сохранена. Telegram-уведомление требует настройки.'
        : 'Заявка сохранена. Telegram-уведомление не отправилось, менеджер увидит заявку в админке.'
  }), request);
}
