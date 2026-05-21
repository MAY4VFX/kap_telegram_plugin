# Локальный Telegram Bot API сервер (лимит файлов до 2 ГБ),
# у которого ВЕСЬ исходящий трафик к Telegram DC заворачивается в SOCKS5/HTTP-прокси
# через proxychains-ng (LD_PRELOAD, без NET_ADMIN/iptables).
#
# Это нужно потому, что хост Dokploy не имеет прямого доступа к Telegram,
# а штатный флаг telegram-bot-api `--proxy` проксирует только webhook-запросы,
# но НЕ соединение с дата-центрами.
FROM aiogram/telegram-bot-api:latest

USER root
RUN apk add --no-cache proxychains-ng

COPY packages/bot-api/entrypoint-proxy.sh /entrypoint-proxy.sh
RUN chmod +x /entrypoint-proxy.sh

ENTRYPOINT ["/entrypoint-proxy.sh"]
