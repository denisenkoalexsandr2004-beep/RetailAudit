# Deployment Checklist

Target staging/production setup:

- Hosting: Timeweb Cloud VPS.
- Domain: `retail-ready-audit.platforma-czs.ru`.
- Runtime: Node.js 24.x.
- Process manager: `pm2` or systemd.
- Reverse proxy / HTTPS: nginx + Let's Encrypt, or Timeweb-managed SSL if available.

## 1. Server Requirements

- Node.js 24.x preferred for current `node:sqlite` usage.
- HTTPS via nginx/Caddy/hosting platform.
- Outbound access to `https://api.telegram.org:443`.
- Persistent writable `data/` directory for SQLite.

Recommended MVP server:

```txt
1 vCPU
1 GB RAM minimum, 2 GB preferred
15-20 GB NVMe/SSD
Ubuntu 24.04 LTS
```

## 2. Prepare Secrets

Create `.env.local` or platform env variables:

```env
PRODUCTION_DOMAIN=https://retail-ready-audit.platforma-czs.ru
NEXT_PUBLIC_SITE_URL=https://retail-ready-audit.platforma-czs.ru

ADMIN_TOKEN=replace-with-long-random-token
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

Important: rotate Telegram bot token before production if it was shared in chat.

## 3. Build

```bash
npm ci
npm run build
npm audit --omit=dev
```

## 4. Run

Simple:

```bash
npm run start
```

Standalone:

```bash
node .next/standalone/server.js
```

Recommended with pm2:

```bash
npm install -g pm2
pm2 start .next/standalone/server.js --name retail-ready-audit
pm2 save
pm2 startup
```

## 4.1. nginx Reverse Proxy

Example nginx server block:

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

Then enable HTTPS with Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d retail-ready-audit.platforma-czs.ru
```

## 5. Smoke Test

- Open `/`
- Submit one valid application
- Open `/admin/applications`
- Confirm application is visible
- Confirm Telegram notification arrives
- Confirm `/api/admin/applications` returns `401` without token

Production URLs:

```txt
https://retail-ready-audit.platforma-czs.ru/
https://retail-ready-audit.platforma-czs.ru/admin/applications
```

## 6. Backups

Back up `data/retail_ready_audit.db*` daily for MVP.

## 7. Production Hardening

- Use HTTPS only.
- Keep `.env.local` outside git.
- Use a long random `ADMIN_TOKEN`.
- Use a strong `ADMIN_PASSWORD`.
- Keep `ENABLE_TELEGRAM_TEST=false`.
- Enable captcha if spam appears.

## 8. DNS

Create DNS record in `platforma-czs.ru` zone:

```txt
Type: A
Name: retail-ready-audit
Value: <server IPv4>
TTL: 300
```

If Timeweb gives IPv6 too, optional:

```txt
Type: AAAA
Name: retail-ready-audit
Value: <server IPv6>
TTL: 300
```
