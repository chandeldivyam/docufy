import LayoutSwitcher from '@/components/layouts/LayoutSwitcher';
export default async function SpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  return <LayoutSwitcher space={space}>{children}</LayoutSwitcher>;
}
