# Docufy Web App Guide

## Scope & Layout

- TanStack Start + React 19 + Vite app at `apps/web`, file-based routes in `src/routes` (SPA with client guards). Core modules: auth (`lib/auth*`), data (`lib/collections`, `db/schema.ts`), realtime (`lib/y-electric` + shape routes), mutations (`lib/trpc/*`), publish jobs (`inngest/*`), uploads (`lib/blob-uploader.ts`). UI lives in `components/**`.

## Run & Tooling

- `pnpm --filter web dev` (starts Vite + docker compose: Postgres 54321, Electric 3000, Typesense 8108; Caddy enables HTTPS). `pnpm --filter web build` for production bundle; `pnpm --filter web start` runs `.output/server`.
- Quality: `pnpm --filter web lint`, `pnpm --filter web typecheck`, `pnpm --filter web format`. DB: `pnpm --filter web migrate`, `pnpm --filter web migrate:generate`.
- Env hints: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_*`, `GITHUB_*`, `ELECTRIC_SOURCE_ID/SECRET` (prod), `VITE_PUBLIC_VERCEL_BLOB_STORE_ID`, `VITE_PUBLIC_VERCEL_BLOB_BASE_URL`, `BLOB_READ_WRITE_TOKEN`, `DOCS_TS_*`, `VERCEL_TOKEN/TEAM_ID/RENDERER_PROJECT`.

## Data & API Patterns

- Reads flow through Electric shapes proxied in `routes/api/*` using `prepareElectricUrl` + `proxyElectricRequest`; always enforce org membership/filters in the route before proxying.
- Client state uses TanStack DB collections (`lib/collections.ts`) with Zod schemas over snake_case rows. Preload in route loaders and read via `useLiveQuery`; never read via tRPC. On mutations, collections call tRPC and must return `{ txid }` from `generateTxId(tx)`.
- Mutations: tRPC routers in `lib/trpc/*` (spaces, documents, sites) run Drizzle transactions, enforce org roles, and handle slug/rank uniqueness. Avoid calling tRPC directly from components; instead mutate collections.
- Models: spaces/documents/sites + site domains/spaces/builds/themes, org_user_profiles, invitations. Use provided `slugify`/`rank` helpers; documents inside managed API specs are read-only outside the spec importer.

## Collaborative Editing & Realtime

- Yjs sync via `ElectricYjsProvider` (`lib/y-electric/provider.ts`) using Electric shapes `document_updates` and `document_awareness` (`routes/api/shape/$`). Writes stream to `/api/document-updates` and `/api/awareness-updates`, both validating org membership; provider batches updates and uses sendBeacon on tab hide.
- Presence helpers: `use-presence-user` builds deterministic colors/names; auth-aware via `authClient` and org collections.

## Publishing, Search, Domains (Inngest)

- tRPC `sites.publish`/`sites.revert` enqueue Inngest events (`site/publish`, `site/revert`), tracked in `site_builds`. Publish loads Yjs updates, renders with `@docufy/content-kit`, writes manifest/tree/theme to Vercel Blob (`inngest/helpers/blob.ts`), updates `latest.json` + per-domain pointers, and indexes pages into Typesense (`helpers/typesense.ts`). Blob keys and sizes also recorded in `site_content_blobs`.
- Domain lifecycle: `sites.addDomain/removeDomain/verifyDomain` enqueue Inngest functions hitting Vercel APIs (`helpers/domains.ts`) to attach/verify/remove domains; Electric shapes surface status in `site_domains`.
- API specs: `documents.importOpenApi` parses YAML/JSON (dereferenced) and creates `api_spec` children (`api_tag` + endpoints) marked `managedBySpec`; modify by re-importing, not manual edits.

## Assets & Uploads

- Client uploads use `lib/blob-uploader.ts` (`uploadImageToBlob`, `uploadVideoToBlob`, `uploadSiteAssetToBlob`), all POST to `/api/blob/upload` with `clientPayload`. The handler validates session + org membership (document/site lookup) before delegating to `@vercel/blob/client.handleUpload` with whitelisted content types.

## Auth, Routing, UX Conventions

- BetterAuth with organization plugin; use `authClient` hooks and `auth.api.getSession` on the server. Authenticated shell lives under `/_authenticated/$orgSlug`; `_active-org` redirects to the slugged URL once org data replicates.
- Routes/components in kebab-case files; components PascalCase; DB columns snake_case. Path alias `@/*`; TypeScript strict. Prettier (`@docufy/prettier-config`) + ESLint (`@docufy/eslint-config`) are authoritative.
- Tests are sparse; add Vitest + @testing-library/react near features, focusing on collection hooks, tRPC routers, and Inngest helpers for regressions.
