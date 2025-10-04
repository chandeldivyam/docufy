# syntax=docker/dockerfile:1.7
FROM node:22-slim AS build
WORKDIR /app
ENV CI=1
RUN corepack enable

# Bump Node heap size
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm i --frozen-lockfile
COPY . .

RUN pnpm -w build:packages
RUN pnpm --filter web build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build /app/apps/web/.output ./apps/web/.output
EXPOSE 3000
CMD ["node", "apps/web/.output/server/index.mjs"]
