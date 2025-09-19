import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import { type Extensions } from "@tiptap/react"
import { type Awareness } from "y-protocols/awareness"
import * as Y from "yjs"
import { getExtensions } from "@docufy/content-kit/preset"
import "@docufy/content-kit/styles.css"

export function createTiptapExtensions(
  doc: Y.Doc,
  provider: { awareness: Awareness },
  user: { name: string; email?: string; color: string }
): Extensions {
  return [
    ...getExtensions("editor", {
      dropcursor: { color: "#DBEAFE", width: 4 },
      editable: true,
      extra: [],
    }),
    Collaboration.configure({ document: doc }),
    CollaborationCaret.configure({
      provider,
      user: {
        name: user.name,
        color: user.color,
      },
    }),
  ]
}
