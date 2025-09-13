// apps/docs-renderer/components/islands/CopyButtons.tsx
'use client';
import { useEffect } from 'react';

export default function CopyButtons() {
  useEffect(() => {
    const buttons = Array.from(
      document.querySelectorAll('[data-island="copy-button"]'),
    ) as HTMLButtonElement[];
    const handlers = buttons.map((btn) => {
      const handler = async () => {
        const pre = btn.closest('.tt-codeblock-group')?.querySelector('pre');
        if (!pre) return;
        await navigator.clipboard.writeText(pre.textContent ?? '');
        const old = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => (btn.textContent = old ?? 'Copy'), 900);
      };
      btn.addEventListener('click', handler);
      return { btn, handler };
    });
    return () => handlers.forEach(({ btn, handler }) => btn.removeEventListener('click', handler));
  }, []);
  return null;
}
