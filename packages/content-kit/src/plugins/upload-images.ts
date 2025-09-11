import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { Extension } from '@tiptap/core';

const uploadKey = new PluginKey('upload-image');

export const UploadImagesPlugin = ({ imageClass }: { imageClass: string }) =>
  new Plugin({
    key: uploadKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr: Transaction, set: DecorationSet) {
        set = set.map(tr.mapping, tr.doc);
        const action = tr.getMeta(this as unknown as PluginKey);
        if (action?.add) {
          const { id, pos, src } = action.add;
          const placeholder = document.createElement('div');
          placeholder.setAttribute('class', 'img-placeholder');
          const image = document.createElement('img');
          image.setAttribute('class', imageClass);
          image.src = src;
          placeholder.appendChild(image);
          const deco = Decoration.widget(pos + 1, placeholder, { id });
          set = set.add(tr.doc, [deco]);
        } else if (action?.remove) {
          set = set.remove(set.find(undefined, undefined, (spec) => spec.id === action.remove.id));
        }
        return set;
      },
    },
    props: {
      decorations(state: EditorState) {
        return (this as unknown as { getState: (s: EditorState) => DecorationSet }).getState(state);
      },
    },
  });

function findPlaceholder(state: EditorState, id: object) {
  const decos = uploadKey.getState(state) as DecorationSet;
  const found = decos.find(undefined, undefined, (spec) => spec.id === id);
  return found.length ? found[0]!.from : null;
}

export type UploadFn = (file: File, view: EditorView, pos: number) => void;

export interface ImageUploadOptions {
  validateFn?: (file: File) => boolean;
  onUpload: (file: File) => Promise<string>;
}

export const createImageUpload =
  ({ validateFn, onUpload }: ImageUploadOptions): UploadFn =>
  (file, view, pos) => {
    const isValid = validateFn ? !!validateFn(file) : true;
    if (!isValid) return;
    const id = {};
    const tr = view.state.tr;
    if (!tr.selection.empty) tr.deleteSelection();
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      tr.setMeta(uploadKey, { add: { id, pos, src: reader.result } });
      view.dispatch(tr);
    };
    onUpload(file).then(
      (url) => {
        const { schema } = view.state;
        const placeholderPos = findPlaceholder(view.state, id);
        if (placeholderPos == null) return;
        const node = schema.nodes.image?.create({ src: url });
        if (!node) return;
        const tx = view.state.tr
          .replaceWith(placeholderPos, placeholderPos, node)
          .setMeta(uploadKey, { remove: { id } });
        view.dispatch(tx);
      },
      () => {
        const tx = view.state.tr.delete(pos, pos).setMeta(uploadKey, { remove: { id } });
        view.dispatch(tx);
      },
    );
  };

export const handleImagePaste = (view: EditorView, event: ClipboardEvent, uploadFn: UploadFn) => {
  if (event.clipboardData?.files.length) {
    event.preventDefault();
    const [file] = Array.from(event.clipboardData.files);
    const pos = view.state.selection.from;
    if (file) uploadFn(file, view, pos);
    return true;
  }
  return false;
};

export interface UploadImagesExtensionOptions {
  imageClass?: string;
}

// Tiptap extension wrapper to install the ProseMirror plugin
export const UploadImagesExtension = Extension.create<UploadImagesExtensionOptions>({
  name: 'UploadImages',
  addOptions() {
    return { imageClass: '' };
  },
  addProseMirrorPlugins() {
    return [UploadImagesPlugin({ imageClass: this.options.imageClass ?? '' })];
  },
});

export const handleImageDrop = (
  view: EditorView,
  event: DragEvent,
  moved: boolean,
  uploadFn: UploadFn,
) => {
  if (!moved && event.dataTransfer?.files.length) {
    event.preventDefault();
    const [file] = Array.from(event.dataTransfer.files);
    const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (file) uploadFn(file, view, (coords?.pos ?? 0) - 1);
    return true;
  }
  return false;
};
