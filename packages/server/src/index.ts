import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import {config} from './config.js';
import {bot} from './bot.js';
import {authRoutes} from './api/auth.js';
import {uploadRoutes} from './api/upload.js';
import {disconnect} from './db.js';

async function main(): Promise<void> {
  const app = Fastify({
    logger: true,
    bodyLimit: 2 * 1024 * 1024 * 1024 // 2 ГБ
  });

  await app.register(multipart, {
    limits: {fileSize: 2 * 1024 * 1024 * 1024} // 2 ГБ
  });

  app.get('/health', async () => ({status: 'ok'}));

  await app.register(authRoutes);
  await app.register(uploadRoutes);

  await app.listen({port: config.PORT, host: config.HOST});
  app.log.info(`HTTP API слушает ${config.HOST}:${config.PORT}`);

  // Бот в режиме long polling.
  bot.start({
    onStart: info => app.log.info(`Бот @${info.username} запущен`)
  });

  const shutdown = async () => {
    app.log.info('Остановка…');
    await bot.stop();
    await app.close();
    await disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  // eslint-disable-next-line no-console
  console.error('Фатальная ошибка запуска:', error);
  process.exit(1);
});
