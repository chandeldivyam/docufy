import type { Manifest } from '@/lib/types';
import Link from 'next/link';

export default function Logo({
  manifest,
  hrefPrefix = '',
}: {
  manifest: Manifest;
  hrefPrefix?: string;
}) {
  const light = manifest.site.branding?.logo?.light ?? manifest.site.logoUrl ?? '';
  const dark = manifest.site.branding?.logo?.dark ?? light;
  const name = manifest.site.name ?? '';
  const home = `${hrefPrefix || ''}/`.replace(/\/+$/, '/');
  return (
    <Link prefetch href={home} className="inline-flex items-center gap-2 no-underline">
      <span className="flex w-[110px] shrink-0 items-center justify-center">
        {light ? <img src={light} alt="Logo" className="object-contain dark:hidden" /> : null}
        {dark ? <img src={dark} alt="Logo" className="hidden object-contain dark:block" /> : null}
      </span>
      {name ? <span className="font-semibold text-[var(--sidebar-fg)]">{name}</span> : null}
    </Link>
  );
}
