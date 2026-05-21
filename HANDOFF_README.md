# Retail Ready Аудит — передача проекта программисту

## Что внутри

Это Next.js проект для сервиса Retail Ready Аудит.

В проекте есть:

- основной сайт;
- форма заявки;
- загрузка КП / презентации;
- голосовой ввод описания продукта;
- отправка заявок в backend;
- сохранение заявок в Supabase;
- Telegram-уведомления менеджеру;
- админка с логином и паролем;
- CRM-воронка заявок;
- CSV-экспорт заявок;
- виджет поддержки с Telegram и телефоном.

## Как запустить локально

```bash
npm install
npm run dev
```

После запуска:

- сайт: `http://localhost:3000/`
- админка: `http://localhost:3000/admin/applications`

## Как собрать production build

```bash
npm run build
```

## Где главный код

- `app/page.tsx` — главная страница Next.js
- `public/retail-ready-audit.html` — основной лендинг и форма
- `app/admin/applications/page.tsx` — админка
- `app/api/applications/route.ts` — API отправки заявок
- `app/api/admin/applications/route.ts` — API админки
- `lib/storage.ts` — сохранение заявок
- `lib/telegram.ts` — Telegram-уведомления
- `supabase_schema.sql` — SQL для базы Supabase
- `netlify.toml` — настройки Netlify

## Что нужно настроить перед production

1. Создать Supabase проект.
2. Выполнить SQL из `supabase_schema.sql`.
3. В Netlify добавить переменные окружения из `.env.example`.
4. Указать реальные значения:
   - Supabase URL;
   - Supabase service role key;
   - Telegram bot token;
   - Telegram chat id;
   - логин и пароль админки.
5. Задеплоить проект на Netlify.

## Важно по безопасности

Реальные токены и пароли нельзя хранить в коде.
Они должны быть только в Netlify Environment Variables или в локальном `.env.local`.

Файл `.env.local` не должен попадать в GitHub и ZIP для передачи.

