'use client';

// apps/docs-renderer/components/islands/ImagePreviewer.tsx
// Minimal image lightbox overlay for any image inside `.dfy-article`.
// - Delegated click handler (no per-image listeners)
// - Backdrop click and Escape close
// - Restores focus and locks body scroll via CSS :has()

import { useEffect } from 'react';

export default function ImagePreviewer() {
  useEffect(() => {
    const root = document.querySelector('.dfy-article');
    if (!root) return;

    // Overlay DOM (created lazily on first open, then reused)
    let overlay: HTMLDivElement | null = null;
    let fig: HTMLElement | null = null;
    let imgEl: HTMLImageElement | null = null;
    let captionEl: HTMLElement | null = null;
    let closeBtn: HTMLButtonElement | null = null;
    let previouslyFocused: HTMLElement | null = null;

    const isInNoZoomZone = (el: Element | null): boolean => {
      if (!el) return false;
      return !!el.closest('.dfy-no-zoom,[data-no-zoom]');
    };

    const qualifiesBySize = (img: HTMLImageElement): boolean => {
      const w = img.naturalWidth || img.width || img.clientWidth;
      const h = img.naturalHeight || img.height || img.clientHeight;
      return w >= 48 && h >= 48; // avoid icons/sprites by default
    };

    const markPreviewables = () => {
      const imgs = root.querySelectorAll<HTMLImageElement>('img');
      imgs.forEach((img) => {
        if (img.hasAttribute('data-no-zoom')) return;
        if (isInNoZoomZone(img)) return;
        if (qualifiesBySize(img)) img.setAttribute('data-previewable', 'true');
      });
    };
    markPreviewables();

    // Also mark images after they load (natural sizes become available)
    const loadHandler = (e: Event) => {
      const t = e.target as HTMLImageElement;
      if (!t || t.tagName !== 'IMG') return;
      if (!t.hasAttribute('data-no-zoom') && !isInNoZoomZone(t) && qualifiesBySize(t)) {
        t.setAttribute('data-previewable', 'true');
      }
    };
    root.addEventListener('load', loadHandler, true);

    const buildOverlay = () => {
      overlay = document.createElement('div');
      overlay.className = 'dfy-img-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Image preview');
      overlay.setAttribute('aria-hidden', 'true');

      fig = document.createElement('figure');
      fig.className = 'dfy-img-zoom';
      fig.setAttribute('tabindex', '-1');

      imgEl = document.createElement('img');
      imgEl.alt = '';

      captionEl = document.createElement('figcaption');
      captionEl.className = 'dfy-img-caption';

      closeBtn = document.createElement('button');
      closeBtn.className = 'dfy-img-close';
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML =
        '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

      fig.appendChild(imgEl);
      fig.appendChild(captionEl);
      fig.appendChild(closeBtn);
      overlay.appendChild(fig);

      document.body.appendChild(overlay);
    };

    const getCaptionFor = (img: HTMLImageElement): string => {
      // Prefer <figure> > <figcaption>, then title, then alt
      const fig = img.closest('figure');
      const cap = fig?.querySelector('figcaption');
      if (cap && cap.textContent) return cap.textContent.trim();
      const title = img.getAttribute('title');
      if (title) return title;
      const alt = img.getAttribute('alt');
      if (alt) return alt;
      return '';
    };

    const openOverlay = (img: HTMLImageElement) => {
      if (!overlay) buildOverlay();
      if (!overlay || !imgEl || !captionEl || !closeBtn || !fig) return;

      previouslyFocused = (document.activeElement as HTMLElement) ?? null;

      // Pick the best candidate. currentSrc is the resolved source; for zoom a higher res is OK.
      const src = img.currentSrc || img.getAttribute('src') || '';
      imgEl.src = src;
      imgEl.alt = img.alt || '';
      const cap = getCaptionFor(img);
      const normalized = (cap || '').trim();
      const isMeaningful = normalized.length > 0 && !/^(null|undefined)$/i.test(normalized);
      captionEl.textContent = isMeaningful ? normalized : '';
      captionEl.hidden = !isMeaningful;

      overlay.style.display = 'grid';
      overlay.setAttribute('aria-hidden', 'false');

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeOverlay();
        } else if (e.key === 'Tab') {
          // Simple focus trap between close button and figure
          const focusables: HTMLElement[] = [closeBtn!];
          const idx = focusables.indexOf(document.activeElement as HTMLElement);
          if (idx === -1) {
            e.preventDefault();
            closeBtn!.focus();
          } else {
            e.preventDefault();
            closeBtn!.focus();
          }
        }
      };

      const onClick = (e: MouseEvent) => {
        // Close when clicking outside the figure (backdrop area)
        if (e.target === overlay) closeOverlay();
      };

      const closeOverlay = () => {
        if (!overlay) return;
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', onKey, true);
        overlay.removeEventListener('click', onClick);
        if (previouslyFocused) previouslyFocused.focus({ preventScroll: true });
      };

      // Wire for this open
      document.addEventListener('keydown', onKey, true);
      overlay.addEventListener('click', onClick);
      closeBtn.addEventListener('click', closeOverlay, { once: true });

      // Initial focus
      closeBtn.focus({ preventScroll: true });
    };

    const handleClick = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const t = mouseEvent.target as Element | null;
      if (!t) return;
      const img = t.closest('img');
      if (!img) return;
      if (!(img instanceof HTMLImageElement)) return;
      if (!root.contains(img)) return;
      if (img.hasAttribute('data-no-zoom')) return;
      if (isInNoZoomZone(img)) return;
      if (!qualifiesBySize(img)) return;

      // If the image is inside an anchor, we still intercept to show preview.
      // Stop other link interceptors when we handle it.
      e.preventDefault();
      e.stopPropagation();

      openOverlay(img);
    };

    // Attach delegated click on bubble phase
    root.addEventListener('click', handleClick);

    // Observe DOM changes to mark newly inserted images
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLImageElement) {
            if (!n.hasAttribute('data-no-zoom') && !isInNoZoomZone(n) && qualifiesBySize(n)) {
              n.setAttribute('data-previewable', 'true');
            }
          } else if (n instanceof HTMLElement) {
            n.querySelectorAll('img').forEach((img) => {
              if (
                !img.hasAttribute('data-no-zoom') &&
                !isInNoZoomZone(img) &&
                qualifiesBySize(img)
              ) {
                img.setAttribute('data-previewable', 'true');
              }
            });
          }
        });
      }
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      root.removeEventListener('click', handleClick);
      root.removeEventListener('load', loadHandler, true);
      mo.disconnect();
      if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
      overlay = null;
    };
  }, []);
  return null;
}
