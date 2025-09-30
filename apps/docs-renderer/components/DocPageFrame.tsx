import type { ReactNode } from 'react';

export default function DocPageFrame({
  children,
  tocSlot,
}: {
  children: ReactNode;
  tocSlot?: ReactNode;
}) {
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

      <div className="dfy-page">
        <div className="dfy-article-wrap">
          {/* Mobile top bar (sticky): hamburger trigger */}
          <div className="dfy-mobile-topbar" aria-label="Breadcrumb and menu">
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
          </div>

          {children}
        </div>

        {tocSlot}
      </div>
    </>
  );
}
