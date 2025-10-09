'use client';
import { useEffect } from 'react';

// Minimal progressive enhancement for WAI-ARIA tabs:
// - Click to switch
// - Arrow/Home/End keys
// - Auto-activate tab when linking to an anchor inside a hidden panel
export default function TabsClient() {
  useEffect(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>('div[data-type="tabs"]'));

    function setActive(root: HTMLElement, index: number, focus = false) {
      const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>(':scope > [role="tablist"] [role="tab"]'));
      const panels = Array.from(root.querySelectorAll<HTMLElement>(':scope > .dfy-tabs-content > [role="tabpanel"]'));
      if (!tabs.length || !panels.length) return;

      const max = tabs.length - 1;
      const i = Math.max(0, Math.min(index, max));
      root.setAttribute('data-active-index', String(i));

      tabs.forEach((btn, idx) => {
        btn.setAttribute('aria-selected', String(idx === i));
        btn.tabIndex = idx === i ? 0 : -1;
      });
      panels.forEach((p, idx) => {
        if (idx === i) p.removeAttribute('hidden');
        else p.setAttribute('hidden', 'hidden');
      });
      if (focus) tabs[i]?.focus();
    }

    function wire(root: HTMLElement) {
      const tablist = root.querySelector<HTMLElement>(':scope > [role="tablist"]');
      const tabs = Array.from(tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
      const active = parseInt(root.getAttribute('data-active-index') || '0', 10) || 0;
      setActive(root, active);

      tabs.forEach((btn, idx) => {
        btn.addEventListener('click', () => setActive(root, idx));
        btn.addEventListener('keydown', (e) => {
          const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
          if (!keys.includes(e.key)) return;
          e.preventDefault();
          const last = tabs.length - 1;
          switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
              setActive(root, idx - 1, true);
              break;
            case 'ArrowRight':
            case 'ArrowDown':
              setActive(root, idx + 1, true);
              break;
            case 'Home':
              setActive(root, 0, true);
              break;
            case 'End':
              setActive(root, last, true);
              break;
          }
        });
      });
    }

    // Deep-link: if hash points inside a hidden panel, activate it.
    function activateFromHash() {
      const id = location.hash.replace(/^#/, '');
      if (!id) return;
      const target = document.getElementById(id);
      const panel = target?.closest<HTMLElement>('[role="tabpanel"]');
      const root = panel?.closest<HTMLElement>('div[data-type="tabs"]');
      if (!panel || !root) return;
      const panels = Array.from(root.querySelectorAll<HTMLElement>(':scope > .dfy-tabs-content > [role="tabpanel"]'));
      const idx = panels.indexOf(panel);
      if (idx >= 0) setActive(root, idx);
    }

    all.forEach(wire);
    activateFromHash();
    window.addEventListener('hashchange', activateFromHash);
    return () => window.removeEventListener('hashchange', activateFromHash);
  }, []);
  return null;
}
