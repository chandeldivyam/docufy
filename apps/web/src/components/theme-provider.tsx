// src/components/theme-provider.tsx
"use client"

import * as React from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext =
  React.createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ui-theme",
  enableSystem = true,
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(
    () =>
      (typeof window !== "undefined"
        ? (localStorage.getItem(storageKey) as Theme)
        : defaultTheme) || defaultTheme
  )

  React.useEffect(() => {
    const root = window.document.documentElement

    // Remove existing theme classes
    root.classList.remove("light", "dark")

    // Handle transition disabling
    if (disableTransitionOnChange) {
      root.classList.add("[&_*]:!transition-none")
    }

    if (theme === "system" && enableSystem) {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)

      // Add listener for system theme changes
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = () => {
        const newSystemTheme = mediaQuery.matches ? "dark" : "light"
        root.classList.remove("light", "dark")
        root.classList.add(newSystemTheme)
      }

      mediaQuery.addEventListener("change", handleChange)

      // Re-enable transitions after a frame
      if (disableTransitionOnChange) {
        const timer = setTimeout(() => {
          root.classList.remove("[&_*]:!transition-none")
        }, 1)

        return () => {
          clearTimeout(timer)
          mediaQuery.removeEventListener("change", handleChange)
        }
      }

      return () => mediaQuery.removeEventListener("change", handleChange)
    } else {
      root.classList.add(theme)

      // Re-enable transitions after a frame
      if (disableTransitionOnChange) {
        const timer = setTimeout(() => {
          root.classList.remove("[&_*]:!transition-none")
        }, 1)

        return () => clearTimeout(timer)
      }
    }
  }, [theme, enableSystem, disableTransitionOnChange])

  const value = React.useMemo(
    () => ({
      theme,
      setTheme: (newTheme: Theme) => {
        localStorage.setItem(storageKey, newTheme)
        setThemeState(newTheme)
      },
    }),
    [theme, storageKey]
  )

  return (
    <ThemeProviderContext.Provider value={value} {...props}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}

// Inline script to prevent FOUC
export const ThemeScript = ({
  storageKey = "ui-theme",
}: {
  storageKey?: string
}) => {
  const scriptContent = `
    (function() {
      const storageKey = '${storageKey}';
      const theme = localStorage.getItem(storageKey);
      const root = document.documentElement;
      
      if (theme === 'dark' || 
          (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    })();
  `

  return (
    <script
      dangerouslySetInnerHTML={{ __html: scriptContent }}
      suppressHydrationWarning
    />
  )
}
