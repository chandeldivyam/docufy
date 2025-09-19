import * as Y from "yjs"
import { Awareness } from "y-protocols/awareness"
import {
  ShapeStream,
  isChangeMessage,
  isControlMessage,
} from "@electric-sql/client"
import * as awarenessProtocol from "y-protocols/awareness"
import { ObservableV2 } from "lib0/observable"
import { IndexeddbPersistence } from "y-indexeddb"

type UpdateMessage = { update: Uint8Array }
type ProviderEvents = {
  status: (status: {
    status: "connecting" | "connected" | "disconnected"
  }) => void
  synced: (state: boolean) => void
}

const parseToUint8Array = {
  bytea: (hexString: string) => {
    const cleanHexString = hexString.startsWith(`\\x`)
      ? hexString.slice(2)
      : hexString
    return new Uint8Array(
      cleanHexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    )
  },
}

type AwarenessChange = {
  added: number[]
  updated: number[]
  removed: number[]
}

export class ElectricYjsProvider extends ObservableV2<ProviderEvents> {
  public doc: Y.Doc
  public awareness: Awareness
  private documentId: string
  private persistence?: IndexeddbPersistence
  private docStream?: ShapeStream<UpdateMessage>
  private awarenessStream?: ShapeStream<UpdateMessage>
  private connected = false
  private docUnsubscribe?: () => void
  private awarenessUnsubscribe?: () => void

  private updateHandler: (update: Uint8Array, origin: unknown) => void
  private awarenessUpdateHandler: (
    changed: AwarenessChange,
    origin: unknown
  ) => void
  private unloadHandler: () => void

  constructor(doc: Y.Doc, documentId: string) {
    super()
    this.doc = doc
    this.awareness = new Awareness(doc)
    this.documentId = documentId
    this.persistence = new IndexeddbPersistence(`doc-${documentId}`, doc)

    this.updateHandler = (update, origin) => {
      if (origin !== this) {
        // Send the raw Yjs update bytes to the server
        this.sendDocumentUpdate(update)
      }
    }

    this.awarenessUpdateHandler = (
      { added, updated, removed }: AwarenessChange,
      origin
    ) => {
      if (origin === "local") {
        const changed = added.concat(updated).concat(removed)
        const update = awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          changed
        )
        this.sendAwarenessUpdate(update)
      }
    }

    this.unloadHandler = () => {
      // Mark self offline – provider’s 'update' handler will send it
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        [this.doc.clientID],
        "local"
      )
      // or: this.awareness.setLocalState(null)
    }

    this.doc.on("update", this.updateHandler)
    this.awareness.on("update", this.awarenessUpdateHandler)
    window.addEventListener("beforeunload", this.unloadHandler)

    this.connect()
  }

  override destroy() {
    this.doc.off("update", this.updateHandler)
    this.awareness.off("update", this.awarenessUpdateHandler)
    window.removeEventListener("beforeunload", this.unloadHandler)
    this.docUnsubscribe?.()
    this.awarenessUnsubscribe?.()
    this.persistence?.destroy()
    this.docStream = undefined
    this.awarenessStream = undefined
    super.destroy()
  }

  private connect() {
    if (this.connected) return
    this.emit("status", [{ status: "connecting" }])

    const createShape = (table: string) => {
      const url = new URL(
        `/api/shape/${table}?documentId=${this.documentId}`,
        window.location.origin
      )
      return new ShapeStream<UpdateMessage>({
        url: url.toString(),
        parser: { bytea: parseToUint8Array.bytea },
      })
    }

    this.docStream = createShape("document_updates")
    this.awarenessStream = createShape("document_awareness")

    this.docUnsubscribe = this.docStream.subscribe((messages) => {
      try {
        for (const m of messages) {
          if (isChangeMessage(m)) {
            Y.applyUpdate(this.doc, m.value.update, this)
          }
          if (isControlMessage(m) && m.headers.control === "up-to-date") {
            this.emit("status", [{ status: "connected" }])
            this.emit("synced", [true])
          }
        }
      } catch (err) {
        console.error("Yjs apply failed:", err)
      }
    })

    this.awarenessUnsubscribe = this.awarenessStream.subscribe((messages) => {
      for (const m of messages) {
        if (!isChangeMessage(m)) continue
        // Define proper type for headers
        const headers = m.headers as { operation?: string }
        if (headers.operation === "delete") {
          // Define proper type for value
          const value = m.value as { client_id?: string }
          const clientId = Number(value.client_id)
          if (!Number.isNaN(clientId)) {
            awarenessProtocol.removeAwarenessStates(
              this.awareness,
              [clientId],
              "remote"
            )
          }
          continue
        }
        // Normal awareness update - define proper type
        const value = m.value as { update?: Uint8Array }
        const update = value.update
        if (update && update.length > 0) {
          try {
            awarenessProtocol.applyAwarenessUpdate(this.awareness, update, this)
          } catch (err) {
            console.error("Awareness apply failed:", err)
          }
        }
      }
    })

    this.connected = true
  }

  // This function now expects a fully-formed sync protocol message
  private sendDocumentUpdate(update: Uint8Array) {
    fetch(`/api/document-updates?documentId=${this.documentId}`, {
      method: "PUT",
      body: update as BodyInit,
      keepalive: true,
      headers: { "content-type": "application/octet-stream" },
    })
  }

  private sendAwarenessUpdate(update: Uint8Array) {
    fetch(
      `/api/awareness-updates?documentId=${this.documentId}&clientId=${this.doc.clientID}`,
      { method: "PUT", body: update as BodyInit }
    )
  }
}
