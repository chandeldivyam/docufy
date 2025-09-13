Docs Renderer (Single-tenant MVP)

Quick start

- Set env in `apps/docs-renderer/.env.local`:

```
DOCS_PROJECT_ID=k97dzwbn8f3fmhmwycj467j0cn7pxv0k
DOCS_BLOB_BASE_URL=https://lztadwncingvuutn.public.blob.vercel-storage.com
```

- Run: `pnpm --filter @docufy/docs-renderer dev`

Routes

- `/` redirects to the default space entry from `manifest.json`.
- `/(site)/[space]/[[...slug]]` renders pages. Example:
  - `/post-ranking/ready-for-round`
  - `/post-ranking/first-pag`
  - `/test3/test-page-new`

Design notes

- Edge runtime everywhere for low TTFB.
- `latest.json` fetched with `{ next: { revalidate: 2 } }` so publishes are visible fast.
- `manifest.json`, `tree.json`, and page blobs use `cache: 'force-cache'` (immutable URLs) for maximal caching.
- Server Components stream HTML quickly; minimal client JS.
