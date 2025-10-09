import SidebarShell from '@/components/SidebarShell';
export const runtime = 'nodejs';
export default async function ApiRefSpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  return <SidebarShell space={space}>{children}</SidebarShell>;
}
