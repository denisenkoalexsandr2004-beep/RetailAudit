import { NextRequest } from 'next/server';

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function validateAdminCredentials(login: string, password: string) {
  const expectedLogin = process.env.ADMIN_LOGIN;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedLogin || !expectedPassword || expectedPassword.length < 12) return false;
  return safeEqual(login, expectedLogin) && safeEqual(password, expectedPassword);
}

export function getAdminToken() {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token === 'change-me' || token.length < 16) return '';
  return token;
}

export function isAdminRequest(request: NextRequest) {
  const token = getAdminToken();
  if (!token) return false;
  const fromQuery = request.nextUrl.searchParams.get('token');
  const fromHeader = request.headers.get('x-admin-token');
  return fromQuery === token || fromHeader === token;
}
