# Timeweb Cloud: запуск Retail Ready Audit

Цель: запустить рабочий продукт на одном недорогом сервере:

- основной сайт;
- форма заявки;
- backend API;
- админка;
- SQLite-база;
- Telegram-уведомления.

## 1. Какой сервер выбрать

Для MVP достаточно:

```txt
Ubuntu 24.04 LTS
1 vCPU
2 GB RAM
30 GB NVMe/SSD
```

Если выбирать из Timeweb Cloud, оптимальный вариант для нас - тариф уровня `Cloud MSK 30`.

Почему не самый минимальный:

- Next.js при сборке любит память;
- SQLite будет жить прямо на сервере;
- Telegram и админка работают через этот же backend;
- 2 GB RAM дают запас, чтобы сайт не падал на ровном месте.

## 2. Что нужно получить от руководителя

После оплаты сервера нужны:

```txt
IP сервера
Логин SSH, обычно root
Пароль SSH или SSH-ключ
Домен или поддомен
```

Целевой домен:

```txt
retail-ready-audit.platforma-czs.ru
```

## 3. DNS

В DNS-зоне `platforma-czs.ru` нужно добавить запись:

```txt
Type: A
Name: retail-ready-audit
Value: IP сервера Timeweb
TTL: 300
```

Простыми словами: эта запись говорит интернету, что поддомен должен открывать наш сервер.

## 4. Production `.env.local`

На сервере в папке проекта нужен файл `.env.local`:

```env
PRODUCTION_DOMAIN=https://retail-ready-audit.platforma-czs.ru
NEXT_PUBLIC_SITE_URL=https://retail-ready-audit.platforma-czs.ru

ADMIN_TOKEN=replace-with-long-random-secret
ADMIN_LOGIN=admin
ADMIN_PASSWORD=replace-with-strong-password

DATABASE_PATH=./data/retail_ready_audit.db
STORAGE_DRIVER=auto

TELEGRAM_BOT_TOKEN=replace-with-new-bot-token
TELEGRAM_CHAT_ID=804998047

CAPTCHA_REQUIRED=false
CAPTCHA_SECRET=
CAPTCHA_VERIFY_URL=https://hcaptcha.com/siteverify

ENABLE_TELEGRAM_TEST=false
```

Важно: Telegram bot token нельзя вставлять во frontend и нельзя отправлять в git.

## 5. Команды установки на сервере

```bash
apt update
apt install -y curl nginx git
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
npm install -g pm2
```

Проверка:

```bash
node -v
npm -v
pm2 -v
```

Нужен Node.js `24.x`, потому что проект использует встроенный SQLite-модуль Node.

## 6. Запуск проекта

В папке проекта:

```bash
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Проверка локально на сервере:

```bash
curl http://127.0.0.1:3000
```

## 7. nginx

Файл:

```txt
/etc/nginx/sites-available/retail-ready-audit
```

Конфиг:

```nginx
server {
    listen 80;
    server_name retail-ready-audit.platforma-czs.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Включить сайт:

```bash
ln -s /etc/nginx/sites-available/retail-ready-audit /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## 8. HTTPS

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d retail-ready-audit.platforma-czs.ru
```

## 9. Проверка после запуска

Открыть:

```txt
https://retail-ready-audit.platforma-czs.ru/
https://retail-ready-audit.platforma-czs.ru/admin/applications
```

Проверить:

- заявка отправляется;
- заявка появляется в админке;
- Telegram получает уведомление;
- админка открывается только по логину и паролю;
- после выхода снова просит логин и пароль.

## 10. Бэкапы

Главный файл базы:

```txt
data/retail_ready_audit.db
```

Для MVP достаточно ежедневно копировать:

```txt
data/retail_ready_audit.db*
```

