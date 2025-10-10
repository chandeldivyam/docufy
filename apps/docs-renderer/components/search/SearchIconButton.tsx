'use client';

export default function SearchIconButton() {
  const open = () => {
    const isMac = navigator.platform.includes('Mac');
    const e = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: !isMac,
      metaKey: isMac,
    });
    window.dispatchEvent(e);
  };
  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)]"
      aria-label="Open search"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 21l-4.3-4.3m2.3-5.7a8 8 0 11-16 0 8 8 0 0116 0z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
