'use strict';

const open = require('open');

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000; // 3 минуты

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Возвращает действующий uploadToken. Если токена нет — запускает self-serve
 * авторизацию: создаёт сессию на бэкенде, открывает бота и поллит статус.
 *
 * @returns {Promise<string|undefined>} токен или undefined, если авторизация не завершена.
 */
const ensureToken = async (context, backendUrl) => {
  const existing = context.config.get('uploadToken');
  if (existing) {
    return existing;
  }

  // 1. Создаём сессию авторизации.
  // ВНИМАНИЕ: Kap/NewKap бандлят got@9 → JSON включается опцией `json: true`
  // (а не `responseType`), query-параметры передаются полем `query`.
  const startResponse = await context.request(`${backendUrl}/auth/start`, {
    method: 'POST',
    json: true
  });

  const body = typeof startResponse.body === 'string' ? JSON.parse(startResponse.body) : startResponse.body;
  const {state, botUrl} = body || {};
  if (!state || !botUrl) {
    throw new Error('Бэкенд вернул некорректный ответ /auth/start');
  }

  // 2. Открываем бота в браузере и просим нажать Start.
  context.setProgress('Откройте Telegram и нажмите Start…');
  await open(botUrl);

  // 3. Поллим статус, пока пользователь не нажмёт Start (или не истечёт таймаут).
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await delay(POLL_INTERVAL_MS);

    const statusResponse = await context.request(`${backendUrl}/auth/status`, {
      method: 'GET',
      query: {state},
      json: true
    });

    const statusBody = typeof statusResponse.body === 'string' ? JSON.parse(statusResponse.body) : statusResponse.body;
    const {status, uploadToken} = statusBody || {};

    if (status === 'approved' && uploadToken) {
      context.config.set('uploadToken', uploadToken);
      context.setProgress('Telegram привязан ✓');
      return uploadToken;
    }

    if (status === 'rejected') {
      throw new Error('Доступ отклонён');
    }
  }

  context.setProgress('Авторизация Telegram не завершена вовремя.');
  return undefined;
};

module.exports = {ensureToken};
