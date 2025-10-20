// ./apps/docs-renderer/components/Content.tsx
import type { PageBlob } from '../lib/types';
import { sanitize } from '../lib/html';
import { formatRelativeTime } from '../lib/time'; // Add this import
import CopyButtons from './islands/CopyButtons';
import TocSpy from './islands/TocSpy';
import TableOfContents from './TableOfContents';
import DocPageFrame from './DocPageFrame';
import LinkInterceptor from './islands/LinkInterceptor';
import TabsClient from './islands/TabsClient';
import { PrevNextNav } from './PrevNextNav';
import CopyActions from './islands/CopyActions';
import ImagePreviewer from './islands/ImagePreviewer';

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
  lastModified,
}: {
  blobPromise: Promise<PageBlob>;
  previous?: NavLink | null;
  next?: NavLink | null;
  pageUrl?: string;
  showMobileTopbar?: boolean;
  lastModified?: number;
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
          {lastModified && (
            <div
              className="dfy-last-modified"
              title={new Date(lastModified).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>Last updated {formatRelativeTime(lastModified)}</span>
            </div>
          )}

          <ImagePreviewer />
          <CopyButtons />
          <TocSpy />
          <LinkInterceptor />
          <TabsClient />
        </article>
      </DocPageFrame>
    </div>
  );
}
