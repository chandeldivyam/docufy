export type IconKey = 'dashboard' | 'editor' | 'settings';

export type NavItem = {
  title: string;
  href: string;
  icon: IconKey; // icon key as plain string; component chosen in client
};

export const NAV_ITEMS: readonly NavItem[] = [
  { title: 'Overview', href: '/dashboard', icon: 'dashboard' },
  { title: 'Editor', href: '/dashboard/editor', icon: 'editor' },
  { title: 'Settings', href: '/dashboard/settings', icon: 'settings' },
] as const;
