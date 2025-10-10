import LayoutSwitcher from '@/components/layouts/LayoutSwitcher';
export const runtime = 'nodejs';
export default async function ApiRefSpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  return <LayoutSwitcher space={space}>{children}</LayoutSwitcher>;
}
