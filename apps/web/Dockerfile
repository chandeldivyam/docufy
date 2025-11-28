# syntax=docker/dockerfile:1.7
FROM node:22-slim AS build
WORKDIR /app
ENV CI=1
RUN corepack enable

# ↓ make build args available during the build
ARG VITE_PUBLIC_VERCEL_BLOB_STORE_ID
ARG VITE_PUBLIC_VERCEL_BLOB_BASE_URL
ARG VITE_PUBLIC_POSTHOG_KEY
ARG VITE_PUBLIC_POSTHOG_HOST
ARG VITE_PUBLIC_GITHUB_APP_SLUG
# ↓ export them to the environment of subsequent RUN steps, so vite can read them
ENV VITE_PUBLIC_VERCEL_BLOB_STORE_ID=${VITE_PUBLIC_VERCEL_BLOB_STORE_ID}
ENV VITE_PUBLIC_VERCEL_BLOB_BASE_URL=${VITE_PUBLIC_VERCEL_BLOB_BASE_URL}
ENV VITE_PUBLIC_POSTHOG_KEY=${VITE_PUBLIC_POSTHOG_KEY}
ENV VITE_PUBLIC_POSTHOG_HOST=${VITE_PUBLIC_POSTHOG_HOST}
ENV VITE_PUBLIC_GITHUB_APP_SLUG=${VITE_PUBLIC_GITHUB_APP_SLUG}

# Bump Node heap size
ENV NODE_OPTIONS="--max-old-space-size=8192"

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
