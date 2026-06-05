import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { generateAuditDraft } from '@/lib/audit-methodology';
import { adminRateLimit, corsPreflight, readJsonBody } from '@/lib/security';
import { getApplication, getAuditByApplicationId, updateAudit, upsertAudit, type AuditRecord } from '@/lib/storage';

export const runtime = 'nodejs';

const statuses = new Set<AuditRecord['status']>(['draft', 'expert_review', 'approved']);

export function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function GET(request: NextRequest) {
  const limited = adminRateLimit(request);
  if (limited) return limited;
  if (!isAdminRequest(request)) {
    return NextResponse.json({ message: 'Нет доступа.' }, { status: 401 });
  }

  const applicationId = request.nextUrl.searchParams.get('applicationId') || '';
  if (!applicationId) {
    return NextResponse.json({ message: 'Не указан ID заявки.' }, { status: 400 });
  }

  try {
    const application = await getApplication(applicationId);
    if (!application) {
      return NextResponse.json({ message: 'Заявка не найдена.' }, { status: 404 });
    }
    return NextResponse.json({
      application,
      audit: await getAuditByApplicationId(applicationId)
    });
  } catch (err) {
    console.error('[audits GET]', err);
    return NextResponse.json({ message: 'Ошибка сервера при загрузке данных аудита.' }, { status: 500 });
  }
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

  try {
    const application = await getApplication(body.applicationId);
    if (!application) {
      return NextResponse.json({ message: 'Заявка не найдена.' }, { status: 404 });
    }
    const audit = await upsertAudit(application.id, generateAuditDraft(application), 'draft');
    return NextResponse.json({ application, audit });
  } catch (err) {
    console.error('[audits POST]', err);
    return NextResponse.json({ message: 'Ошибка сервера при создании аудита.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const limited = adminRateLimit(request);
  if (limited) return limited;
  if (!isAdminRequest(request)) {
    return NextResponse.json({ message: 'Нет доступа.' }, { status: 401 });
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data as Partial<AuditRecord>;
  if (!body.id || !body.status || !statuses.has(body.status)) {
    return NextResponse.json({ message: 'Некорректные данные аудита.' }, { status: 400 });
  }
  if (!Array.isArray(body.blocks) || !Array.isArray(body.recommendations) || !Array.isArray(body.roadmap)) {
    return NextResponse.json({ message: 'Некорректная структура аудита.' }, { status: 400 });
  }

  try {
    const audit = await updateAudit({
      id: body.id,
      status: body.status,
      overallScore: Number(body.overallScore || 0),
      readinessLevel: String(body.readinessLevel || ''),
      verdict: String(body.verdict || ''),
      summary: String(body.summary || ''),
      blocks: body.blocks,
      recommendations: body.recommendations.map(String),
      roadmap: body.roadmap.map(String)
    });
    if (!audit) return NextResponse.json({ message: 'Аудит не найден.' }, { status: 404 });
    return NextResponse.json({ audit });
  } catch (err) {
    console.error('[audits PATCH]', err);
    return NextResponse.json({ message: 'Ошибка сервера при сохранении аудита.' }, { status: 500 });
  }
}
