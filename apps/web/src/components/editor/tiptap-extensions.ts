import StarterKit from "@tiptap/starter-kit"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import { type Extensions } from "@tiptap/react"
import { type Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

export function createTiptapExtensions(
  doc: Y.Doc,
  provider: { awareness: Awareness }
): Extensions {
  return [
    StarterKit.configure(),
    Collaboration.configure({ document: doc }),
    CollaborationCaret.configure({
      provider,
      user: {
        name: `Cat ${Math.floor(Math.random() * 100)}`,
        color:
          "#" +
          Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, "0"),
      },
    }),
  ]
}
