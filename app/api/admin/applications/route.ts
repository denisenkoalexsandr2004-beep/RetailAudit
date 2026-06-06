import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { generateAIAuditDraft } from '@/lib/ai-audit';
import { adminRateLimit, corsPreflight, readJsonBody } from '@/lib/security';
import {
  getAuditByApplicationId,
  listApplications,
  updateApplicationStatus,
  upsertAudit,
  type ApplicationRecord,
  type ApplicationStatus
} from '@/lib/storage';

export const runtime = 'nodejs';

const statuses = new Set<ApplicationStatus>(['new', 'invoice_sent', 'paid_in_work', 'completed', 'rejected']);

export function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function GET(request: NextRequest) {
  const limited = adminRateLimit(request);
  if (limited) return limited;
  if (!isAdminRequest(request)) {
    return NextResponse.json({ message: 'Нет доступа.' }, { status: 401 });
  }
  return NextResponse.json({ applications: await listApplications() });
}

async function autoGenerateAudit(application: ApplicationRecord) {
  const existing = await getAuditByApplicationId(application.id);
  if (existing) {
    console.log('[auto-audit] skipped — audit already exists for', application.id);
    return;
  }
  const draft = await generateAIAuditDraft(application);
  await upsertAudit(application.id, draft, 'expert_review');
  console.log('[auto-audit] done for', application.id, '— score:', draft.overallScore);
}

export async function PATCH(request: NextRequest) {
  const limited = adminRateLimit(request);
  if (limited) return limited;
  if (!isAdminRequest(request)) {
    return NextResponse.json({ message: 'Нет доступа.' }, { status: 401 });
  }
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data as { id?: string; status?: ApplicationStatus };
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['id', 'status'].includes(key))) {
    return NextResponse.json({ message: 'Некорректные данные статуса.' }, { status: 400 });
  }
  if (!body.id || !body.status || !statuses.has(body.status)) {
    return NextResponse.json({ message: 'Некорректные данные статуса.' }, { status: 400 });
  }

  const application = await updateApplicationStatus(body.id, body.status);
  if (!application) return NextResponse.json({ message: 'Заявка не найдена.' }, { status: 404 });

  // Запускаем AI-аудит в фоне только при переходе в статус "Счёт оплачен, в работе"
  if (body.status === 'paid_in_work') {
    autoGenerateAudit(application).catch((err) =>
      console.error('[auto-audit] failed for', application.id, ':', err instanceof Error ? err.message : err)
    );
  }

  return NextResponse.json({ application });
}
