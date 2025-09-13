import { NextResponse } from 'next/server';
import { fetchLatestBy, fetchManifestV3 } from '../../../lib/fetchers';
import { domainPointerUrl } from '../../../lib/site';

export const runtime = 'edge';

export async function GET() {
  try {
    const latest = await fetchLatestBy(await domainPointerUrl());
    const manifest = await fetchManifestV3(latest.manifestUrl);
    return NextResponse.json({
      ok: true,
      buildId: latest.buildId,
      counts: manifest.counts,
      pages: Object.keys(manifest.pages).length,
    });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: 'unknown' }, { status: 500 });
  }
}
