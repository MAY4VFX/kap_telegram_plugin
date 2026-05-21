#!/bin/sh
set -e

# Тип прокси: socks5 (по умолчанию), socks4 или http.
PROXY_TYPE="${PROXY_TYPE:-socks5}"
PROXY_HOST="${PROXY_HOST:-}"
PROXY_PORT="${PROXY_PORT:-}"

if [ -z "$PROXY_HOST" ] || [ -z "$PROXY_PORT" ]; then
  echo "[entrypoint-proxy] PROXY_HOST/PROXY_PORT не заданы — запускаю без проксирования" >&2
  exec /docker-entrypoint.sh "$@"
fi

# Генерируем конфиг proxychains.
CONF=/etc/proxychains.conf
cat > "$CONF" <<EOF
strict_chain
proxy_dns
remote_dns_subnet 224
# Запас под долгую заливку больших файлов (до 2 ГБ) в Telegram через прокси.
tcp_read_time_out 300000
tcp_connect_time_out 30000
[ProxyList]
$PROXY_TYPE $PROXY_HOST $PROXY_PORT
EOF

echo "[entrypoint-proxy] proxychains → $PROXY_TYPE $PROXY_HOST:$PROXY_PORT" >&2

# proxychains4 ставит LD_PRELOAD и наследуется потомками (включая telegram-bot-api,
# который запускает оригинальный /docker-entrypoint.sh).
export PROXYCHAINS_CONF_FILE="$CONF"
exec proxychains4 -f "$CONF" /docker-entrypoint.sh "$@"
