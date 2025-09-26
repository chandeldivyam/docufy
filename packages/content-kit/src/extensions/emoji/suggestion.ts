import { computePosition, type VirtualElement, offset, flip, shift, size } from '@floating-ui/dom';
import { ReactRenderer } from '@tiptap/react';
import { PluginKey, type EditorState } from '@tiptap/pm/state';
import type { Editor, Range } from '@tiptap/core';
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
  SuggestionOptions,
} from '@tiptap/suggestion';
import type { EmojiItem } from '@tiptap/extension-emoji';
import { EmojiList, type EmojiListRef } from './emoji-list.js';

const suggestion: Partial<SuggestionOptions<EmojiItem, { name: string }>> = {
  char: ':',
  // Give this suggestion its own key so it doesn't clash with others
  pluginKey: new PluginKey('emoji-suggestion'),
  // Let ":" work after any character (not only after a space)
  allowedPrefixes: null,
  // Do not allow spaces inside the query
  allowSpaces: false,
  // Only activate once the user typed at least one letter after ":"
  allow: ({ state, range }: { state: EditorState; range: Range }) => {
    const query = state.doc.textBetween(range.from, range.to);
    return query.length > 1;
  },

  items: ({ editor, query }: { editor: Editor; query: string }) => {
    const q = (query ?? '').toLowerCase().trim();
    if (!q) return [];

    // Pull the list from Emoji storage - cast to satisfy TS
    const list: EmojiItem[] = (editor.storage.emoji?.emojis ?? []) as EmojiItem[];

    const scored: EmojiItem[] = list
      .map((e: EmojiItem) => {
        const shorts = (e.shortcodes ?? []).map((s) => s.toLowerCase());
        const tags = (e.tags ?? []).map((t) => t.toLowerCase());
        const sStarts = shorts.some((s) => s.startsWith(q));
        const sIncl = !sStarts && shorts.some((s) => s.includes(q));
        const tStarts = tags.some((t) => t.startsWith(q));
        const tIncl = !tStarts && tags.some((t) => t.includes(q));
        let score = 0;
        if (sStarts) score += 3;
        if (sIncl) score += 2;
        if (tStarts) score += 1;
        if (tIncl) score += 0.5;
        return { e, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((x) => x.e);

    return scored;
  },

  render: () => {
    let component: ReactRenderer<
      EmojiListRef,
      SuggestionProps<EmojiItem, { name: string }>
    > | null = null;

    function repositionComponent(clientRect: DOMRect | null) {
      if (!component || !component.element) return;

      const virtualEl: VirtualElement = {
        getBoundingClientRect() {
          return clientRect ?? new DOMRect(0, 0, 0, 0);
        },
      };

      computePosition(virtualEl, component.element as HTMLElement, {
        placement: 'bottom-start',
        strategy: 'fixed', // appended to <body>, avoid clipping by scroll containers
        middleware: [
          offset(6),
          flip({ fallbackPlacements: ['top-start'] }),
          shift({ padding: 8, crossAxis: true }),
          size({
            apply({ availableHeight, elements }) {
              const h = Math.max(0, availableHeight);
              Object.assign(elements.floating.style, {
                maxHeight: `${h}px`,
                overflowY: 'auto',
              });
            },
          }),
        ],
      }).then((pos) => {
        const el = component!.element as HTMLElement;
        Object.assign(el.style, {
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          position: 'fixed',
        });
        // optional: toggle a class for styling based on final placement
        // el.dataset.placement = pos.placement; // e.g. 'top-start' or 'bottom-start'
      });
    }

    return {
      onStart: (props: SuggestionProps<EmojiItem, { name: string }>) => {
        component = new ReactRenderer<EmojiListRef, SuggestionProps<EmojiItem, { name: string }>>(
          EmojiList,
          {
            props,
            editor: props.editor,
          },
        );

        document.body.appendChild(component.element);
        repositionComponent(props.clientRect ? props.clientRect() : null);
      },

      onUpdate(props: SuggestionProps<EmojiItem, { name: string }>) {
        component?.updateProps(props);
        repositionComponent(props.clientRect ? props.clientRect() : null);
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (!component) return false;

        if (props.event.key === 'Escape') {
          if (document.body.contains(component.element)) {
            document.body.removeChild(component.element);
          }
          component.destroy();
          component = null;
          return true;
        }

        if (props.event.key === 'Tab') {
          // Will call enterHandler in the list
          component.ref?.onKeyDown?.(props);
          return true;
        }

        return component.ref?.onKeyDown(props) ?? false;
      },

      onExit() {
        if (component) {
          if (document.body.contains(component.element)) {
            document.body.removeChild(component.element);
          }
          component.destroy();
          component = null;
        }
      },
    };
  },
};

export default suggestion;
