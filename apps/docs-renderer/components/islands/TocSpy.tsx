'use client';
import { useEffect } from 'react';

export default function TocSpy() {
  useEffect(() => {
    const article = document.querySelector('.dfy-article');
    if (!article) return;

    const headings = Array.from(article.querySelectorAll('h2, h3')) as HTMLElement[];
    if (!headings.length) return;

    const tocRoots = Array.from(document.querySelectorAll('[data-toc]')) as HTMLElement[];
    const linkSets = tocRoots.map(
      (root) => Array.from(root.querySelectorAll('a')) as HTMLAnchorElement[],
    );
    const idOrder = headings.map((h) => h.id).filter(Boolean);
    const inView = new Set<string>();
    let rafId: number | null = null;

    const setActive = (id: string | null | undefined) => {
      // Toggle active + aria-current across all ToCs
      linkSets.forEach((links) => {
        links.forEach((a) => {
          const match = id && a.hash === `#${id}`;
          if (match) {
            a.classList.add('active');
            a.setAttribute('aria-current', 'location');
          } else {
            a.classList.remove('active');
            a.removeAttribute('aria-current');
          }
        });
      });
    };

    const fallback = () => {
      rafId = null;
      let current: string | null = null;
      for (let i = headings.length - 1; i >= 0; i--) {
        const h = headings[i];
        if (h && h.getBoundingClientRect().top - 80 <= 0) {
          current = h.id || null;
          break;
        }
      }
      setActive(current);
    };
    const scheduleFallback = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(fallback);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).id;
          if (!id) continue;
          if (e.isIntersecting) inView.add(id);
          else inView.delete(id);
        }

        // Find the first ID in the viewport that is also in our ordered list
        const visible = idOrder.filter((id) => inView.has(id));

        if (visible.length > 0) {
          setActive(visible[0]);
        } else {
          // Fallback is now only for edge cases, like being at the very
          // bottom of the page where no heading is in the "zone".
          scheduleFallback();
        }
      },
      {
        root: null,
        // This is the key change:
        // - top: -80px (starts the zone 80px from the top, matching your CSS)
        // - bottom: -40% (makes the zone cover the top 60% of the viewport)
        rootMargin: '-80px 0px -40% 0px',
        threshold: 0,
      },
    );

    headings.forEach((h) => io.observe(h));

    // Respect reduced motion: smooth scrolling handled via CSS; no extra JS.
    const onHash = () => setActive(decodeURIComponent(location.hash.replace(/^#/, '')));
    const onScroll = () => scheduleFallback();
    window.addEventListener('hashchange', onHash);
    window.addEventListener('scroll', onScroll, { passive: true });

    // Focus heading on ToC click (improves screen reader/keyboard experience)
    const onTocClick = (e: Event) => {
      const a = (e.target as HTMLElement)?.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = decodeURIComponent(a.hash.slice(1));
      const h = document.getElementById(id);
      if (h) {
        if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    };
    tocRoots.forEach((r) => r.addEventListener('click', onTocClick, true));

    // Initial selection
    if (location.hash) onHash();
    else scheduleFallback();

    return () => {
      io.disconnect();
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('scroll', onScroll);
      tocRoots.forEach((r) => r.removeEventListener('click', onTocClick, true));
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}
