import { NextResponse } from 'next/server';
import { fetchLatest, fetchManifestV3 } from '../../../lib/fetchers';

export const runtime = 'edge';

export async function GET() {
  try {
    const latest = await fetchLatest();
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
