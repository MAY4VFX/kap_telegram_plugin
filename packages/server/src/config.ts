import {z} from 'zod';

const schema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN обязателен'),
  BOT_USERNAME: z.string().min(1, 'BOT_USERNAME обязателен'),

  BOT_API_ROOT: z.string().url().default('http://telegram-bot-api:8081'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),

  PUBLIC_BACKEND_URL: z.string().url().default('http://localhost:3000'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  AUTO_APPROVE: z
    .enum(['true', 'false'])
    .default('true')
    .transform(value => value === 'true')
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Ошибка конфигурации окружения:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
