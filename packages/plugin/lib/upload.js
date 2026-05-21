'use strict';

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

/**
 * Загружает сконвертированный файл на бэкенд, который дальше отправит его
 * в личку пользователю через Telegram.
 *
 * Бросает ошибку с полем `statusCode` при HTTP-ошибке (например 401).
 */
const uploadFile = async (context, {backendUrl, uploadToken, filePath}) => {
  const fileName = path.basename(filePath);
  const format = path.extname(filePath).replace(/^\./, '') || 'mp4';

  const form = new FormData();
  form.append('defaultFileName', context.defaultFileName || fileName);
  form.append('format', format);
  form.append('file', fs.createReadStream(filePath), {filename: fileName});

  context.setProgress('Отправка видео в Telegram…');

  try {
    await context.request(`${backendUrl}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${uploadToken}`,
        ...form.getHeaders()
      },
      body: form,
      // Большие файлы (до 2 ГБ) грузятся долго — не обрываем по таймауту
      // и не повторяем загрузку автоматически.
      timeout: {request: 3600000}, // 1 час
      retry: {limit: 0}
    });
  } catch (error) {
    // got кладёт код ответа в error.response.statusCode
    const statusCode = error && error.response && error.response.statusCode;
    if (statusCode) {
      const wrapped = new Error(`Бэкенд вернул ${statusCode}`);
      wrapped.statusCode = statusCode;
      throw wrapped;
    }

    throw error;
  }
};

module.exports = {uploadFile};
