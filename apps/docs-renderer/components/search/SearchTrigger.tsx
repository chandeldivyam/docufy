'use client';

import { useEffect, useState } from 'react';

export default function SearchTrigger() {
  const [hotkey, setHotkey] = useState<'⌘K' | 'CtrlK'>('CtrlK');
  useEffect(() => {
    setHotkey(navigator.platform.includes('Mac') ? '⌘K' : 'CtrlK');
  }, []);
  // This emits a click on the overlay by simulating the keyboard shortcut;
  // the overlay is mounted globally and listens for the same keys.
  const open = () => {
    const e = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: !navigator.platform.includes('Mac'),
      metaKey: navigator.platform.includes('Mac'),
    });
    window.dispatchEvent(e);
  };
  return (
    <button type="button" onClick={open} className="dfy-search-trigger" aria-label="Open search">
      <span className="dfy-search-trigger-placeholder">Search docs…</span>
      <kbd className="dfy-search-trigger-kbd">{hotkey}</kbd>
    </button>
  );
}
