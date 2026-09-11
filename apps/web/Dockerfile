# syntax=docker/dockerfile:1
# Builds the Next.js web service from the npm-workspaces monorepo root.
# Railway service settings: Root Directory = repo root, Dockerfile Path = apps/web/Dockerfile
#
# On boot the container runs `prisma migrate deploy` before starting Next.js,
# so every deploy applies pending migrations before serving traffic.

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w packages/db
RUN npm run build -w apps/web

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/packages/db ./packages/db

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy --schema packages/db/prisma/schema.prisma && npm run start -w apps/web"]
