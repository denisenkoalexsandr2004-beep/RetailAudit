import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { generateAIAuditDraft } from '@/lib/ai-audit';
import { adminRateLimit, corsPreflight, readJsonBody } from '@/lib/security';
import { getApplication, upsertAudit } from '@/lib/storage';

export const runtime = 'nodejs';

export function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function POST(request: NextRequest) {
  const limited = adminRateLimit(request);
  if (limited) return limited;
  if (!isAdminRequest(request)) {
    return NextResponse.json({ message: 'Нет доступа.' }, { status: 401 });
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data as { applicationId?: string };
  if (!body.applicationId) {
    return NextResponse.json({ message: 'Не указан ID заявки.' }, { status: 400 });
  }

  const application = await getApplication(body.applicationId);
  if (!application) {
    return NextResponse.json({ message: 'Заявка не найдена.' }, { status: 404 });
  }

  try {
    const draft = await generateAIAuditDraft(application);
    const audit = await upsertAudit(application.id, draft, 'expert_review');
    return NextResponse.json({ application, audit });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : '';
    const message = rawMessage.includes('ANTHROPIC_API_KEY')
      ? 'AI-аудит пока не настроен: добавьте ANTHROPIC_API_KEY в переменные окружения. Черновой аудит можно сформировать обычной кнопкой.'
      : rawMessage || 'Не удалось сформировать AI-аудит.';
    return NextResponse.json({ message }, { status: 502 });
  }
}
