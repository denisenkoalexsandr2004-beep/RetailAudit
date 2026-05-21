# Retail Ready Audit

Production-ready MVP: лендинг, форма заявки, API, SQLite-хранилище, Telegram-уведомления и админка.

## Local Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Открыть:

- `http://localhost:3000` - основной сайт
- `http://localhost:3000/form` - Next.js форма
- `http://localhost:3000/admin/applications` - админка

## Production Build

```bash
npm ci
npm run build
npm run start
```

Next.js настроен с `output: standalone`, поэтому для VPS можно запускать production-сервер из `.next/standalone`.

## Required Environment

Секреты хранятся только в `.env` / `.env.local` на сервере. Не коммитить реальные значения.

```env
PRODUCTION_DOMAIN=https://your-domain.ru
NEXT_PUBLIC_SITE_URL=https://your-domain.ru

ADMIN_TOKEN=long-random-secret
DATABASE_PATH=./data/retail_ready_audit.db
STORAGE_DRIVER=auto

TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

CAPTCHA_REQUIRED=false
CAPTCHA_SECRET=
CAPTCHA_VERIFY_URL=https://hcaptcha.com/siteverify

ENABLE_TELEGRAM_TEST=false
```

## Request Flow

```txt
Форма → POST /api/applications → validation/rate limit → SQLite → Telegram → Админка
```

Если Telegram временно недоступен, заявка всё равно сохраняется в SQLite и видна в админке.

На Netlify нужно установить:

```env
STORAGE_DRIVER=netlify_blobs
```

Тогда заявки будут сохраняться в Netlify Blobs, потому что SQLite-файл в serverless окружении Netlify не подходит.

## Admin Access

Админка использует header `x-admin-token`. В UI токен вводится один раз и хранится в `localStorage`.

Для production задайте:

```env
ADMIN_TOKEN=long-random-secret
ADMIN_LOGIN=admin
ADMIN_PASSWORD=strong-password
```

В интерфейсе менеджер вводит логин и пароль. Внутренний `ADMIN_TOKEN` остаётся серверным секретом.

## Security Notes

- `.env*` исключены из git, кроме `.env.example`.
- API отклоняет неизвестные поля.
- Есть body limit, rate limit, honeypot и optional captcha.
- Security headers настроены в `next.config.js`.
- SQLite queries parameterized.
- Production dependencies проверяются через `npm audit --omit=dev`.

## Backup

Для MVP нужно регулярно сохранять:

```txt
data/retail_ready_audit.db
data/retail_ready_audit.db-wal
data/retail_ready_audit.db-shm
```

Перед копированием базы лучше остановить приложение или сделать SQLite backup на уровне сервера.
