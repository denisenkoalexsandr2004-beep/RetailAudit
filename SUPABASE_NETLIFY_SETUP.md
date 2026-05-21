# Supabase + Netlify: рабочая бесплатная схема

Схема:

```txt
Netlify сайт -> Next.js API -> Supabase database -> админка
                         -> Telegram bot
```

## 1. Создать Supabase project

1. Открыть `https://supabase.com`.
2. Создать новый project.
3. Region можно выбрать ближайший доступный.
4. Сохранить пароль проекта в безопасное место.

## 2. Создать таблицу заявок

1. Supabase -> нужный project.
2. Открыть `SQL Editor`.
3. Вставить содержимое файла `supabase_schema.sql`.
4. Нажать `Run`.

## 3. Взять ключи Supabase

Открыть:

```txt
Project Settings -> API
```

Нужны:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role key
```

Важно: `service_role key` нельзя показывать во frontend. Мы кладем его только в Netlify Environment variables.

## 4. Переменные Netlify

Netlify -> Project configuration -> Environment variables.

Добавить:

```env
STORAGE_DRIVER=supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=сюда_service_role_key

ADMIN_TOKEN=длинный_секрет
ADMIN_LOGIN=admin
ADMIN_PASSWORD=ваш_пароль

TELEGRAM_BOT_TOKEN=токен_бота
TELEGRAM_CHAT_ID=804998047

CAPTCHA_REQUIRED=false
ENABLE_TELEGRAM_TEST=false
```

## 5. Redeploy

После добавления переменных нужно заново загрузить архив в Netlify:

```txt
Deploys -> drag and drop zip archive
```

Без redeploy новые переменные могут не примениться.

## 6. Проверка

1. Открыть основной сайт.
2. Отправить тестовую заявку.
3. Открыть `/admin/applications`.
4. Проверить, что заявка появилась.
5. Проверить Telegram.

