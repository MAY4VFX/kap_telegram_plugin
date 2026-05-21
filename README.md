# kap-telegram

Open-source плагин для [Kap](https://github.com/wulkano/kap) + мультипользовательский Telegram-бот.
Выбираете в меню экспорта **Share to Telegram** — и записанное видео приходит вам в личку от бота.

## Как это работает

1. В Kap выбираете output **Share to Telegram**.
2. При первом запуске плагин открывает бота `t.me/<bot>?start=<state>`; жмёте **Start** →
   бот сразу привязывает аккаунт (self-serve) и выдаёт upload-токен. Плагин получает токен поллингом.
3. На каждый экспорт плагин грузит сконвертированное видео на HTTP API бэкенда с токеном.
4. Бэкенд по токену находит ваш `telegram_id` и **напрямую** отправляет видео (`sendVideo`).

Большие файлы (до 2 ГБ) проходят благодаря локальному [Telegram Bot API серверу](https://github.com/aiogram/telegram-bot-api).

## Структура

```
packages/plugin/   npm-пакет kap-telegram (share service для Kap)
packages/server/   бэкенд: grammY-бот + Fastify HTTP API + Prisma/Postgres
docker-compose.yml self-host вне Dokploy (server + telegram-bot-api + postgres)
```

## Self-host

1. Создайте бота у [@BotFather](https://t.me/BotFather) → получите `BOT_TOKEN` и `BOT_USERNAME`.
2. Получите `api_id` / `api_hash` на https://my.telegram.org (или переиспользуйте свои).
3. Скопируйте `.env.example` → `.env` и заполните значения.
4. Поднимите всё:

   ```bash
   docker compose up -d --build
   ```

   Миграции Prisma применяются автоматически при старте контейнера `server`.
5. Откройте бэкенд снаружи (домен/туннель) и пропишите этот адрес в настройке плагина **Backend URL**.

### Локальная разработка сервера

```bash
cd packages/server
npm install
cp ../../.env.example .env   # поправьте DATABASE_URL/BOT_API_ROOT под localhost
npx prisma migrate dev
npm run dev
```

## Установка плагина в Kap

В Kap: **Preferences → Plugins → Install Plugin** → `kap-telegram`.
Затем в настройках плагина укажите свой **Backend URL**.

Для разработки плагина:

```bash
cd packages/plugin
npm install
npm link
# после запуска Kap:
npm link kap-telegram
npm test   # kap-plugin-test + kap-plugin-mock-context
```

## Проверка end-to-end (curl)

```bash
# 1. создать сессию
curl -X POST http://localhost:3000/auth/start
# → {"state":"...","botUrl":"https://t.me/<bot>?start=<state>"}
# открыть botUrl, нажать Start

# 2. забрать токен
curl "http://localhost:3000/auth/status?state=<state>"
# → {"status":"approved","uploadToken":"..."}

# 3. отправить файл
curl -F file=@sample.mp4 -H "Authorization: Bearer <token>" http://localhost:3000/upload
# → видео приходит в личку
```

## Деплой в Dokploy

Создаётся проект `kap-telegram` с тремя отдельными сервисами (не compose):

1. **Postgres** (Database) → `DATABASE_URL`.
2. **`kap-tg-bot-api`** (docker, `aiogram/telegram-bot-api:latest`): env `TELEGRAM_API_ID`,
   `TELEGRAM_API_HASH`, `TELEGRAM_LOCAL=true`, `PROXY_HOST=192.168.2.140`, `PROXY_PORT=1080`. Порт 8081.
3. **`kap-tg-server`** (git → этот репозиторий, build из `packages/server`): env `BOT_TOKEN`,
   `BOT_USERNAME`, `DATABASE_URL`, `BOT_API_ROOT=http://tasks.kap-tg-bot-api-<suffix>:8081`,
   `PUBLIC_BACKEND_URL`, `AUTO_APPROVE=true`. Прокси серверу НЕ нужен.

Auto-deploy по пушу в `main`. На `kap-tg-server` повесить домен (порт 3000) — это `PUBLIC_BACKEND_URL`.

## Roadmap

- `/revoke` — отзыв/ротация токена.
- Rate limiting на `/upload`, cron-очистка просроченных `AuthSession`.

## License

MIT
