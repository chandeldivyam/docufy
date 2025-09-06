import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardRedirect() {
  const cookie = (await cookies()).get('docufy_active_project');
  if (cookie?.value) return redirect(`/dashboard/${cookie.value}`);
  return redirect('/dashboard/onboarding/new-project');
}
