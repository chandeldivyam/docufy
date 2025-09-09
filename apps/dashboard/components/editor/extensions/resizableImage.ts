// apps/dashboard/components/editor/extensions/resizableImage.ts
import Image from '@tiptap/extension-image';
import { UploadImagesPlugin } from '../plugins/uploadImages';
import { NodeSelection, Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const ResizableImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...((this as unknown as { parent?: () => Record<string, unknown> }).parent?.() ?? {}),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('width') || null,
        renderHTML: (attrs: Record<string, unknown>) => (attrs.width ? { width: attrs.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('height') || null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.height ? { height: attrs.height } : {},
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      UploadImagesPlugin({
        imageClass: 'opacity-40 rounded-md border border-border',
      }),
      // Add selection helper plugin
      new Plugin({
        props: {
          handleClickOn(view, _pos, node, nodePos, event) {
            if (node.type.name === 'image') {
              event.preventDefault();
              // Set node selection on the image
              const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos));
              view.dispatch(tr);
              return true;
            }
            return false;
          },
          decorations(state) {
            const decorations: Decoration[] = [];
            const { doc, selection } = state;

            // Add selected class to images
            if (selection.from === selection.to) {
              const node = doc.nodeAt(selection.from);
              if (node?.type.name === 'image') {
                decorations.push(
                  Decoration.node(selection.from, selection.from + node.nodeSize, {
                    class: 'ProseMirror-selectednode',
                  }),
                );
              }
            }

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
}).configure({
  allowBase64: true,
  HTMLAttributes: {
    class: 'rounded-md border border-border cursor-pointer transition-all hover:opacity-90',
  },
});
