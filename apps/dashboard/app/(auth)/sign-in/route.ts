import { redirect } from 'next/navigation';
import { getSignInUrl } from '@workos-inc/authkit-nextjs';

// Ensure this endpoint is always dynamic and not statically optimized
export const dynamic = 'force-dynamic';

export async function GET() {
  const authorizationUrl = await getSignInUrl();
  return redirect(authorizationUrl);
}
