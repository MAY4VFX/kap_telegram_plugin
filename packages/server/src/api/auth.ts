import {randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import {prisma} from '../db.js';
import {config} from '../config.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Создаёт сессию авторизации и возвращает ссылку на бота.
  app.post('/auth/start', async () => {
    const state = randomUUID();
    await prisma.authSession.create({data: {state, status: 'pending'}});

    return {
      state,
      botUrl: `https://t.me/${config.BOT_USERNAME}?start=${state}`
    };
  });

  // Плагин поллит статус. На approved возвращает uploadToken.
  app.get<{Querystring: {state?: string}}>('/auth/status', async (request, reply) => {
    const state = request.query.state;
    if (!state) {
      return reply.code(400).send({error: 'state обязателен'});
    }

    const session = await prisma.authSession.findUnique({
      where: {state},
      include: {user: true}
    });

    if (!session) {
      return reply.code(404).send({error: 'сессия не найдена'});
    }

    if (session.status === 'approved' && session.user) {
      return {status: 'approved', uploadToken: session.user.uploadToken};
    }

    return {status: session.status};
  });
}
