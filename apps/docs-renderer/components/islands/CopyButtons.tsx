// apps/docs-renderer/components/islands/CopyButtons.tsx
'use client';
import { useEffect } from 'react';

export default function CopyButtons() {
  useEffect(() => {
    const root = document;
    const live = root.querySelector('[data-copy-live]') as HTMLElement | null;

    const fallbackCopy = (text: string) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        console.log('Failed to copy to clipboard');
      }
      ta.remove();
    };

    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-island="copy-button"]'),
    );
    const handlers = buttons.map((btn) => {
      const handler = async () => {
        const pre = btn.closest('.tt-codeblock-group')?.querySelector('pre');
        if (!pre) return;
        const text = pre.textContent ?? '';
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            fallbackCopy(text);
          }
          btn.dataset.copied = 'true';
          btn.textContent = 'Copied';
          if (live) {
            live.setAttribute('aria-live', 'polite'); // announce politely
            live.textContent = 'Copied code to clipboard.';
          }
          setTimeout(() => {
            btn.dataset.copied = 'false';
            btn.textContent = 'Copy';
            if (live) {
              live.textContent = '';
            }
          }, 1200);
        } catch {
          console.log('Failed to copy to clipboard');
        }
      };
      btn.addEventListener('click', handler);
      return { btn, handler };
    });

    return () => handlers.forEach(({ btn, handler }) => btn.removeEventListener('click', handler));
  }, []);

  // Pre-register a live region so screen readers hear status updates
  return <div hidden data-copy-live role="status" aria-live="polite" />;
}
