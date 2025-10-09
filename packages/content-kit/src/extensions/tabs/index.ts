import { Node, mergeAttributes, findChildren, findParentNode, isActive } from '@tiptap/core';
import { Plugin, PluginKey, Transaction, EditorState } from '@tiptap/pm/state';
import { TextSelection } from 'prosemirror-state';
import type { JSONContent } from '@tiptap/core';
import type { NodeViewRendererProps } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';

/** Options for the Tabs root node */
export interface TabsOptions {
  /** Persist the selected tab index to the document (data-active-index). */
  persistActive: boolean;
  /** Custom HTML attributes for the root. */
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tabs: {
      /** Wrap the current selection in a `tabs` with one `tab` (title auto). */
      setTabs: () => ReturnType;
      /** Unwrap the `tabs` node; by default keep the *active* tab content. */
      unsetTabs: (keep?: 'active' | 'all') => ReturnType;
      /** Add a new tab after the active index (or at end). */
      addTab: (title?: string, index?: number) => ReturnType;
      /** Remove a tab (default: active). */
      removeTab: (index?: number) => ReturnType;
      /** Rename a tab by index (default: active). */
      renameTab: (title: string, index?: number) => ReturnType;
      /** Move a tab from `from` to `to`. */
      moveTab: (from: number, to: number) => ReturnType;
      /** Select a tab by index. */
      setActiveTab: (index: number) => ReturnType;
      /** Cycle selection. */
      nextTab: () => ReturnType;
      prevTab: () => ReturnType;
    };
  }
}

/** Child panel node: carries the title attribute and holds `block+` */
export const Tab = Node.create({
  name: 'tab',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      title: {
        default: 'Tab',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-title') || 'Tab',
        renderHTML: (attrs: { title?: string }) =>
          attrs.title ? { 'data-title': attrs.title } : {},
      },
      // internal use: id to generate aria-controls/labelledby pairs (stable-ish)
      tid: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-tid'),
        renderHTML: (attrs: { tid?: string | null }) =>
          attrs.tid ? { 'data-tid': String(attrs.tid) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tab"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'tab',
        role: 'tabpanel',
        tabindex: '0', // focusable panel when needed
      }),
      0,
    ];
  },
});

