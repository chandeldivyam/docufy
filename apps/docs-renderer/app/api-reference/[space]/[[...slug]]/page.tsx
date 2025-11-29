// apps/docs-renderer/app/api-reference/[space]/[[...slug]]/page.tsx
import { APIPage } from 'fumadocs-openapi/ui';
import { fetchManifestV3, fetchPageBlob } from '../../../../lib/fetchers';
import { getPointer } from '../../../../lib/pointer';
import DocPageFrame from '../../../../components/DocPageFrame';
import { openapi } from '@/lib/openapi';

export const runtime = 'nodejs';

export default async function ApiHandler({
  params,
}: {
  params: Promise<{ space: string; slug?: string[] }>;
}) {
  const { space, slug } = await params;
  const pointer = await getPointer();
  const manifest = await fetchManifestV3(pointer.manifestUrl);

  const route = `/api-reference/${space}/${(slug ?? []).join('/')}`.replace(/\/$/, '');
  const page = manifest.pages[route];

  if (!page || page.kind !== 'api') {
    return <div>API page not found for route: {route}</div>;
  }

  const blob = await fetchPageBlob(page.blob);
  if (!blob.apiPath || !blob.apiMethod || !blob.apiSpecBlobKey) {
    throw new Error('API page data is incomplete.');
  }

  const showMobileTopbar = manifest.site.layout !== 'tabs';
  return (
    <DocPageFrame showMobileTopbar={showMobileTopbar}>
      <div className="fd-scope pt-5">
        <APIPage
          {...openapi.getAPIPageProps({
            document: blob.apiSpecBlobKey,
            operations: [{ path: blob.apiPath, method: blob.apiMethod.toLowerCase() }],
            hasHead: true,
            shikiOptions: {
              themes: {
                light: 'light-plus',
                dark: 'slack-dark',
              },
            },
          })}
        />
      </div>
    </DocPageFrame>
  );
}
