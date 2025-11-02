'use client';

import Link from 'next/link';
import { Button } from '../ui/button';

/**
 * Closes the mobile sidebar by unchecking the mobile nav toggle checkbox.
 */
function closeMobileSidebar() {
  if (typeof document === 'undefined') return;
  const toggle = document.getElementById('dfy-mobile-nav-toggle') as HTMLInputElement | null;
  if (toggle) {
    toggle.checked = false;
  }
}

export default function SidebarNavLinkButton({
  btn,
  hrefPrefix,
}: {
  btn: {
    id: string;
    label: string;
    href: string;
    iconSvg?: string | null;
    target?: '_self' | '_blank';
  };
  hrefPrefix: string;
}) {
  const isExternal = /^(https?:)?\/\//i.test(btn.href);
  const href = isExternal ? btn.href : `${hrefPrefix}${btn.href}`;

  return (
    <Button
      key={btn.id}
      variant="ghost"
      className="sidebar-link h-9 w-full justify-start text-[15px] font-medium"
      asChild
    >
      <Link
        prefetch={!isExternal}
        href={href}
        target={btn.target ?? (isExternal ? '_blank' : undefined)}
        rel={btn.target === '_blank' || isExternal ? 'noopener noreferrer' : undefined}
        onClick={closeMobileSidebar}
      >
        {btn.iconSvg ? (
          <span
            className="mr-2 inline-block h-4 w-4"
            dangerouslySetInnerHTML={{ __html: btn.iconSvg }}
          />
        ) : null}
        {btn.label}
      </Link>
    </Button>
  );
}
