// apps/docs-renderer/components/Content.tsx
import type { PageBlob } from '../lib/types';
import { sanitize } from '../lib/html';
import CopyButtons from './islands/CopyButtons';
import TocSpy from './islands/TocSpy';

export default async function Content({ blobPromise }: { blobPromise: Promise<PageBlob> }) {
  const blob = await blobPromise;
  return (
    <article className="dfy-article">
      <h1>{blob.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: sanitize(blob.rendered.html) }} />
      <CopyButtons />
      <TocSpy />
    </article>
  );
}
