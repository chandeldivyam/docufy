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
    <div className="dfy-page">
      {/* MAIN */}
      <div className="dfy-article-wrap">
        {/* Mobile inline ToC (collapsible) */}
        {toc.length > 0 && (
          <details className="dfy-toc-inline">
            <summary>On this page</summary>
            <TableOfContents items={toc} label="On this page" variant="inline" />
          </details>
        )}

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
  );
}
