'use client';

import { useCurrentEditor } from '@tiptap/react';
import Moveable from 'react-moveable';
import { useEffect, useState, useCallback, type FC } from 'react';

const MIN_WIDTH = 200;
const MIN_HEIGHT = 200;

const ImageResizer: FC = () => {
  const { editor } = useCurrentEditor();
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      // Simpler check - just see if image is active
      if (editor.isActive('image')) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          const img = document.querySelector(
            '.ProseMirror-selectednode',
          ) as HTMLImageElement | null;
          setSelectedImage(img);
        }, 0);
      } else {
        setSelectedImage(null);
      }
    };

    editor.on('selectionUpdate', updateSelection);
    editor.on('transaction', updateSelection);

    // Initial check
    updateSelection();

    return () => {
      editor.off('selectionUpdate', updateSelection);
      editor.off('transaction', updateSelection);
    };
  }, [editor]);

  const updateMediaSize = useCallback(() => {
    if (!editor || !selectedImage) return;

    const width = parseInt(selectedImage.style.width || `${selectedImage.naturalWidth}`, 10);
    const height = parseInt(selectedImage.style.height || `${selectedImage.naturalHeight}`, 10);

    const constrainedWidth = Math.max(width, MIN_WIDTH);
    const constrainedHeight = Math.max(height, MIN_HEIGHT);

    // Use the simpler setImage command approach
    editor
      .chain()
      .focus()
      .updateAttributes('image', {
        width: constrainedWidth,
        height: constrainedHeight,
      })
      .run();
  }, [editor, selectedImage]);

  if (!editor?.isActive('image') || !selectedImage) return null;

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
      renderDirections={['e', 'w']}
      onResize={({ target, width, height, delta }) => {
        const constrainedWidth = Math.max(width, MIN_WIDTH);
        const constrainedHeight = Math.max(height, MIN_HEIGHT);
        if (delta[0]) (target as HTMLElement).style.width = `${constrainedWidth}px`;
        if (delta[1]) (target as HTMLElement).style.height = `${constrainedHeight}px`;
      }}
      onResizeEnd={updateMediaSize}
      scalable
      throttleScale={0}
      onScale={({ target, transform }) => {
        (target as HTMLElement).style.transform = transform;
      }}
      onScaleEnd={updateMediaSize}
    />
  );
};

export default ImageResizer;
