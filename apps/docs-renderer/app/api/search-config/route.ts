import { NextResponse } from 'next/server';
import { getPointer } from '@/app/../lib/pointer';

export const runtime = 'edge';

export async function GET() {
  const base = process.env.DOCS_WEB_BASE_URL!;
  const secret = process.env.DOCS_SEARCH_SHARED_SECRET!;
  if (!base || !secret) return NextResponse.json({ error: 'misconfigured' }, { status: 500 });

  // Extract siteId from the manifest URL in the pointer
  const ptr = await getPointer();
  const m = /\/sites\/([^/]+)\//.exec(ptr.manifestUrl);
  if (!m) return NextResponse.json({ error: 'siteId-not-found' }, { status: 500 });
  const siteId = m[1]!;

  const res = await fetch(`${base}/api/sites/${siteId}/search-key`, {
    headers: { authorization: `Bearer ${secret}` },
    // no caching of secrets
    cache: 'no-store',
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'upstream-failed' }, { status: 502 });
  }

  const json = await res.json();
  // short private cache is fine (browser won't cache edge responses without explicit header)
  return new NextResponse(JSON.stringify(json), {
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=30' },
  });
}
