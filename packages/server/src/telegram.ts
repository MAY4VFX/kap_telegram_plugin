import {extname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Bot, InputFile} from 'grammy';
import ffprobe from '@ffprobe-installer/ffprobe';
import {config} from './config.js';

const execFileAsync = promisify(execFile);

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

interface VideoMeta {
  width?: number;
  height?: number;
  duration?: number;
}

/**
 * Считывает размеры и длительность видео через ffprobe.
 * Без этих полей Telegram не знает аспект и показывает ролик квадратным.
 * Любая ошибка (нет бинаря, битый файл) → пустой объект: отправим без метаданных.
 */
async function probeVideoMeta(filePath: string): Promise<VideoMeta> {
  try {
    const {stdout} = await execFileAsync(ffprobe.path, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries',
      'stream=width,height,duration:stream_tags=rotate:format=duration',
      '-of', 'json',
      filePath
    ]);

    const data = JSON.parse(stdout) as {
      streams?: Array<{
        width?: number;
        height?: number;
        duration?: string;
        tags?: {rotate?: string};
      }>;
      format?: {duration?: string};
    };

    const stream = data.streams?.[0];
    if (!stream) {
      return {};
    }

    let width = Number(stream.width) || undefined;
    let height = Number(stream.height) || undefined;

    // Записи экрана не повёрнуты; но если попадётся видео с телефона со старым
    // тегом rotate=90/270°, меняем ширину и высоту местами.
    const rotation = Number(stream.tags?.rotate);
    if (Number.isFinite(rotation) && Math.abs(rotation) % 180 === 90 && width && height) {
      [width, height] = [height, width];
    }

    const rawDuration = Number(stream.duration ?? data.format?.duration);
    const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration) : undefined;

    return {width, height, duration};
  } catch {
    return {};
  }
}

/**
 * Отправляет медиа напрямую в личку пользователю, выбирая способ по формату:
 *  - gif            → sendAnimation
 *  - mp4/mov/webm…  → sendVideo
 *  - всё остальное  → sendDocument
 * Для видео/анимации сначала вытаскиваем width/height/duration через ffprobe,
 * иначе Telegram отрисует ролик квадратным с неверным аспектом.
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
      const meta = await probeVideoMeta(filePath);
      await bot.api.sendAnimation(id, new InputFile(filePath), {caption, ...meta});
    } else if (VIDEO_EXTS.has(ext)) {
      const meta = await probeVideoMeta(filePath);
      await bot.api.sendVideo(id, new InputFile(filePath), {caption, supports_streaming: true, ...meta});
    } else {
      await bot.api.sendDocument(id, new InputFile(filePath), {caption});
    }
  } catch (error) {
    // Фолбэк: досылаем документом (новый InputFile — поток уже мог быть использован).
    await bot.api.sendDocument(id, new InputFile(filePath), {caption});
  }
}