export const Tabs = Node.create<TabsOptions>({
  name: 'tabs',
  group: 'block',
  content: 'tab+',
  isolating: true,
  defining: true,

  addOptions() {
    return {
      persistActive: true,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    if (!this.options.persistActive) return {};
    return {
      active: {
        default: 0,
        parseHTML: (el: HTMLElement) =>
          Number.parseInt(el.getAttribute('data-active-index') || '0', 10) || 0,
        renderHTML: (attrs: { active?: number }) =>
          typeof attrs.active === 'number'
            ? { 'data-active-index': String(Math.max(0, attrs.active)) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tabs"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': this.name }),
      0,
    ];
  },

  /**
   * A plain NodeView (no React) that:
   *  - renders a <div role="tablist"> header
   *  - exposes a contentDOM to hold the <div data-type="tab" role="tabpanel"> children
   *  - builds/updates buttons from child `tab` titles
   *  - toggles hidden attribute on panels based on active index
   */
  addNodeView() {
    return ({ editor, node, getPos, HTMLAttributes }: NodeViewRendererProps) => {
      let current: PMNode = node as PMNode;
      const dom = document.createElement('div');
      Object.entries(
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          'data-type': this.name,
        }),
      ).forEach(([k, v]) => dom.setAttribute(k, String(v)));

      const tablist = document.createElement('div');
      tablist.setAttribute('role', 'tablist');
      tablist.className = 'dfy-tabs-header';
      dom.append(tablist);

      const content = document.createElement('div');
      content.className = 'dfy-tabs-content';
      dom.append(content);

      // Helpers using arrow functions, so `this` is lexical
      const readActive = (): number => {
        const persisted = (current.attrs as { active?: number }).active ?? 0;
        const max = Math.max(0, current.childCount - 1);
        return Math.min(persisted, max);
      };

      const setActive = (index: number) => {
        const max = Math.max(0, current.childCount - 1);
        const next = Math.min(Math.max(0, index), max);

        if (this.options.persistActive && typeof getPos === 'function') {
          editor
            .chain()
            .command(({ tr }) => {
              const pos = getPos();
              const n = tr.doc.nodeAt(pos);
              if (!n || n.type !== this.type) return false;
              tr.setNodeMarkup(pos, undefined, { ...(n.attrs || {}), active: next });
              return true;
            })
            .focus(undefined, { scrollIntoView: false })
            .run();
        } else {
          applyActive(next);
        }
      };

      const renameByIndex = (index: number, value: string) => {
        if (typeof getPos !== 'function') return;
        editor
          .chain()
          .command(({ tr }) => {
            const pos = getPos();
            const n = tr.doc.nodeAt(pos);
            if (!n || n.type !== this.type) return false;
            if (index < 0 || index >= n.childCount) return false;
            const childPos = tr.doc
              .resolve(pos + 1)
              .posAtIndex(index, tr.doc.resolve(pos + 1).depth);
            const tabNode = n.child(index);
            tr.setNodeMarkup(childPos, undefined, {
              ...(tabNode.attrs || {}),
              title: value,
            });
            return true;
          })
          .focus(undefined, { scrollIntoView: false })
          .run();
      };

      const ensureIds = () => {
        if (typeof getPos !== 'function') return;
        editor.commands.command(({ tr }) => {
          const pos = getPos();
          const parent = tr.doc.nodeAt(pos);
          if (!parent || parent.type !== this.type) return false;
          let changed = false;
          for (let i = 0; i < parent.childCount; i++) {
            const child = parent.child(i);
            if (!child.attrs?.tid) {
              const tid = `tt-tab-${pos}-${i}`;
              const childPos = tr.doc.resolve(pos + 1).posAtIndex(i, tr.doc.resolve(pos + 1).depth);
              tr.setNodeMarkup(childPos, undefined, {
                ...child.attrs,
                tid,
              });
              changed = true;
            }
          }
          return changed;
        });
      };

      const rebuildHeader = () => {
        tablist.replaceChildren();
        const active = readActive();

        for (let i = 0; i < current.childCount; i++) {
          const child = current.child(i);
          const label = (child.attrs?.title as string) || `Tab ${i + 1}`;
          const tid =
            child.attrs?.tid || `tt-tab-${typeof getPos === 'function' ? getPos() : 0}-${i}`;

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'dfy-tab';
          btn.setAttribute('role', 'tab');
          btn.id = `tab-${tid}`;
          btn.setAttribute('aria-controls', `panel-${tid}`);
          btn.setAttribute('aria-selected', String(i === active));
          btn.tabIndex = i === active ? 0 : -1;
          btn.textContent = label;

          btn.addEventListener('click', () => setActive(i));
          btn.addEventListener('keydown', (e) => {
            const count = current.childCount;
            const go = (idx: number) => {
              const next = (idx + count) % count;
              setActive(next);
              const nextBtn = tablist.querySelectorAll<HTMLElement>('[role="tab"]')[next];
              nextBtn?.focus();
              e.preventDefault();
            };
            switch (e.key) {
              case 'ArrowLeft':
              case 'ArrowUp':
                go(i - 1);
                break;
              case 'ArrowRight':
              case 'ArrowDown':
                go(i + 1);
                break;
              case 'Home':
                go(0);
                break;
              case 'End':
                go(current.childCount - 1);
                break;
              case 'Enter':
              case ' ':
                setActive(i);
                break;
              case 'F2': {
                const nv = prompt('Rename tab', label);
                if (nv && nv !== label) renameByIndex(i, nv);
                break;
              }
              default:
                break;
            }
          });

          tablist.appendChild(btn);
        }
        applyActive(active);
      };

      const applyActive = (activeIndex: number) => {
        const buttons = Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        buttons.forEach((b, idx) => {
          b.setAttribute('aria-selected', String(idx === activeIndex));
          b.tabIndex = idx === activeIndex ? 0 : -1;
        });

        const panels = Array.from(
          content.querySelectorAll<HTMLElement>(':scope > div[data-type="tab"]'),
        );
        panels.forEach((p, idx) => {
          const tid =
            p.getAttribute('data-tid') ||
            `tt-tab-${typeof getPos === 'function' ? getPos() : 0}-${idx}`;
          p.id = `panel-${tid}`;
          p.setAttribute('aria-labelledby', `tab-${tid}`);
          if (idx === activeIndex) {
            p.removeAttribute('hidden');
          } else {
            p.setAttribute('hidden', 'hidden');
          }
        });
      };

      // initial build
      rebuildHeader();
      ensureIds();

      return {
        dom,
        contentDOM: content,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ignoreMutation: (m: any) => {
          if (m.type === 'selection') return false;
          return false;
        },
        update: (updatedNode: PMNode) => {
          if (updatedNode.type !== this.type) return false;
          current = updatedNode;
          rebuildHeader();
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      setTabs:
        () =>
        ({ state, chain }) => {
          const { selection, schema } = state;
          const { $from, $to } = selection;
          const range = $from.blockRange($to);
          if (!range) return false;

          const slice = state.doc.slice(range.start, range.end);
          // ensure the selected content can live inside a `tab`
          const match = schema.nodes.tab.contentMatch.matchFragment(slice.content);
          if (!match) return false;

          const content = slice.toJSON()?.content || [];
          return chain()
            .insertContentAt(
              { from: range.start, to: range.end },
              {
                type: this.name,
                attrs: this.options.persistActive ? { active: 0 } : {},
                content: [{ type: 'tab', attrs: { title: 'First tab' }, content }],
              },
            )
            .setTextSelection(range.start + 2) // into first panel
            .run();
        },

      unsetTabs:
        (keep: 'active' | 'all' = 'active') =>
        ({ state, chain }) => {
          const details = findParentNode((n) => n.type === this.type)(state.selection);
          if (!details) return false;
          const { node, pos } = details;

          let merged: JSONContent[] = [];
          if (keep === 'all') {
            for (let i = 0; i < node.childCount; i++) {
              const panel = node.child(i).content.toJSON() as JSONContent[];
              merged = merged.concat(panel);
            }
          } else {
            const active = (node.attrs?.active as number) ?? 0;
            const child = node.child(Math.min(Math.max(0, active), node.childCount - 1));
            merged = (child.content.toJSON() as JSONContent[]) || [];
          }

          return chain()
            .insertContentAt({ from: pos, to: pos + node.nodeSize }, merged)
            .setTextSelection(pos + 1)
            .run();
        },

      addTab:
        (title?: string, index?: number) =>
        ({ state, chain }) => {
          const parent = findParentNode((n) => n.type === this.type)(state.selection);
          if (!parent) return false;
          const { node, pos } = parent;
          const idx =
            typeof index === 'number'
              ? Math.min(Math.max(0, index), node.childCount)
              : node.childCount;
          const before = pos + 1;
          // compute insert position of `tab` at index
          let insertPos = before;
          const $start = state.doc.resolve(before);
          insertPos = $start.posAtIndex(idx, parent.depth);
          return chain()
            .insertContentAt(insertPos, {
              type: 'tab',
              attrs: { title: title || `Tab ${idx + 1}` },
              content: [{ type: 'paragraph' }],
            })
            .setTextSelection(insertPos + 2)
            .run();
        },

      removeTab:
        (index?: number) =>
        ({ state, chain }) => {
          const parent = findParentNode((n) => n.type === this.type)(state.selection);
          if (!parent) return false;
          const { node, pos } = parent;
          const active = (node.attrs?.active as number) ?? 0;
          const i = typeof index === 'number' ? index : active;
          if (i < 0 || i >= node.childCount) return false;

          const from = state.doc.resolve(pos + 1).posAtIndex(i, parent.depth);
          const to = from + node.child(i).nodeSize;
          const nextActive = Math.max(0, Math.min(node.childCount - 2, i));

          return chain()
            .deleteRange({ from, to })
            .command(({ tr }) => {
              if (this.options.persistActive) {
                const n = tr.doc.nodeAt(pos);
                if (n?.type === this.type) {
                  tr.setNodeMarkup(pos, undefined, { ...(n.attrs || {}), active: nextActive });
                }
              }
              return true;
            })
            .run();
        },

      renameTab:
        (title: string, index?: number) =>
        ({ state, chain }) => {
          const parent = findParentNode((n) => n.type === this.type)(state.selection);
          if (!parent) return false;
          const { node, pos } = parent;
          const active = (node.attrs?.active as number) ?? 0;
          const i = typeof index === 'number' ? index : active;
          if (i < 0 || i >= node.childCount) return false;

          const childPos = state.doc.resolve(pos + 1).posAtIndex(i, parent.depth);
          return chain()
            .command(({ tr }) => {
              const current = tr.doc.nodeAt(childPos);
              if (!current || current.type !== this.editor.schema.nodes.tab) return false;
              tr.setNodeMarkup(childPos, undefined, { ...(current.attrs || {}), title });
              return true;
            })
            .run();
        },

      moveTab:
        (from: number, to: number) =>
        ({ state, chain }) => {
          const parent = findParentNode((n) => n.type === this.type)(state.selection);
          if (!parent) return false;
          const { node, pos } = parent;
          if (from < 0 || from >= node.childCount) return false;
          const clampedTo = Math.min(Math.max(0, to), node.childCount - 1);
          if (from === clampedTo) return true;

          const start = state.doc.resolve(pos + 1).posAtIndex(from, parent.depth);
          const block = node.child(from);
          const end = start + block.nodeSize;

          return chain()
            .command(({ tr }) => {
              const slice = tr.doc.slice(start, end);
              tr.delete(start, end);
              const afterDeleteParent = tr.doc.nodeAt(pos)!;
              const destResolved = tr.doc.resolve(pos + 1).posAtIndex(clampedTo, parent.depth);
              tr.insert(destResolved, slice.content);
              // Fix active index persistently
              if (this.options.persistActive) {
                const prevActive = (afterDeleteParent.attrs?.active as number) ?? 0;
                let nextActive = prevActive;
                if (prevActive === from) nextActive = clampedTo;
                else if (from < prevActive && clampedTo >= prevActive) nextActive = prevActive - 1;
                else if (from > prevActive && clampedTo <= prevActive) nextActive = prevActive + 1;
                tr.setNodeMarkup(pos, undefined, {
                  ...(afterDeleteParent.attrs || {}),
                  active: nextActive,
                });
              }
              return true;
            })
            .run();
        },

      setActiveTab:
        (index: number) =>
        ({ state, chain }) => {
          const parent = findParentNode((n) => n.type === this.type)(state.selection);
          if (!parent) return false;
          const { node, pos } = parent;
          const max = node.childCount - 1;
          const clamped = Math.min(Math.max(0, index), max);
          if (!this.options.persistActive) return chain().focus().run();
          return chain()
            .command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, { ...(node.attrs || {}), active: clamped });
              return true;
            })
            .focus(undefined, { scrollIntoView: false })
            .run();
        },

      nextTab:
        () =>
        ({ state }) => {
          const parent = findParentNode((n) => n.type === this.type)(state.selection);
          if (!parent) return false;
          const { node } = parent;
          const active = (node.attrs?.active as number) ?? 0;
          return this.editor.commands.setActiveTab((active + 1) % node.childCount);
        },

      prevTab:
        () =>
        ({ state }) => {
          const parent = findParentNode((n) => n.type === this.type)(state.selection);
          if (!parent) return false;
          const { node } = parent;
          const active = (node.attrs?.active as number) ?? 0;
          return this.editor.commands.setActiveTab(
            (active - 1 + node.childCount) % node.childCount,
          );
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-]': () => this.editor.commands.nextTab(),
      'Mod-Alt-[': () => this.editor.commands.prevTab(),
    };
  },

  /**
   * Plugin: when the caret lands inside a hidden panel (e.g. due to DOM quirks or pasting),
   * move it to the next visible position (the active panel). Mirrors the Details extension idea.
   */
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tabsSelection'),
        appendTransaction: (
          transactions: readonly Transaction[],
          oldState: EditorState,
          newState: EditorState,
        ) => {
          const selectionSet = transactions.some((t) => t.selectionSet);
          if (!selectionSet || !oldState.selection.empty || !newState.selection.empty) return;

          const isInTabs = isActive(newState, this.name);
          if (!isInTabs) return;

          const { $from } = newState.selection;
          // Find nearest tabs parent
          const tabsParent = findParentNode((n) => n.type === this.type)(newState.selection);
          if (!tabsParent) return;

          // If inside a hidden panel, jump to the active one
          const activeIndex = (tabsParent.node.attrs?.active as number) ?? 0;
          const panels = findChildren(tabsParent.node, (n) => n.type === newState.schema.nodes.tab);
          if (!panels.length) return;

          // Check visibility via DOM
          const viewNode = this.editor.view.domAtPos($from.pos).node as HTMLElement;
          const panelEl = viewNode.closest?.('div[data-type="tab"]') as HTMLElement | null;
          if (panelEl && panelEl.hasAttribute('hidden')) {
            // move to active panel start
            const clamped = Math.min(Math.max(0, activeIndex), panels.length - 1);
            const base = tabsParent.pos + 1; // start of first child
            const $base = newState.doc.resolve(base);
            const startOfActive = $base.posAtIndex(clamped, tabsParent.depth);
            const sel = TextSelection.create(newState.doc, startOfActive + 1);
            const tr = newState.tr.setSelection(sel).scrollIntoView();
            return tr;
          }
        },
      }),
    ];
  },
});

export default Tabs;
