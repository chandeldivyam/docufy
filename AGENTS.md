# Repository Guidelines

## Project Structure & Module Organization

- Monorepo managed by pnpm + Turbo. Apps live in `apps/` (`web` for editor/admin APIs, `docs-renderer` for the public docs frontend). Shared libraries live in `packages/` (`content-kit`, `mdx-components`, linting/formatting configs, tsconfig). Internal notes sit in `guidelines/`.
- Source uses TypeScript everywhere; configs stay in the repo root (eslint.config.mjs, pnpm-workspace.yaml, turbo.json).
- Generated build output lands in `.output/`, `.next/`, `dist/`, or `.turbo/`; avoid checking these in.

## Build, Test, and Development Commands

- `pnpm install` — install workspace deps (Node ≥22, pnpm ≥10).
- `pnpm dev` — run all app dev servers in parallel via Turbo; use `pnpm --filter web dev` or `pnpm --filter docs-renderer dev` to scope.
- `pnpm build` — Turbo builds all packages and apps; `pnpm build:packages` builds shared packages only.
- `pnpm lint`, `pnpm typecheck` — eslint + `tsc --noEmit` across the workspace.
- `pnpm ci:verify` — convenience bundle for lint + typecheck + build (what CI runs).

## Coding Style & Naming Conventions

- Formatting is enforced by Prettier (`@docufy/prettier-config` + tailwind plugin); run `pnpm format` or `pnpm format:check`.
- ESLint extends `@docufy/eslint-config`; fix or annotate only when intentional.
- TypeScript strict mode; prefer typed functions/props and explicit return types on shared utilities.
- Naming: files and routes in kebab-case, components in PascalCase, variables in camelCase, database fields snake_case. Keep imports path-based (workspace aliases) instead of deep relative chains.

## Testing Guidelines

- Vitest + @testing-library/react are available in `apps/web` (tests currently sparse). Place new specs near code (`*.test.ts`/`*.test.tsx` or `__tests__/`).
- Run `pnpm --filter web test` for the web app once tests exist; keep tests deterministic and avoid hitting live services.
- Add coverage for new logic, especially data transforms, hooks, and API clients; prefer integration-style component tests over shallow snapshots.

## Commit & Pull Request Guidelines

- Commit messages follow Conventional Commits (`feat: ...`, `fix: ...`, `chore: ...`); commitlint enforces this. Keep scopes small and descriptive.
- Before pushing, run `pnpm format`, `pnpm lint`, `pnpm typecheck`, and, if time permits, `pnpm build` or `pnpm ci:verify`.
- PRs should include a short summary, linked issue/Linear ticket, and notes on env/DB changes. Attach screenshots for UI changes and mention any new scripts or migrations.
- Avoid committing secrets; use `.env.example` in `apps/web` and `apps/docs-renderer` as a reference and document new variables there.

## Security & Configuration Tips

- Local dev for `apps/web` depends on Docker services (Postgres + ElectricSQL). Ensure Docker is running before `pnpm --filter web dev`.
- Keep Typesense, Vercel Blob, and auth credentials in env files or your secrets manager; never hardcode keys in the repo.
