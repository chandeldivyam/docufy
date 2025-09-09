// lib/nav.ts
export type IconKey = 'dashboard' | 'settings';

export type NavItem = {
  title: string;
  href: string;
  icon: IconKey;
};

export function getNavItems(projectId?: string): readonly NavItem[] {
  if (!projectId) {
    return [{ title: 'Overview', href: '/dashboard', icon: 'dashboard' }] as const;
  }
  return [{ title: 'Overview', href: `/dashboard/${projectId}`, icon: 'dashboard' }] as const;
}
