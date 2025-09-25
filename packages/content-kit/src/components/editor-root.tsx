'use client';

import { Provider } from 'jotai';
import type { FC, ReactNode } from 'react';
import { useRef } from 'react';
import * as tunnelRat from 'tunnel-rat';
import { contentKitStore } from '../utils/store.js';
import { EditorCommandTunnelContext } from './command/editor-command.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tunnel = (tunnelRat as any).default ?? tunnelRat;

export const EditorRoot: FC<{ children: ReactNode }> = ({ children }) => {
  const tunnelInstance = useRef(tunnel()).current;
  return (
    <Provider store={contentKitStore}>
      <EditorCommandTunnelContext.Provider value={tunnelInstance}>
        {children}
      </EditorCommandTunnelContext.Provider>
    </Provider>
  );
};
