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

// NEW: tune these to taste
const UPDATE_FLUSH_MS = 50 // how often to send document updates
const UPDATE_MAX_BYTES = 32 * 1024 // flush immediately if buffer exceeds this
const AWARENESS_FLUSH_MS = 25 // presence throttle
const HAS_BEACON = typeof navigator !== "undefined" && "sendBeacon" in navigator

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

  // NEW: client-side batching state
  private pendingDocUpdates: Uint8Array[] = []
  private pendingDocBytes = 0
  private docFlushTimer: number | undefined

  private pendingAwarenessUpdate: Uint8Array | null = null
  private awarenessFlushTimer: number | undefined

  private updateHandler: (update: Uint8Array, origin: unknown) => void
  private awarenessUpdateHandler: (
    changed: AwarenessChange,
    origin: unknown
  ) => void
  private unloadHandler: () => void
  // NEW: also flush on tab hide
  private visibilityHandler: () => void

  constructor(doc: Y.Doc, documentId: string) {
    super()
    this.doc = doc
    this.awareness = new Awareness(doc)
    this.documentId = documentId
    this.persistence = new IndexeddbPersistence(`doc-${documentId}`, doc)

    // Document updates - batch and merge
    this.updateHandler = (update, origin) => {
      if (origin === this) return
      this.queueDocumentUpdate(update)
    }

    // Awareness updates - throttle and keep only latest
    this.awarenessUpdateHandler = (
      { added, updated, removed }: AwarenessChange,
      origin
    ) => {
      if (origin !== "local") return
      const changed = added.concat(updated).concat(removed)
      const update = awarenessProtocol.encodeAwarenessUpdate(
        this.awareness,
        changed
      )
      this.queueAwarenessUpdate(update)
    }

    this.unloadHandler = () => {
      // ensure presence is cleared remotely
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        [this.doc.clientID],
        "local"
      )
      // final best-effort flushes
      this.flushDocumentUpdates()
      if (this.pendingAwarenessUpdate) {
        this.sendAwarenessUpdate(this.pendingAwarenessUpdate, true)
        this.pendingAwarenessUpdate = null
      }
    }

    this.visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        this.flushDocumentUpdates()
      }
    }

    this.doc.on("update", this.updateHandler)
    this.awareness.on("update", this.awarenessUpdateHandler)
    window.addEventListener("beforeunload", this.unloadHandler)
    document.addEventListener("visibilitychange", this.visibilityHandler)

    this.connect()
  }

  override destroy() {
    this.doc.off("update", this.updateHandler)
    this.awareness.off("update", this.awarenessUpdateHandler)
    window.removeEventListener("beforeunload", this.unloadHandler)
    document.removeEventListener("visibilitychange", this.visibilityHandler)
    if (this.docFlushTimer) window.clearTimeout(this.docFlushTimer)
    if (this.awarenessFlushTimer) window.clearTimeout(this.awarenessFlushTimer)
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
        const headers = m.headers as { operation?: string }
        if (headers.operation === "delete") {
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

  // ---- NEW: batching utilities ----

  private queueDocumentUpdate(update: Uint8Array) {
    this.pendingDocUpdates.push(update)
    this.pendingDocBytes += update.byteLength

    if (this.pendingDocBytes >= UPDATE_MAX_BYTES) {
      this.flushDocumentUpdates()
      return
    }

    if (this.docFlushTimer) window.clearTimeout(this.docFlushTimer)
    this.docFlushTimer = window.setTimeout(
      () => this.flushDocumentUpdates(),
      UPDATE_FLUSH_MS
    )
  }

  private flushDocumentUpdates() {
    if (!this.pendingDocUpdates.length) return
    const merged = Y.mergeUpdates(this.pendingDocUpdates)
    this.pendingDocUpdates = []
    this.pendingDocBytes = 0
    this.sendDocumentUpdate(merged)
  }

  private queueAwarenessUpdate(update: Uint8Array) {
    // Presence is ephemeral - keep only the most recent
    this.pendingAwarenessUpdate = update
    if (this.awarenessFlushTimer) return
    this.awarenessFlushTimer = window.setTimeout(() => {
      if (this.pendingAwarenessUpdate) {
        this.sendAwarenessUpdate(this.pendingAwarenessUpdate)
        this.pendingAwarenessUpdate = null
      }
      this.awarenessFlushTimer = undefined
    }, AWARENESS_FLUSH_MS)
  }

  // This function expects a fully-formed Yjs update
  private sendDocumentUpdate(update: Uint8Array) {
    const url = `/api/document-updates?documentId=${this.documentId}`
    // Use beacon only when the page is hiding to avoid size limits
    if (HAS_BEACON && document.visibilityState === "hidden") {
      const data = new Uint8Array(update)
      navigator.sendBeacon(url, new Blob([data]))
      return
    }
    fetch(url, {
      method: "PUT",
      body: update as BodyInit,
      headers: { "content-type": "application/octet-stream" },
    })
  }

  private sendAwarenessUpdate(update: Uint8Array, forceBeacon = false) {
    const url = `/api/awareness-updates?documentId=${this.documentId}&clientId=${this.doc.clientID}`
    if (HAS_BEACON && (forceBeacon || document.visibilityState === "hidden")) {
      const data = new Uint8Array(update)
      navigator.sendBeacon(url, new Blob([data]))
      return
    }
    fetch(url, { method: "PUT", body: update as BodyInit, keepalive: true })
  }
}
