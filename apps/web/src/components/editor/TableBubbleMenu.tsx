import type { Editor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"

function getActiveTableRect(editor: Editor): DOMRect | null {
  const { state, view } = editor
  const $from = state.selection.$from

  // Walk up the selection to find the table node & its DOM
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    if (node.type.name === "table") {
      const pos = $from.before(d) // start position of the table node
      const dom = view.nodeDOM(pos) as HTMLElement | null
      if (dom?.getBoundingClientRect) return dom.getBoundingClientRect()
      break
    }
  }
  // Fallback via DOM lookup
  const at = view.domAtPos(state.selection.from).node as Element
  const el = at?.nodeType === 1 ? (at as Element).closest("table") : null
  return el?.getBoundingClientRect() ?? null
}

export function TableBubbleMenu({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="table-bubble-menu"
      // still only show while inside a table
      shouldShow={({ editor }) => editor.isActive("table")}
      // anchor the popover to the WHOLE table, not the caret
      getReferencedVirtualElement={() => {
        const rect = editor ? getActiveTableRect(editor) : null
        return rect ? { getBoundingClientRect: () => rect } : null
      }}
      options={{
        // keep it pinned to the table and avoid scroll-container clipping
        strategy: "fixed",
        // choose where you want it: "bottom-start" or "top-start"
        placement: "bottom-start",
        offset: 6,
        // help it stay on-screen if there’s no room
        flip: { fallbackPlacements: ["top-start"] },
        // nudge horizontally/vertically to avoid viewport edges
        shift: { padding: 8, crossAxis: true },
        // clamp size so it never overflows on small screens
        size: {
          apply({ availableWidth, availableHeight, elements }) {
            const w = Math.max(0, availableWidth)
            const h = Math.max(0, availableHeight)
            Object.assign(elements.floating.style, {
              maxWidth: `${Math.min(w, 360)}px`,
              maxHeight: `${Math.min(h, 240)}px`,
              overflowY: "auto",
            })
          },
        },
      }}
    >
      <div className="table-menu flex flex-wrap items-center gap-1 rounded-md border bg-card p-1 shadow-md">
        <button
          className="rounded px-2 py-1 text-xs hover:bg-accent"
          aria-label="Add column left"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            // @ts-expect-error provided by TableKit
            editor.chain().focus().addColumnBefore().run()
          }
        >
          + Col L
        </button>
        <button
          className="rounded px-2 py-1 text-xs hover:bg-accent"
          aria-label="Add column right"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            // @ts-expect-error provided by TableKit
            editor.chain().focus().addColumnAfter().run()
          }
        >
          + Col R
        </button>
        <button
          className="rounded px-2 py-1 text-xs hover:bg-accent"
          aria-label="Delete column"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            // @ts-expect-error provided by TableKit
            editor.chain().focus().deleteColumn().run()
          }
        >
          Del Col
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Rows */}
        <button
          className="rounded px-2 py-1 text-xs hover:bg-accent"
          aria-label="Add row above"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            // @ts-expect-error provided by TableKit
            editor.chain().focus().addRowBefore().run()
          }
        >
          + Row ↑
        </button>
        <button
          className="rounded px-2 py-1 text-xs hover:bg-accent"
          aria-label="Add row below"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            // @ts-expect-error provided by TableKit
            editor.chain().focus().addRowAfter().run()
          }
        >
          + Row ↓
        </button>
        <button
          className="rounded px-2 py-1 text-xs hover:bg-accent"
          aria-label="Delete row"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            // @ts-expect-error provided by TableKit
            editor.chain().focus().deleteRow().run()
          }
        >
          Del Row
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Delete table */}
        <button
          className="rounded px-2 py-1 text-xs hover:bg-accent text-destructive"
          aria-label="Delete table"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            // @ts-expect-error provided by TableKit
            editor.chain().focus().deleteTable().run()
          }
        >
          Delete Table
        </button>
      </div>
    </BubbleMenu>
  )
}
