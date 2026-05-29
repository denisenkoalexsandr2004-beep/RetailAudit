import { NextRequest, NextResponse } from 'next/server';
import { getAdminToken, validateAdminCredentials } from '@/lib/auth';
import { adminRateLimit, readJsonBody } from '@/lib/security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const limited = adminRateLimit(request);
  if (limited) return limited;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data as { login?: string; password?: string };
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['login', 'password'].includes(key))) {
    return NextResponse.json({ message: 'Некорректные данные входа.' }, { status: 400 });
  }

  const login = String(body.login || '').trim();
  const password = String(body.password || '');

  if (!validateAdminCredentials(login, password)) {
    return NextResponse.json({ message: 'Неверный логин или пароль.' }, { status: 401 });
  }

  const token = getAdminToken();
  if (!token) {
    return NextResponse.json({ message: 'Админ-доступ не настроен.' }, { status: 500 });
  }

  return NextResponse.json({ token });
}
