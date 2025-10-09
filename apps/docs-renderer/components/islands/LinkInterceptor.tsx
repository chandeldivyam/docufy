// apps/docs-renderer/components/islands/LinkInterceptor.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LinkInterceptor() {
  const router = useRouter();

  useEffect(() => {
    // Get base path if it exists (from current URL)
    const basePath = window.location.pathname.match(/^(\/[^/]+)?/)?.[1] || '';

    const handleClick = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as HTMLElement;
      const anchor = target.closest('a');

      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Check if it's an internal link
      const isInternal = href.startsWith('/') && !href.startsWith('//');
      const isHash = href.startsWith('#');
      const hasModifier =
        mouseEvent.metaKey || mouseEvent.ctrlKey || mouseEvent.shiftKey || mouseEvent.altKey;
      const isNewTab = anchor.getAttribute('target') === '_blank';

      // Only intercept internal links without modifiers
      if (isInternal && !isHash && !hasModifier && !isNewTab) {
        e.preventDefault();
        // Don't add basePath if href already includes it
        const finalHref = href.startsWith(basePath) ? href : `${basePath}${href}`;
        router.push(finalHref);
      }
    };

    // Prefetch on hover (like Next.js Link)
    const handleMouseEnter = (e: Event) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      const isInternal = href.startsWith('/') && !href.startsWith('//');
      const isHash = href.startsWith('#');

      if (isInternal && !isHash) {
        const finalHref = href.startsWith(basePath) ? href : `${basePath}${href}`;
        router.prefetch(finalHref);
      }
    };

    // Attach to the article or main content area
    const article = document.querySelector('.dfy-article');
    if (article) {
      article.addEventListener('click', handleClick);
      article.addEventListener('mouseenter', handleMouseEnter, true); // Use capture phase
      return () => {
        article.removeEventListener('click', handleClick);
        article.removeEventListener('mouseenter', handleMouseEnter, true);
      };
    }
  }, [router]);

  return null;
}
