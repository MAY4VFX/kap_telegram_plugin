import {extname} from 'node:path';
import {Bot, InputFile} from 'grammy';
import {config} from './config.js';

// grammY указывает на локальный Telegram Bot API сервер (apiRoot),
// что снимает лимит 50 МБ и позволяет отправлять файлы до 2 ГБ.
export const bot = new Bot(config.BOT_TOKEN, {
  client: {
    apiRoot: config.BOT_API_ROOT,
    // Локальный сервер хранит файлы на диске, поэтому работаем с локальными путями.
    buildUrl: (root, token, method) => `${root}/bot${token}/${method}`,
    // Отправка файла до 2 ГБ через локальный сервер + прокси может идти долго —
    // даём API-вызовам (sendVideo) запас в 1 час, чтобы не рвалось по таймауту.
    timeoutSeconds: 3600
  }
});

// Видео-контейнеры, которые Telegram умеет показывать как видео.
const VIDEO_EXTS = new Set(['mp4', 'mov', 'm4v', 'webm']);

/**
 * Отправляет медиа напрямую в личку пользователю, выбирая способ по формату:
 *  - gif            → sendAnimation
 *  - mp4/mov/webm…  → sendVideo
 *  - всё остальное  → sendDocument
 * Если «красивый» способ не сработал (Telegram отверг формат) — гарантированно
 * досылаем файл документом, чтобы пользователь его всё равно получил.
 *
 * Формат экспорта hevc/av1 в Kap сохраняется в .mp4, поэтому ориентируемся на расширение.
 */
export async function sendMedia(telegramId: bigint, filePath: string, caption?: string): Promise<void> {
  const id = Number(telegramId);
  const ext = extname(filePath).toLowerCase().replace(/^\./, '');

  try {
    if (ext === 'gif') {
      await bot.api.sendAnimation(id, new InputFile(filePath), {caption});
    } else if (VIDEO_EXTS.has(ext)) {
      await bot.api.sendVideo(id, new InputFile(filePath), {caption, supports_streaming: true});
    } else {
      await bot.api.sendDocument(id, new InputFile(filePath), {caption});
    }
  } catch (error) {
    // Фолбэк: досылаем документом (новый InputFile — поток уже мог быть использован).
    await bot.api.sendDocument(id, new InputFile(filePath), {caption});
  }
}
