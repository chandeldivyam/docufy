import { useEffect, useMemo, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import * as Y from "yjs"
import { ElectricYjsProvider } from "@/lib/y-electric/provider"
import { createTiptapExtensions } from "./tiptap-extensions"

const yDocs = new Map<string, Y.Doc>()
const providers = new Map<string, ElectricYjsProvider>()

export function CollaborativeEditor({ documentId }: { documentId: string }) {
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting")

  const { ydoc, provider } = useMemo(() => {
    let ydoc = yDocs.get(documentId)
    if (!ydoc) {
      ydoc = new Y.Doc()
      yDocs.set(documentId, ydoc)
    }

    let provider = providers.get(documentId)
    if (!provider) {
      provider = new ElectricYjsProvider(ydoc, documentId)
      providers.set(documentId, provider)
    }

    return { ydoc, provider }
  }, [documentId])

  const editor = useEditor(
    {
      extensions: createTiptapExtensions(ydoc, provider),
      editorProps: {
        attributes: {
          class: "prose dark:prose-invert focus:outline-none max-w-full",
        },
      },
    },
    // Any of these will work; documentId is simplest and stable.
    [documentId]
  )

  useEffect(() => {
    const statusHandler = ({ status }: { status: string }) =>
      setStatus(status as "connecting" | "connected" | "disconnected")
    provider.on("status", statusHandler)
    return () => {
      provider.off("status", statusHandler)
    }
  }, [provider])

  useEffect(() => {
    setStatus("connecting")
  }, [documentId])

  return (
    <div className="relative h-full">
      <div className="absolute top-2 right-2 text-xs text-muted-foreground capitalize">
        {status}
      </div>
      <EditorContent key={documentId} editor={editor} className="p-6 h-full" />
    </div>
  )
}
