// src/routes/__root.tsx
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { ThemeProvider, ThemeScript } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: `utf-8`,
      },
      {
        name: `viewport`,
        content: `width=device-width, initial-scale=1`,
      },
      {
        title: `Docufy Dashboard`,
      },
    ],
    links: [
      {
        rel: `icon`,
        type: `image/svg+xml`,
        href: `/logo.svg`,
      },
      {
        rel: `shortcut icon`,
        href: `/logo.svg`,
      },
      {
        rel: `manifest`,
        href: `/manifest.json`,
      },
    ],
  }),

  component: () => (
    <ThemeProvider defaultTheme="system" enableSystem>
      <RootDocument>
        <Outlet />
        <TanStackRouterDevtools />
        <Toaster />
      </RootDocument>
    </ThemeProvider>
  ),
  notFoundComponent: () => <div>Not found</div>,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* This script prevents FOUC by applying theme before React hydrates */}
        <ThemeScript storageKey="ui-theme" />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
