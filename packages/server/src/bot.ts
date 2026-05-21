import {randomBytes} from 'node:crypto';
import {bot} from './telegram.js';
import {prisma} from './db.js';
import {config} from './config.js';

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Привязывает Telegram-аккаунт к сессии авторизации.
 * Создаёт/находит User, выдаёт uploadToken и помечает сессию approved.
 */
async function approveSession(state: string, telegramId: bigint): Promise<boolean> {
  const session = await prisma.authSession.findUnique({where: {state}});
  if (!session || session.status !== 'pending') {
    return false;
  }

  // upsert пользователя по telegramId
  const user = await prisma.user.upsert({
    where: {telegramId},
    create: {telegramId, uploadToken: generateToken()},
    update: {}
  });

  await prisma.authSession.update({
    where: {state},
    data: {status: 'approved', userId: user.id}
  });

  return true;
}

bot.command('start', async ctx => {
  const state = (ctx.match ?? '').trim();
  const telegramId = ctx.from?.id;

  if (typeof telegramId !== 'number') {
    return;
  }

  if (!state) {
    await ctx.reply(
      'Привет! Это бот для доставки записей из Kap.\n' +
        'Откройте Kap, выберите «Share to Telegram» — и вернитесь сюда по ссылке.'
    );
    return;
  }

  if (!config.AUTO_APPROVE) {
    await ctx.reply('Запрос получен. Дождитесь подтверждения администратора.');
    return;
  }

  const ok = await approveSession(state, BigInt(telegramId));

  if (ok) {
    await ctx.reply('✅ Готово, возвращайтесь в Kap — видео будут приходить сюда.');
  } else {
    await ctx.reply('Ссылка устарела или уже использована. Запустите экспорт в Kap заново.');
  }
});

export {bot};
