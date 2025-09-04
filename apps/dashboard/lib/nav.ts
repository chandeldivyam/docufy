export type IconKey = 'dashboard' | 'editor' | 'settings';

export type NavItem = {
  title: string;
  href: string;
  icon: IconKey; // icon key as plain string; component chosen in client
};

export function getNavItems(projectId?: string): readonly NavItem[] {
  if (!projectId) {
    return [{ title: 'Overview', href: '/dashboard', icon: 'dashboard' }] as const;
  }
  return [
    { title: 'Overview', href: `/dashboard/${projectId}`, icon: 'dashboard' },
    { title: 'Editor', href: `/dashboard/${projectId}/editor`, icon: 'editor' },
    { title: 'Settings', href: `/dashboard/${projectId}/settings`, icon: 'settings' },
  ] as const;
}
