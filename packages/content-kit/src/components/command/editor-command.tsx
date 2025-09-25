'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useEffect, forwardRef, createContext } from 'react';
import { Command } from 'cmdk';
import type { ComponentPropsWithoutRef, FC } from 'react';
import type { Range, Editor } from '@tiptap/core';
import { contentKitStore } from '../../utils/store.js';
import { queryAtom, rangeAtom, editorAtom } from '../../utils/atoms.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EditorCommandTunnelContext = createContext({} as any);

interface EditorCommandOutProps {
  readonly query: string;
  readonly range: Range;
  readonly editor: Editor;
}

/** Lives inside tippy popup; syncs query/range/editor into atoms and forwards nav keys to #slash-command */
export const EditorCommandOut: FC<EditorCommandOutProps> = ({ query, range, editor }) => {
  const setQuery = useSetAtom(queryAtom, { store: contentKitStore });
  const setRange = useSetAtom(rangeAtom, { store: contentKitStore });
  const setEditor = useSetAtom(editorAtom, { store: contentKitStore });

  useEffect(() => setQuery(query), [query, setQuery]);
  useEffect(() => setRange(range), [range, setRange]);
  useEffect(() => setEditor(editor), [editor, setEditor]);

  useEffect(() => {
    const navigationKeys = ['ArrowUp', 'ArrowDown', 'Enter'];
    const onKeyDown = (e: KeyboardEvent) => {
      if (navigationKeys.includes(e.key)) {
        e.preventDefault();
        const commandRef = document.querySelector('#slash-command');
        if (commandRef) {
          commandRef.dispatchEvent(
            new KeyboardEvent('keydown', { key: e.key, cancelable: true, bubbles: true }),
          );
        }
        return false;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // tunnel Out point rendered by the Suggestion renderer
  return (
    <EditorCommandTunnelContext.Consumer>
      {(tunnelInstance) => <tunnelInstance.Out />}
    </EditorCommandTunnelContext.Consumer>
  );
};

export const EditorCommand = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof Command>>(
  ({ children, className, ...rest }, ref) => {
    const [query, setQuery] = useAtom(queryAtom, { store: contentKitStore });

    return (
      <EditorCommandTunnelContext.Consumer>
        {(tunnelInstance) => (
          <tunnelInstance.In>
            <Command
              ref={ref}
              onKeyDown={(e) => e.stopPropagation()}
              id="slash-command"
              className={className}
              {...rest}
            >
              {/* Hidden input so CMDK can manage active item by keystrokes */}
              <Command.Input value={query} onValueChange={setQuery} style={{ display: 'none' }} />
              {children}
            </Command>
          </tunnelInstance.In>
        )}
      </EditorCommandTunnelContext.Consumer>
    );
  },
);
EditorCommand.displayName = 'EditorCommand';
export const EditorCommandList = Command.List;
