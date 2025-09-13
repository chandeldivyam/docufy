// apps/docs-renderer/components/islands/TocSpy.tsx
'use client';
import { useEffect } from 'react';

export default function TocSpy() {
  useEffect(() => {
    const headings = Array.from(
      document.querySelectorAll('.dfy-article h2, .dfy-article h3'),
    ) as HTMLElement[];
    if (!headings.length) return;
    const onScroll = () => {
      const y = window.scrollY + 100;
      if (!headings || !headings.length) return;
      let currentId = headings[0]?.id;
      for (const h of headings) {
        if (h.offsetTop <= y) currentId = h.id;
      }
      document.querySelectorAll('[data-toc] a').forEach((a) => {
        const href = (a as HTMLAnchorElement).getAttribute('href') || '';
        if (href.endsWith(`#${currentId}`)) a.classList.add('active');
        else a.classList.remove('active');
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return null;
}
