"use client"

import { useCallback, useEffect, useState } from "react"
import type { Editor } from "@tiptap/react"
import Moveable from "react-moveable"

const MIN_WIDTH = 200
const MIN_HEIGHT = 150

type Props = {
  editor: Editor | null
}

export function ImageResizer({ editor }: Props) {
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(
    null
  )

  useEffect(() => {
    if (!editor) return

    const updateSelection = () => {
      if (!editor.isActive("image")) {
        setSelectedImage(null)
        return
      }

      // Wait for ProseMirror to paint the selection node
      queueMicrotask(() => {
        const node = document.querySelector(
          ".ProseMirror-selectednode"
        ) as HTMLImageElement | null

        if (node?.dataset.uploading === "1") {
          // Skip resizing while the upload is still pending
          setSelectedImage(null)
          return
        }

        setSelectedImage(node)
      })
    }

    editor.on("selectionUpdate", updateSelection)
    editor.on("transaction", updateSelection)
    updateSelection()

    return () => {
      editor.off("selectionUpdate", updateSelection)
      editor.off("transaction", updateSelection)
    }
  }, [editor])

  const commitSize = useCallback(() => {
    if (!editor || !selectedImage) return

    const width = parseInt(
      selectedImage.style.width || `${selectedImage.naturalWidth}`,
      10
    )
    const height = parseInt(
      selectedImage.style.height || `${selectedImage.naturalHeight}`,
      10
    )

    const nextWidth = Number.isFinite(width)
      ? Math.max(width, MIN_WIDTH)
      : MIN_WIDTH
    const nextHeight = Number.isFinite(height)
      ? Math.max(height, MIN_HEIGHT)
      : MIN_HEIGHT

    selectedImage.style.transform = ""

    editor
      .chain()
      .focus()
      .updateAttributes("image", {
        width: nextWidth,
        height: nextHeight,
      })
      .run()
  }, [editor, selectedImage])

  if (!editor?.isActive("image") || !selectedImage) {
    return null
  }

  return (
    <Moveable
      target={selectedImage}
      container={null}
      origin={false}
      edge={false}
      keepRatio
      resizable
      throttleResize={0}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      renderDirections={["e", "w"]}
      onResize={({ target, width, height, delta }) => {
        const nextWidth = Math.max(width, MIN_WIDTH)
        const nextHeight = Math.max(height, MIN_HEIGHT)
        if (delta[0]) (target as HTMLElement).style.width = `${nextWidth}px`
        if (delta[1]) (target as HTMLElement).style.height = `${nextHeight}px`
      }}
      onResizeEnd={commitSize}
      scalable
      throttleScale={0}
      onScale={({ target, transform }) => {
        ;(target as HTMLElement).style.transform = transform
      }}
      onScaleEnd={commitSize}
    />
  )
}

export default ImageResizer
