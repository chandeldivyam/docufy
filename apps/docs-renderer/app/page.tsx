import { redirect } from 'next/navigation';
import { fetchLatest, fetchManifestV3 } from '../lib/fetchers';

export const runtime = 'edge';

export default async function Page() {
  const latest = await fetchLatest();
  const manifest = await fetchManifestV3(latest.manifestUrl);
  const target = manifest.nav.spaces[0]?.entry ?? `/${manifest.routing.defaultSpace}`;
  redirect(target);
}
