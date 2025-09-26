import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import { type Extensions } from "@tiptap/react"
import { type Awareness } from "y-protocols/awareness"
import * as Y from "yjs"
import { getExtensions } from "@docufy/content-kit/preset"
import { uploadImageToBlob } from "@/lib/blob-uploader"
import "@docufy/content-kit/styles.css"
import { slashCommand } from "./slash-command" // <-- add

export function createTiptapExtensions(
  doc: Y.Doc,
  provider: { awareness: Awareness },
  user: { name: string; email?: string; color: string },
  ctx?: { orgSlug?: string; documentId?: string }
): Extensions {
  return [
    ...getExtensions("editor", {
      dropcursor: { color: "#DBEAFE", width: 4 },
      editable: true,
      upload: {
        uploader: uploadImageToBlob,
        context: { orgSlug: ctx?.orgSlug, documentId: ctx?.documentId },
      },
      extra: [slashCommand],
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
