'use strict';

const {ensureToken} = require('./lib/auth');
const {uploadFile} = require('./lib/upload');

const action = async context => {
  const backendUrl = (context.config.get('backendUrl') || '').replace(/\/+$/, '');

  if (!backendUrl) {
    context.notify('Не задан backendUrl в настройках плагина Telegram.');
    return;
  }

  // 1. Убеждаемся, что есть upload-токен (иначе проходим авторизацию через бота).
  let uploadToken;
  try {
    uploadToken = await ensureToken(context, backendUrl);
  } catch (error) {
    context.notify(`Авторизация в Telegram не удалась: ${error.message}`);
    return;
  }

  if (!uploadToken) {
    // Пользователь не завершил авторизацию за отведённое время.
    return;
  }

  // 2. Готовим сконвертированный файл и грузим его на бэкенд.
  const filePath = await context.filePath();

  try {
    await uploadFile(context, {backendUrl, uploadToken, filePath});
    context.notify('Видео отправлено в Telegram');
  } catch (error) {
    if (error.statusCode === 401) {
      // Токен протух/отозван — чистим и просим авторизоваться заново.
      context.config.set('uploadToken', '');
      context.notify('Сессия Telegram истекла. Запустите экспорт снова, чтобы переавторизоваться.');
      return;
    }

    context.notify(`Не удалось отправить видео в Telegram: ${error.message}`);
  }
};

const telegram = {
  title: 'Share to Telegram',
  // Все форматы экспорта NewKap/Kap, чтобы пункт не пропадал ни на одном кодеке
  // (hevc/av1 имеют расширение .mp4; бэкенд сам выберет способ отправки).
  formats: ['mp4', 'hevc', 'av1', 'gif', 'apng', 'webm'],
  action,
  config: {
    backendUrl: {
      title: 'Backend URL',
      type: 'string',
      format: 'uri',
      default: 'https://kap.ai-vfx.com',
      description: 'Адрес бэкенда kap-telegram. Self-hosters указывают свой инстанс.',
      required: false
    }
  }
};

exports.shareServices = [telegram];
