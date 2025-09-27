// apps/docs-renderer/components/Content.tsx
import type { PageBlob } from '../lib/types';
import { sanitize } from '../lib/html';
import CopyButtons from './islands/CopyButtons';
import TocSpy from './islands/TocSpy';
import TableOfContents from './TableOfContents';

export default async function Content({ blobPromise }: { blobPromise: Promise<PageBlob> }) {
  const blob = await blobPromise;
  const toc = (blob.rendered.toc as Array<{ level: number; text: string; id: string }>) ?? [];

  return (
    <>
      {/* 
        Mobile-only nav toggle + backdrop.
        - The checkbox drives CSS to slide the left sidebar in/out.
        - The backdrop is a <label> that closes the drawer when tapped.
      */}
      <input
        id="dfy-mobile-nav-toggle"
        type="checkbox"
        className="dfy-mobile-nav-toggle"
        aria-hidden="true"
      />
      <label htmlFor="dfy-mobile-nav-toggle" className="dfy-sidebar-backdrop" aria-hidden="true" />

      <div className="dfy-page">
        {/* MAIN */}
        <div className="dfy-article-wrap">
          {/* --- MOBILE TOP BAR (sticky): hamburger + last two crumbs --- */}
          <div className="dfy-mobile-topbar" aria-label="Breadcrumb and menu">
            <label
              htmlFor="dfy-mobile-nav-toggle"
              className="dfy-hamburger"
              aria-label="Open navigation"
              role="button"
              tabIndex={0}
            >
              {/* Simple inline hamburger icon to avoid extra deps */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 6h18M3 12h18M3 18h18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </label>
          </div>

          <article className="dfy-article">
            <h1>{blob.title}</h1>
            <div dangerouslySetInnerHTML={{ __html: sanitize(blob.rendered.html) }} />
            <CopyButtons />
            <TocSpy />
          </article>
        </div>

        {/* RIGHT RAIL ToC (sticky) */}
        {toc.length > 0 && (
          <aside className="dfy-toc-rail" aria-label="On this page">
            <TableOfContents items={toc} label="On this page" variant="rail" />
          </aside>
        )}
      </div>
    </>
  );
}
