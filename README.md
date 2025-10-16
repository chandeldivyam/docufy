# Docufy — Works Blazing Fast

Blazing‑fast, multi‑tenant product documentation with a collaborative editor and first‑class search. Zero spinners by design.

- Hosted app: app.trydocufy.com
- License: MIT

We obsess over user experience and speed—both for end‑readers and for engineers who write docs. The renderer streams instantly and the editor feels local, even at scale.

## Highlights

- Blazing fast docs: Edge‑first renderer, aggressive caching, and atomic publish. No loaders.
- Collaborative editor: Real‑time editing powered by Tiptap + Yjs and Postgres storage.
- Powerful search: Typesense with InstantSearch UI and short‑lived scoped keys per site.
- Multi‑tenant by host: Run many doc sites with custom domains.
- API docs: OpenAPI ingestion and rendering.
- Coming soon: Terminal‑based sync for Git‑driven workflows.

## Architecture (High‑Level)

- Web app (apps/web)
  - TanStack Start + React 19 + Vite
  - Auth via BetterAuth (Google/GitHub)
  - Postgres via Drizzle ORM
  - ElectricSQL for shape‑based sync and fast local reads
  - Inngest for publishing pipeline jobs
  - Vercel Blob for immutable content and manifests
  - Typesense admin for indexing + scoped search key minting

- Docs renderer (apps/docs-renderer)
  - Next.js 15 (Edge runtime) — multi‑tenant by Host
  - Fetches a “pointer” JSON (build id + manifest + theme) from blob storage
  - Streams content rapidly; mounts InstantSearch using a scoped Typesense key

- Search
  - Per‑site versioned Typesense collection with an alias for zero‑downtime swaps
  - Short‑lived, scoped keys issued by the web app and consumed by the renderer

- Infra & deploy
  - SST on AWS for the web service (ECS Fargate) and a small EC2 for Typesense
  - DNS via Vercel (configured in SST)

## Monorepo

```
apps/
  web/            # Editor + admin + APIs (TanStack Start)
  docs-renderer/  # Public docs frontend (Next.js Edge)

packages/
  content-kit/    # Editor/renderer building blocks (Tiptap extensions, renderers)
  mdx-components/ # MDX components used by the renderer
  eslint-config/, prettier-config/, tsconfig/

guidelines/       # Internal notes (not user docs)
```

Note: apps/dashboard has been deprecated and will be removed.

## Quickstart

- Hosted: Sign in at app.trydocufy.com and create a site.
- Local development: A detailed contributor guide is coming soon. For now, see `apps/web/.env.example`, `apps/web/docker-compose.yaml` and `apps/docs-renderer/README.md` for clues. The web app uses Docker (Postgres + ElectricSQL) and Caddy for HTTP/2 in dev.

## How Publishing Works (Summary)

1. You edit collaboratively in the web app. Content lives in Postgres as Yjs updates.
2. A publish job merges updates to ProseMirror JSON, serializes HTML/JSON, writes immutable blobs, and swaps a site alias to the new build.
3. The docs renderer reads the site’s “pointer” (latest build) by Host and streams pages with near‑zero TTFB.

## Search (Summary)

- Each site publishes to a versioned Typesense collection. An alias (e.g. `docs_<siteId>`) always points to the latest build for instant swaps.
- The renderer fetches a short‑lived scoped key from the web app to run client‑side InstantSearch safely.

## Environment

These variables are used across the system. A complete, production‑grade env layout is managed via SST.

- Web (apps/web)
  - DATABASE_URL — Postgres connection
  - BETTER_AUTH_SECRET — session crypto (required in prod)
  - ELECTRIC_SOURCE_ID, ELECTRIC_SOURCE_SECRET — Electric Cloud (optional in dev)
  - BLOB_READ_WRITE_TOKEN, VITE_PUBLIC_VERCEL_BLOB_STORE_ID, VITE_PUBLIC_VERCEL_BLOB_BASE_URL — Vercel Blob
  - INNGEST_SIGNING_KEY, INNGEST_EVENT_KEY — background jobs
  - DOCS_TS_ADMIN_KEY, DOCS_TS_HOST, DOCS_TS_PORT, DOCS_TS_PROTOCOL — Typesense admin + nodes
  - DOCS_SEARCH_SHARED_SECRET — shared secret used to mint scoped search keys for the renderer
  - GOOGLE_CLIENT_ID/SECRET, GITHUB_CLIENT_ID/SECRET — OAuth

- Docs renderer (apps/docs-renderer)
  - DOCS_BLOB_BASE_URL — public blob origin for content
  - DOCS_DEV_HOST — dev override for Host
  - DOCS_WEB_BASE_URL — base URL of the web app (used to fetch a scoped search key)
  - DOCS_SEARCH_SHARED_SECRET — must match the web app to authenticate the key fetch

## Development

We’re formalizing a full contributor guide. In the meantime:

- Format: `pnpm format`
- Lint: `pnpm lint`
- Types: `pnpm typecheck`

CI will run lint and typecheck on every PR; we don’t merge failing builds.

## Deployment

- We use SST on AWS (ECS Fargate for the web service). Typesense runs on a small EC2 instance via a simple bootstrap script.
- Any modern platform could work; community self‑host docs are on the roadmap.

High‑level checklist for production:

- Postgres reachable from the web service
- ElectricSQL (cloud or self‑host) configured
- Typesense reachable from the web service; admin key stored as a secret
- Vercel Blob store configured for content
- Auth provider secrets set; secure cookies in prod

## Philosophy

- Works blazing fast — no spinners. If it feels slow, it’s a bug.
- Reader‑first UX — immediate content, sensible defaults, and thoughtful typography.
- Engineer‑friendly — great DX, typed schemas, and a transparent pipeline.
- No telemetry.

## Roadmap

- [ ] Docs‑as‑Code platform
  - [ ] CLI + terminal sync (pull/push, preview, diff, publish)
  - [ ] GitHub agent: repo connect, PR previews, commit‑driven publishes
  - [ ] Versioning + rollback; single‑link page publish
  - [ ] OpenAPI by URL with daily refetch + auto‑redeploy

- [ ] Search & information architecture
  - [ ] Typesense ranking presets, synonyms, per‑space filters
  - [ ] Tag‑based grouping; hide‑from‑publish; custom docs slugs
  - [ ] SEO: per‑page meta, sitemap/robots, canonical URLs
  - [ ] Support basepath sites (yourdomain.com/docs) alongside CNAMEs

- [ ] Teams, permissions & ops
  - [ ] Roles: owner/editor/viewer; page‑level visibility
  - [ ] Analytics (opt‑in) and “Was this helpful?” feedback
  - [ ] Internationalization (en/es/fr…)
  - [ ] OSS/self‑host docs; contributor & local dev guides

## Screenshots & Media (placeholders)

Add these files when ready; the README will pick them up automatically if you embed them below.

- `docs/media/hero.png` — A published docs site landing page
- `docs/media/editor-collab.gif` — Real‑time collaboration in the editor
- `docs/media/search.gif` — InstantSearch overlay with results
- `docs/media/publish.png` — One‑click publish with version/alias swap
- `docs/media/architecture.png` — System diagram (web ⇄ Postgres/Electric, renderer, Typesense)

> Tip: Keep GIFs short (3–6s) and under 5 MB for fast loading.

## Contributing

We welcome issues and pull requests. Before opening a PR, run:

```
pnpm format
pnpm lint
pnpm typecheck
```

Please use conventional commit messages (e.g., `feat:` / `fix:`). Changesets are configured for package versioning.

---

Built with care for speed and craft. If anything feels slower than instant, tell us.
