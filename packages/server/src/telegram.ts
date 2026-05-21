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

/**
 * Отправляет видео напрямую в личку пользователю.
 */
export async function sendVideo(telegramId: bigint, filePath: string, caption?: string): Promise<void> {
  await bot.api.sendVideo(Number(telegramId), new InputFile(filePath), {
    caption,
    supports_streaming: true
  });
}
