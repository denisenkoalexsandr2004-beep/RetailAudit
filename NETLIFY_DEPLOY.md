# Netlify Deploy

Цель: выложить MVP на бесплатный домен Netlify вида:

```txt
https://retail-ready-audit.netlify.app
```

Можно выбрать другое свободное имя, например:

```txt
https://retail-ready-czs.netlify.app
https://retail-ready-audit-czs.netlify.app
```

## Важный нюанс

На Netlify нельзя надёжно использовать локальный SQLite-файл как постоянную базу в serverless окружении.

Поэтому проект подготовлен так:

```txt
Локально / VPS → SQLite
Netlify → Netlify Blobs
```

Это значит, что заявки на Netlify будут сохраняться в Netlify Blobs.

## Что уже подготовлено

- Добавлен `netlify.toml`.
- Добавлен dependency `@netlify/blobs`.
- Добавлен storage adapter `lib/storage.ts`.
- API заявок и админка работают через общий storage layer.

## Как деплоить через GitHub

1. Залить проект в GitHub.
2. Открыть Netlify.
3. New site → Import from Git.
4. Выбрать репозиторий.
5. В настройках build указать:

```txt
Base directory: final_product/nextjs_app
Build command: npm run build
Publish directory: .next
```

Если Netlify сам увидит `netlify.toml`, эти настройки подтянутся автоматически.

## Environment variables на Netlify

В Netlify:

```txt
Site configuration → Environment variables
```

Добавить:

```env
PRODUCTION_DOMAIN=https://retail-ready-audit.netlify.app
NEXT_PUBLIC_SITE_URL=https://retail-ready-audit.netlify.app

ADMIN_TOKEN=long-random-secret
ADMIN_LOGIN=admin
ADMIN_PASSWORD=strong-password

STORAGE_DRIVER=netlify_blobs

TELEGRAM_BOT_TOKEN=new-telegram-token
TELEGRAM_CHAT_ID=804998047

CAPTCHA_REQUIRED=false
CAPTCHA_SECRET=
CAPTCHA_VERIFY_URL=https://hcaptcha.com/siteverify

ENABLE_TELEGRAM_TEST=false
```

`DATABASE_PATH` на Netlify не нужен, потому что используется Netlify Blobs.

## После deploy

Проверить:

- Главная открывается.
- Форма отправляет заявку.
- Админка открывается.
- Логин/пароль работают.
- Заявка видна в админке.
- Telegram приходит.

## Если Telegram не приходит

Проверить:

- правильный `TELEGRAM_BOT_TOKEN`;
- правильный `TELEGRAM_CHAT_ID`;
- бот получил `/start` от нужного пользователя/чата;
- переменные окружения сохранены;
- после изменения env был сделан redeploy.

