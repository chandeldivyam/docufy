// apps/docs-renderer/components/islands/LinkInterceptor.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LinkInterceptor() {
  const router = useRouter();

  useEffect(() => {
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
        // Use href as-is - it's already a root-relative path
        router.push(href);
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
        router.prefetch(href);
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
