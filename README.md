# Docufy - Open Source Documentation Platform

An open-source alternative to Mintlify for creating beautiful, fast, and SEO-optimized documentation sites.

## 🚀 Features

- **Multi-tenant Architecture** - Host unlimited documentation sites
- **Custom Domains** - Support for custom domains and subdomains
- **MDX Support** - Write documentation in Markdown with React components
- **SEO Optimized** - Built for search engine visibility
- **Real-time Collaboration** - Powered by Convex
- **Beautiful Themes** - Customizable themes for your brand
- **Full-text Search** - Fast and accurate documentation search
- **API Documentation** - OpenAPI spec support
- **Analytics** - Built-in analytics for your docs

## 📦 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** Convex
- **Styling:** Tailwind CSS + Shadcn/ui
- **Authentication:** Clerk
- **Deployment:** Vercel
- **Runtime:** React 19
- **Package Manager:** pnpm

## 🛠️ Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10+
- Convex account
- Clerk account

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/docufy.git
cd docufy
```

2. Install dependencies (monorepo root):

```bash
pnpm install
```

3. Start all apps in parallel (via Turborepo):

```bash
pnpm dev
```

4. Start an individual app:

```bash
pnpm --filter @docufy/dashboard dev
# or
pnpm --filter @docufy/docs-renderer dev
```

5. Repo-wide checks:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## 📁 Project Structure

```
docufy/
├── apps/
│   ├── dashboard/        # Admin dashboard (Next.js App Router)
│   └── docs-renderer/    # Public docs site (Next.js App Router)
├── packages/
│   ├── ui/               # Shared UI components (React + TS)
│   ├── mdx-components/   # Custom MDX components (React)
│   ├── eslint-config/    # Shared ESLint flat config
│   ├── prettier-config/  # Shared Prettier config
│   └── tsconfig/         # Shared TS configs
├── turbo.json            # Turborepo pipeline
├── pnpm-workspace.yaml   # pnpm workspaces definition
└── eslint.config.mjs     # Root ESLint config
```

## 🧰 Tooling

- Package manager: pnpm workspaces
- Task runner: Turborepo (caching + orchestration)
- Linting: ESLint 9 (flat config)
- Formatting: Prettier 3 (+ Tailwind plugin)
- TypeScript: Shared configs via `@docufy/tsconfig`
- Git hooks: Husky + lint-staged
- Commits: Conventional Commits via Commitlint

## 🧑‍💻 Developer Workflow

- Format: `pnpm format` (or `pnpm format:check`)
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Build all: `pnpm build`
- Commit: follow Conventional Commits (e.g., `feat:`, `fix:`). Hooks run `lint-staged` and `commitlint`.

## 🚢 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Custom Domain Setup

Documentation for setting up custom domains coming soon.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Mintlify](https://mintlify.com)
- Built with [Next.js](https://nextjs.org)
- Database by [Convex](https://convex.dev)

---

**Built with ❤️ by the Docufy team**
