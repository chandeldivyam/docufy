import { useEffect, useMemo } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import * as Y from "yjs"
import { ElectricYjsProvider } from "@/lib/y-electric/provider"
import { createTiptapExtensions } from "./tiptap-extensions"
import { usePresenceUser } from "@/lib/use-presence-user"
import { ImageResizer } from "./ImageResizer"
import {
  EditorRoot,
  EditorCommand,
  EditorCommandList,
  EditorCommandItem,
  EditorCommandEmpty,
  handleCommandNavigation,
} from "@docufy/content-kit"
import { suggestionItems } from "./slash-command"
import { TableBubbleMenu } from "./TableBubbleMenu"

const yDocs = new Map<string, Y.Doc>()
const providers = new Map<string, ElectricYjsProvider>()

export function CollaborativeEditor({
  documentId,
  orgSlug,
}: {
  documentId: string
  orgSlug?: string
}) {
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
      shouldRerenderOnTransaction: true,
      editorProps: {
        attributes: {
          class:
            "tiptap prose dark:prose-invert focus:outline-none max-w-full h-full",
        },
        handleDOMEvents: {
          keydown: (_view, event) => {
            const isMod = event.metaKey || event.ctrlKey
            if (
              isMod &&
              event.key.toLowerCase() === "k" &&
              !event.isComposing
            ) {
              event.preventDefault()
              event.stopPropagation()
              window.dispatchEvent(new Event("docufy:toggle-cmdk"))
              return true // tell ProseMirror we handled it
            }
            return handleCommandNavigation(event)
          },
        },
      },
    },
    // Any of these will work; documentId is simplest and stable.
    [documentId]
  )

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
    <EditorRoot>
      <div className="relative h-full">
        {editor ? <TableBubbleMenu editor={editor} /> : null}
        <EditorContent
          key={documentId}
          editor={editor}
          className="h-full p-4 sm:p-6"
          autoFocus
        />
        <ImageResizer editor={editor} />

        {/* Slash Command palette (styled similar to Novel’s) */}
        <EditorCommand className="z-50 h-auto max-h-80 overflow-y-auto rounded-md border bg-card px-1 py-2 shadow-md">
          <EditorCommandEmpty className="px-2 text-muted-foreground">
            No results
          </EditorCommandEmpty>
          <EditorCommandList>
            {suggestionItems.map((item) => (
              <EditorCommandItem
                key={item.title}
                value={item.title}
                onCommand={(val) => item.command?.(val)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent aria-selected:bg-accent"
              >
                {item.icon ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-background">
                    {item.icon}
                  </div>
                ) : null}
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </EditorCommandItem>
            ))}
          </EditorCommandList>
        </EditorCommand>
      </div>
    </EditorRoot>
  )
}
