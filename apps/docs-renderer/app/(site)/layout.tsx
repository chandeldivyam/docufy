// app/(site)/layout.tsx
export const runtime = 'edge';
export const preferredRegion = 'auto';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
