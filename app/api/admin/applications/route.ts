import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { adminRateLimit, corsPreflight, readJsonBody } from '@/lib/security';
import { listApplications, updateApplicationStatus, type ApplicationStatus } from '@/lib/storage';

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

export async function PATCH(request: NextRequest) {
  const limited = adminRateLimit(request);
  if (limited) return limited;
  if (!isAdminRequest(request)) {
    return NextResponse.json({ message: 'Нет доступа.' }, { status: 401 });
  }
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data as { id?: string; status?: ApplicationStatus };
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['id', 'status'].includes(key))) {
    return NextResponse.json({ message: 'Некорректные данные статуса.' }, { status: 400 });
  }
  if (!body.id || !body.status || !statuses.has(body.status)) {
    return NextResponse.json({ message: 'Некорректные данные статуса.' }, { status: 400 });
  }
  const application = await updateApplicationStatus(body.id, body.status);
  if (!application) return NextResponse.json({ message: 'Заявка не найдена.' }, { status: 404 });
  return NextResponse.json({ application });
}
