// apps/docs-renderer/components/Content.tsx
import type { PageBlob } from '../lib/types';
import { sanitize } from '../lib/html';
import CopyButtons from './islands/CopyButtons';
import TocSpy from './islands/TocSpy';
import TableOfContents from './TableOfContents';
import DocPageFrame from './DocPageFrame';

export default async function Content({ blobPromise }: { blobPromise: Promise<PageBlob> }) {
  const blob = await blobPromise;
  const toc = (blob.rendered.toc as Array<{ level: number; text: string; id: string }>) ?? [];

  const tocSlot =
    toc.length > 0 ? (
      <aside className="dfy-toc-rail" aria-label="On this page">
        <TableOfContents items={toc} label="On this page" variant="rail" />
      </aside>
    ) : null;

  return (
    <div className="dfy-page">
      <DocPageFrame tocSlot={tocSlot}>
        <article className="dfy-article">
          <h1>{blob.title}</h1>
          <div dangerouslySetInnerHTML={{ __html: sanitize(blob.rendered.html) }} />
          <CopyButtons />
          <TocSpy />
        </article>
      </DocPageFrame>
    </div>
  );
}
