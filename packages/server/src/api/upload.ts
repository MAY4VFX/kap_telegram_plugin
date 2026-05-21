import {createWriteStream} from 'node:fs';
import {unlink, mkdir} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import {prisma} from '../db.js';
import {sendVideo} from '../telegram.js';

function extractToken(authorization?: string): string | undefined {
  if (!authorization) {
    return undefined;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1];
}

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post('/upload', async (request, reply) => {
    const token = extractToken(request.headers.authorization);
    if (!token) {
      return reply.code(401).send({error: 'нужен Bearer токен'});
    }

    const user = await prisma.user.findUnique({where: {uploadToken: token}});
    if (!user) {
      return reply.code(401).send({error: 'недействительный токен'});
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({error: 'файл не передан'});
    }

    const defaultFileName =
      (data.fields.defaultFileName && 'value' in data.fields.defaultFileName
        ? String(data.fields.defaultFileName.value)
        : undefined) ?? data.filename;

    // Стримим во временный файл (локальный Bot API сервер читает с диска).
    const dir = join(tmpdir(), 'kap-telegram');
    await mkdir(dir, {recursive: true});
    const tmpPath = join(dir, `${randomUUID()}-${data.filename}`);

    try {
      await pipeline(data.file, createWriteStream(tmpPath));

      if (data.file.truncated) {
        return reply.code(413).send({error: 'файл превышает лимит'});
      }

      await sendVideo(user.telegramId, tmpPath, defaultFileName);
      return {ok: true};
    } catch (error) {
      request.log.error(error, 'не удалось отправить видео');
      return reply.code(502).send({error: 'не удалось отправить видео в Telegram'});
    } finally {
      await unlink(tmpPath).catch(() => undefined);
    }
  });
}
