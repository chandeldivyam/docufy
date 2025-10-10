import type { ReactNode } from 'react';
import SearchIconButton from '@/components/search/SearchIconButton';
import Logo from '@/components/Logo';
import { getPointer } from '@/lib/pointer';
import { fetchManifestV3 } from '@/lib/fetchers';

export default async function DocPageFrame({
  children,
  tocSlot,
  showMobileTopbar = true,
}: {
  children: ReactNode;
  tocSlot?: ReactNode;
  showMobileTopbar?: boolean;
}) {
  const manifest = showMobileTopbar
    ? await (async () => {
        const ptr = await getPointer();
        return fetchManifestV3(ptr.manifestUrl);
      })()
    : null;

  return (
    <>
      {/* Mobile-only nav toggle + backdrop. Shared between doc + API pages. */}
      <input
        id="dfy-mobile-nav-toggle"
        type="checkbox"
        className="dfy-mobile-nav-toggle"
        aria-hidden="true"
      />
      <label htmlFor="dfy-mobile-nav-toggle" className="dfy-sidebar-backdrop" aria-hidden="true" />

      <div className="dfy-article-wrap">
        {showMobileTopbar ? (
          <div className="dfy-mobile-topbar" aria-label="Navigation">
            <label
              htmlFor="dfy-mobile-nav-toggle"
              className="dfy-hamburger"
              aria-label="Open navigation"
              role="button"
              tabIndex={0}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 6h18M3 12h18M3 18h18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </label>
            {manifest ? <Logo manifest={manifest} /> : null}
            <SearchIconButton />
          </div>
        ) : null}

        {children}
      </div>

      {tocSlot}
    </>
  );
}
