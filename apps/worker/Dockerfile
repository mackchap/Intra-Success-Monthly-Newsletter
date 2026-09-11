# syntax=docker/dockerfile:1
# Builds the BullMQ worker service from the npm-workspaces monorepo root.
# Railway service settings: Root Directory = repo root, Dockerfile Path = apps/worker/Dockerfile

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
RUN npm run build -w apps/worker

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/worker ./apps/worker
COPY --from=build /app/packages/db ./packages/db

CMD ["node", "apps/worker/dist/index.js"]
