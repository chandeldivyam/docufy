// apps/docs-renderer/components/islands/ThemeToggle.tsx
'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  // This useEffect ensures the component only renders on the client, preventing hydration mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Until mounted, we can't know the theme. Render a placeholder to prevent layout shift.
  if (!mounted) {
    return (
      <div
        className="h-9 w-9 rounded-md"
        // Using inline style for the placeholder to avoid potential Tailwind class processing issues during SSR
        style={{ backgroundColor: 'var(--sidebar-hover)', opacity: 0.5 }}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--sidebar-hover)]"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Show the icon that represents the CURRENT theme */}
      {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
