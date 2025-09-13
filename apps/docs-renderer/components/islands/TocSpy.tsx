'use client';
import { useEffect } from 'react';

export default function TocSpy() {
  useEffect(() => {
    const headings = Array.from(
      document.querySelectorAll('.dfy-article h2, .dfy-article h3'),
    ) as HTMLElement[];
    if (!headings.length) return;

    const tocLinks = Array.from(document.querySelectorAll('[data-toc] a')) as HTMLAnchorElement[];

    const setActive = (id: string | null) => {
      tocLinks.forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (id && href.endsWith(`#${id}`)) a.classList.add('active');
        else a.classList.remove('active');
      });
    };

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop,
          );
        const id = visible[0]?.target?.id ?? null;
        setActive(id);
      },
      { rootMargin: '0px 0px -70% 0px', threshold: [0, 1] },
    );

    headings.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, []);

  return null;
}
