'use client';

import { useCurrentEditor } from '@tiptap/react';
import Moveable from 'react-moveable';
import { useEffect, useState, useCallback, type FC } from 'react';
import { NodeSelection } from '@tiptap/pm/state';

// Minimum size constraints
const MIN_WIDTH = 200; // minimum 50px width
const MIN_HEIGHT = 200; // minimum 30px height

const ImageResizer: FC = () => {
  const { editor } = useCurrentEditor();
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);

  // Update selected image when selection changes
  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const { state } = editor;
      const { selection } = state;

      // Check if we have a node selection on an image
      if (selection instanceof NodeSelection && selection.node?.type.name === 'image') {
        const img = document.querySelector('.ProseMirror-selectednode') as HTMLImageElement;
        setSelectedImage(img);
      } else {
        setSelectedImage(null);
      }
    };

    // Listen for selection changes
    editor.on('selectionUpdate', updateSelection);
    editor.on('transaction', updateSelection);

    // Initial check
    updateSelection();

    return () => {
      editor.off('selectionUpdate', updateSelection);
      editor.off('transaction', updateSelection);
    };
  }, [editor]);

  // Handle image clicks to ensure selection
  useEffect(() => {
    if (!editor) return;

    const handleImageClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' && target.closest('.ProseMirror')) {
        e.preventDefault();
        e.stopPropagation();

        // Find the position of this image in the document
        const view = editor.view;
        const pos = view.posAtDOM(target, 0);

        // Create a node selection
        const nodeSelection = NodeSelection.create(editor.state.doc, pos);
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.setSelection(nodeSelection);
            return true;
          })
          .run();
      }
    };

    // Add click listener to the editor
    const editorElement = editor.view.dom;
    editorElement.addEventListener('click', handleImageClick);

    return () => {
      editorElement.removeEventListener('click', handleImageClick);
    };
  }, [editor]);

  const commitSize = useCallback(() => {
    if (!editor || !selectedImage) return;

    const { selection } = editor.state;
    let width = parseInt(selectedImage.style.width || `${selectedImage.naturalWidth}`);
    let height = parseInt(selectedImage.style.height || `${selectedImage.naturalHeight}`);

    // Enforce minimum constraints
    width = Math.max(width, MIN_WIDTH);
    height = Math.max(height, MIN_HEIGHT);

    // Apply the constrained dimensions back to the DOM element
    selectedImage.style.width = `${width}px`;
    selectedImage.style.height = `${height}px`;

    // Update the image attributes while maintaining selection
    editor
      .chain()
      .focus()
      .updateAttributes('image', {
        width,
        height,
      })
      .command(({ tr }) => {
        // Maintain the node selection after update
        const nodeSelection = NodeSelection.create(tr.doc, selection.from);
        tr.setSelection(nodeSelection);
        return true;
      })
      .run();
  }, [editor, selectedImage]);

  if (!selectedImage) return null;

  return (
    <Moveable
      target={selectedImage}
      origin={false}
      edge={false}
      keepRatio
      resizable
      // Add minimum size constraints
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      renderDirections={['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
      onResize={({ target, width, height, delta }) => {
        // Enforce minimum constraints during resize
        const constrainedWidth = Math.max(width, MIN_WIDTH);
        const constrainedHeight = Math.max(height, MIN_HEIGHT);

        if (delta[0]) (target as HTMLElement).style.width = `${constrainedWidth}px`;
        if (delta[1]) (target as HTMLElement).style.height = `${constrainedHeight}px`;
      }}
      onResizeEnd={commitSize}
      scalable
      // Add minimum scale constraints to prevent tiny scaling
      minScale={[MIN_WIDTH / selectedImage.naturalWidth, MIN_HEIGHT / selectedImage.naturalHeight]}
      onScale={({ target, transform }) => {
        (target as HTMLElement).style.transform = transform;
      }}
      onScaleEnd={commitSize}
    />
  );
};

export default ImageResizer;
