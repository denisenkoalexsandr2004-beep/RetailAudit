import { NextResponse } from 'next/server';

const MAX_JSON_BYTES = 11 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const FORM_RATE_LIMIT = 8;
const ADMIN_RATE_LIMIT = 60;

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return forwarded || realIp || 'local';
}

export function rateLimit(request: Request, scope: string, limit = FORM_RATE_LIMIT) {
  const now = Date.now();
  const key = `${scope}:${getClientIp(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= limit) return null;

  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
  return NextResponse.json(
    { message: 'Слишком много запросов. Попробуйте позже.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter)
      }
    }
  );
}

export function adminRateLimit(request: Request) {
  return rateLimit(request, 'admin', ADMIN_RATE_LIMIT);
}

export async function readJsonBody(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return { ok: false as const, response: NextResponse.json({ message: 'Ожидается JSON.' }, { status: 415 }) };
  }

  const length = Number(request.headers.get('content-length') || '0');
  if (length > MAX_JSON_BYTES) {
    return { ok: false as const, response: NextResponse.json({ message: 'Слишком большой запрос.' }, { status: 413 }) };
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_JSON_BYTES) {
    return { ok: false as const, response: NextResponse.json({ message: 'Слишком большой запрос.' }, { status: 413 }) };
  }

  try {
    return { ok: true as const, data: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false as const, response: NextResponse.json({ message: 'Некорректный JSON.' }, { status: 400 }) };
  }
}

export function applyCors(response: NextResponse, request: Request) {
  const origin = request.headers.get('origin');
  const allowedOrigin = process.env.PRODUCTION_DOMAIN || process.env.NEXT_PUBLIC_SITE_URL || '';

  if (origin && allowedOrigin && origin === allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  return response;
}

export function corsPreflight(request: Request) {
  return applyCors(new NextResponse(null, { status: 204 }), request);
}
