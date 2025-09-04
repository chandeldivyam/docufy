import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ ok: false, error: 'projectId required' }, { status: 400 });
    }
    (await cookies()).set('docufy_active_project', projectId, {
      path: '/',
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
}
