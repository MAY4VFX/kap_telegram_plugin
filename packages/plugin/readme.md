# kap-telegram

> Share your [Kap](https://github.com/wulkano/kap) recordings directly to Telegram

После установки в меню экспорта Kap появляется пункт **Share to Telegram**. При первом
использовании плагин откроет Telegram-бота — нажмите **Start**, и аккаунт будет привязан
автоматически (self-serve). Дальше каждый экспорт уходит вам в личку от бота.

## Установка

В Kap: **Preferences → Plugins → Install Plugin** → найдите `kap-telegram`.

## Настройка

- **Backend URL** — адрес бэкенда. По умолчанию указывает на публичный инстанс.
  Если вы self-host (см. [корневой README](../../README.md)) — впишите свой адрес.

## Как это работает

1. Плагин зовёт `POST /auth/start` → получает `state` и ссылку на бота.
2. Открывает `https://t.me/<bot>?start=<state>`; вы жмёте **Start**.
3. Плагин поллит `GET /auth/status?state=...`, получает `uploadToken` и сохраняет его.
4. На каждый экспорт: `POST /upload` (multipart, `Authorization: Bearer <token>`) →
   бэкенд отправляет видео вам в Telegram.

## License

MIT
