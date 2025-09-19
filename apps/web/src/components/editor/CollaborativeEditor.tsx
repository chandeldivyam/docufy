import { useEffect, useMemo, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import * as Y from "yjs"
import { ElectricYjsProvider } from "@/lib/y-electric/provider"
import { createTiptapExtensions } from "./tiptap-extensions"
import { usePresenceUser } from "@/lib/use-presence-user"

const yDocs = new Map<string, Y.Doc>()
const providers = new Map<string, ElectricYjsProvider>()

export function CollaborativeEditor({
  documentId,
  orgSlug,
}: {
  documentId: string
  orgSlug?: string
}) {
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting")

  const presence = usePresenceUser(orgSlug)

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
      extensions: createTiptapExtensions(
        ydoc,
        provider,
        {
          name: presence.name,
          email: presence.email ?? undefined,
          color: presence.color,
        },
        { orgSlug, documentId }
      ),
      editorProps: {
        attributes: {
          class:
            "tiptap prose dark:prose-invert focus:outline-none max-w-full h-full",
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

  // Keep the local awareness "user" in sync with profile changes (name/email/image/color)
  useEffect(() => {
    provider.awareness.setLocalState({
      ...(provider.awareness.getLocalState() ?? {}),
      user: {
        id: presence.id,
        name: presence.name,
        email: presence.email ?? undefined,
        image: presence.image ?? undefined,
        color: presence.color,
      },
    })
  }, [
    provider,
    presence.id,
    presence.name,
    presence.email,
    presence.image,
    presence.color,
  ])

  return (
    <div className="relative h-full">
      <div className="absolute top-2 right-2 text-xs text-muted-foreground capitalize">
        {status}
      </div>
      <EditorContent key={documentId} editor={editor} className="p-6 h-full" />
    </div>
  )
}
