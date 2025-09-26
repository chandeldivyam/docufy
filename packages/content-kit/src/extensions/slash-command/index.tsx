import { Extension } from '@tiptap/core';
import type { Editor, Range } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import type { RefObject, ReactNode } from 'react';
import tippy, { type GetReferenceClientRect, type Instance, type Props } from 'tippy.js';
import { EditorCommandOut } from '../../components/command/editor-command.js';

const Slash = Extension.create({
  name: 'slash-command',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          props.command?.({ editor, range });
        },
      } as SuggestionOptions,
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

const renderItems = (elementRef?: RefObject<Element> | null) => {
  let component: ReactRenderer | null = null;
  let popup: Instance<Props>[] | null = null;

  return {
    onStart: (props: { editor: Editor; clientRect: DOMRect; query: string; range: Range }) => {
      component = new ReactRenderer(EditorCommandOut, {
        props,
        editor: props.editor,
      });

      const { selection } = props.editor.state;
      const parentNode = selection.$from.node(selection.$from.depth);
      const blockType = parentNode.type.name;
      if (blockType === 'codeBlock') return false;

      // @ts-expect-error because of typeerror with tunnel
      popup = tippy('body', {
        getReferenceClientRect: props.clientRect,
        appendTo: () => (elementRef ? elementRef.current : document.body),
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      });
    },

    onUpdate: (props: {
      editor: Editor;
      clientRect: GetReferenceClientRect;
      query: string;
      range: Range;
    }) => {
      component?.updateProps(props);
      popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect });
    },

    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (props.event.key === 'Escape') {
        popup?.[0]?.hide();
        return true;
      }
      // @ts-expect-error because of typeerror with tunnel
      return component?.ref?.onKeyDown?.(props);
    },

    onExit: () => {
      popup?.[0]?.destroy();
      component?.destroy();
    },
  };
};

export interface SuggestionItem {
  title: string;
  description: string;
  icon?: ReactNode;
  searchTerms?: string[];
  command?: (props: { editor: Editor; range: Range }) => void;
}

export const createSuggestionItems = (items: SuggestionItem[]) => items;

export const handleCommandNavigation = (event: KeyboardEvent) => {
  if (['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) {
    const el = document.querySelector('#slash-command');
    if (el) return true; // tell TipTap we handled it; EditorCommandOut will forward
  }
  return false;
};

export { Slash as Command, renderItems };
