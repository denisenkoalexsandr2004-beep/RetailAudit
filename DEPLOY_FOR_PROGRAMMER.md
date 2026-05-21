# Краткий план деплоя

## 1. Supabase

1. Открыть Supabase.
2. Создать проект.
3. Открыть SQL Editor.
4. Вставить код из `supabase_schema.sql`.
5. Нажать Run.

## 2. Netlify

1. Создать сайт в Netlify.
2. Загрузить проект или подключить GitHub.
3. Build command:

```bash
npm run build
```

4. Publish directory:

```text
.next
```

## 3. Environment Variables

Добавить переменные из `.env.example`.

Обязательные:

```text
ADMIN_LOGIN
ADMIN_PASSWORD
ADMIN_TOKEN
STORAGE_DRIVER
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
CAPTCHA_REQUIRED
ENABLE_TELEGRAM_TEST
```

## 4. Проверка

1. Открыть сайт.
2. Отправить тестовую заявку.
3. Проверить заявку в админке.
4. Проверить уведомление в Telegram.
5. Скачать CSV из админки.

