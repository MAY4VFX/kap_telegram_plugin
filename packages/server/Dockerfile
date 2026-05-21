# --- build stage ---
FROM node:20-slim AS build
WORKDIR /app

# Prisma нуждается в openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY packages/server/package.json ./packages/server/package.json
COPY package.json ./package.json
RUN npm install --prefix packages/server

COPY packages/server ./packages/server
WORKDIR /app/packages/server
RUN npm run build

# --- runtime stage ---
FROM node:20-slim AS runtime
WORKDIR /app/packages/server

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=build /app/packages/server/node_modules ./node_modules
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/packages/server/prisma ./prisma
COPY --from=build /app/packages/server/package.json ./package.json

# Применяем миграции и стартуем
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
