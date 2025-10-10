// ./apps/docs-renderer/components/Content.tsx
import type { PageBlob } from '../lib/types';
import { sanitize } from '../lib/html';
import CopyButtons from './islands/CopyButtons';
import TocSpy from './islands/TocSpy';
import TableOfContents from './TableOfContents';
import DocPageFrame from './DocPageFrame';
import LinkInterceptor from './islands/LinkInterceptor';
import TabsClient from './islands/TabsClient';
import { PrevNextNav } from './PrevNextNav';
import CopyActions from './islands/CopyActions'; // Import the new component

type NavLink = {
  title: string;
  route: string;
};

export default async function Content({
  blobPromise,
  previous,
  next,
  pageUrl,
  showMobileTopbar,
}: {
  blobPromise: Promise<PageBlob>;
  previous?: NavLink | null;
  next?: NavLink | null;
  pageUrl?: string;
  showMobileTopbar?: boolean;
}) {
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
      <DocPageFrame tocSlot={tocSlot} showMobileTopbar={showMobileTopbar}>
        <article className="dfy-article">
          <div className="dfy-heading-with-actions">
            <h1>{blob.title}</h1>
            {blob.markdown && (
              <CopyActions markdown={blob.markdown} pageUrl={pageUrl ? pageUrl : ''} />
            )}
          </div>
          <div dangerouslySetInnerHTML={{ __html: sanitize(blob.rendered.html) }} />

          <PrevNextNav previous={previous} next={next} />

          <CopyButtons />
          <TocSpy />
          <LinkInterceptor />
          <TabsClient />
        </article>
      </DocPageFrame>
    </div>
  );
}
