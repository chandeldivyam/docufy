import { redirect } from 'next/navigation';
import { fetchManifestV3 } from '../lib/fetchers';
import { currentBasePath } from '../lib/site';
import { getPointer } from '../lib/pointer';

export const runtime = 'edge';

export default async function Page() {
  const pointer = await getPointer();
  const manifest = await fetchManifestV3(pointer.manifestUrl);
  const target = manifest.nav.spaces[0]?.entry ?? `/${manifest.routing.defaultSpace}`;
  const prefix = (await currentBasePath()) || pointer.basePath || '';
  redirect(`${prefix}${target}`);
}
