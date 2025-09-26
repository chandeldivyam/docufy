import { forwardRef } from 'react';
import { CommandEmpty, CommandItem } from 'cmdk';
import { useAtomValue } from 'jotai';
import type { ComponentPropsWithoutRef } from 'react';
import type { Range, Editor } from '@tiptap/core';
import { contentKitStore } from '../../utils/store.js';
import { rangeAtom, editorAtom } from '../../utils/atoms.js';

interface EditorCommandItemProps {
  readonly onCommand: (args: { editor: Editor; range: Range }) => void;
}

export const EditorCommandItem = forwardRef<
  HTMLDivElement,
  EditorCommandItemProps & ComponentPropsWithoutRef<typeof CommandItem>
>(({ children, onCommand, ...rest }, ref) => {
  const range = useAtomValue(rangeAtom, { store: contentKitStore });
  const editor = useAtomValue(editorAtom, { store: contentKitStore });

  if (!editor || !range) return null;

  return (
    <CommandItem ref={ref} {...rest} onSelect={() => onCommand({ editor, range })}>
      {children}
    </CommandItem>
  );
});

EditorCommandItem.displayName = 'EditorCommandItem';
export const EditorCommandEmpty = CommandEmpty;
export default EditorCommandItem;
