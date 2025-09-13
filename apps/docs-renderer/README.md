Docs Renderer (Multi-tenant by Host)

Quick start

- Set env in `apps/docs-renderer/.env.local`:

```
DOCS_BLOB_BASE_URL=https://<your-public-blob>.public.blob.vercel-storage.com
# Dev-only: override the Host used to resolve domain pointer
# so local dev can point at a real site’s domain alias without DNS.
DOCS_DEV_HOST=first-project-docufy-f7502a.trydocufy.com
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
- Resolves the current site by `Host` only. The app fetches
  `${DOCS_BLOB_BASE_URL}/domains/<host>/latest.json`.
- Dev override: if `DOCS_DEV_HOST` is set (and not in production),
  that value is used instead of the incoming `Host` header.
- `latest.json` fetched with `{ next: { revalidate: 2 } }` so publishes are visible fast.
- `manifest.json`, `tree.json`, and page blobs use `cache: 'force-cache'` (immutable URLs) for maximal caching.
- Server Components stream HTML quickly; minimal client JS.
