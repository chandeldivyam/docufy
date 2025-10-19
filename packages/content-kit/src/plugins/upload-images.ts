import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const uploadPluginKey = new PluginKey('upload-images-extension');

export type UploadResult = {
  url: string;
  width?: number;
  height?: number;
};

export type UploadContext = {
  orgSlug?: string;
  documentId?: string;
};

export type UploadFn = (file: File, view: EditorView, pos: number) => void;

export interface ImageUploadOptions {
  validateFn?: (file: File) => boolean;
  onUpload: (file: File) => Promise<string | UploadResult>;
}

const defaultValidateFile = (file: File) => file.type.startsWith('image/');

const normalizeResult = async (
  uploader: (file: File) => Promise<string | UploadResult>,
  file: File,
): Promise<UploadResult> => {
  const value = await uploader(file);
  if (typeof value === 'string') {
    return { url: value };
  }
  return value;
};

const findImagePos = (
  view: EditorView,
  predicate: (node: ProseMirrorNode) => boolean,
): number | null => {
  let found: number | null = null;
  view.state.doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === 'image' && predicate(node)) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
};

const updateImageNode = (view: EditorView, pos: number, attrs: Record<string, unknown>) => {
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;
  const nextAttrs = { ...node.attrs, ...attrs };
  const tr = view.state.tr.setNodeMarkup(pos, undefined, nextAttrs, node.marks);
  view.dispatch(tr);
};

const removeImageNode = (view: EditorView, pos: number) => {
  const tr = view.state.tr.delete(pos, pos + 1);
  view.dispatch(tr);
};

type InternalUploader = (file: File) => Promise<UploadResult>;

type ProcessFileParams = {
  file: File;
  view: EditorView;
  pos: number;
  uploader?: InternalUploader;
};

const processFile = ({ file, view, pos, uploader }: ProcessFileParams): number => {
  const { schema } = view.state;
  const imageType = schema.nodes.image;
  if (!imageType) return pos;

  const objectUrl = URL.createObjectURL(file);
  const attrs: Record<string, unknown> = { src: objectUrl };
  if (uploader) attrs['data-uploading'] = '1';

  const node = imageType.create(attrs);
  const tr = view.state.tr.insert(pos, node);
  view.dispatch(tr);
  const nextPos = pos + node.nodeSize;

  if (!uploader) {
    URL.revokeObjectURL(objectUrl);
    const insertedPos = findImagePos(view, (n) => n.attrs.src === objectUrl);
    if (insertedPos != null) {
      removeImageNode(view, insertedPos);
    }
    console.warn('UploadImagesExtension: missing uploader for image upload. Image removed.');
    return nextPos;
  }

  void (async () => {
    try {
      const result = await uploader(file);
      const currentPos = findImagePos(view, (n) => n.attrs.src === objectUrl);
      if (currentPos == null) return;
      updateImageNode(view, currentPos, {
        src: result.url,
        width: result.width ?? null,
        height: result.height ?? null,
        'data-uploading': null,
      });
    } catch (error) {
      const currentPos = findImagePos(view, (n) => n.attrs.src === objectUrl);
      if (currentPos != null) {
        removeImageNode(view, currentPos);
      }
      console.error('Image upload failed:', error);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  })();

  return nextPos;
};

type HandleFilesParams = {
  files: File[];
  view: EditorView;
  pos: number;
  uploader?: InternalUploader;
  validate?: (file: File) => boolean;
  replaceSelection?: boolean;
};

const handleFiles = ({
  files,
  view,
  pos,
  uploader,
  validate = defaultValidateFile,
  replaceSelection = false,
}: HandleFilesParams): boolean => {
  const accepted = files.filter((file) => validate(file));
  if (!accepted.length) return false;

  let insertPos = pos;
  if (replaceSelection && !view.state.selection.empty) {
    const tr = view.state.tr.deleteSelection();
    view.dispatch(tr);
    insertPos = view.state.selection.from;
  }
  for (const file of accepted) {
    insertPos = processFile({ file, view, pos: insertPos, uploader });
  }
  return true;
};

export const createImageUpload = ({ validateFn, onUpload }: ImageUploadOptions): UploadFn => {
  const validate = validateFn ?? defaultValidateFile;
  const uploader: InternalUploader = (file) => normalizeResult(onUpload, file);
  return (file, view, pos) => {
    if (!validate(file)) return;
    let targetPos = pos;
    if (!view.state.selection.empty) {
      const tr = view.state.tr.deleteSelection();
      view.dispatch(tr);
      targetPos = view.state.selection.from;
    }
    processFile({ file, view, pos: targetPos, uploader });
  };
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
    if (file) uploadFn(file, view, coords?.pos ?? view.state.selection.from);
    return true;
  }
  return false;
};

export interface UploadImagesExtensionOptions {
  uploader?: (file: File, ctx: { orgSlug?: string; documentId: string }) => Promise<UploadResult>;
  context?: UploadContext;
  validateFile?: (file: File) => boolean;
}

export const UploadImagesExtension = Extension.create<UploadImagesExtensionOptions>({
  name: 'UploadImages',

  addOptions() {
    return {
      uploader: undefined,
      context: {},
      validateFile: undefined,
    } satisfies UploadImagesExtensionOptions;
  },

  addProseMirrorPlugins() {
    const uploaderOption = this.options.uploader;
    const context = this.options.context ?? {};
    const documentId = context.documentId;

    if (!uploaderOption || !documentId) {
      return [];
    }

    const internalUploader: InternalUploader = (file) =>
      uploaderOption(file, { orgSlug: context.orgSlug, documentId });

    const validate = this.options.validateFile ?? defaultValidateFile;

    return [
      new Plugin({
        key: uploadPluginKey,
        props: {
          handleDOMEvents: {
            paste: (view: EditorView, event: ClipboardEvent) => {
              const files = Array.from(event.clipboardData?.files ?? []) as File[];
              if (!files.length) return false;
              const handled = handleFiles({
                files,
                view,
                pos: view.state.selection.from,
                uploader: internalUploader,
                validate,
                replaceSelection: true,
              });
              if (handled) event.preventDefault();
              return false;
            },
            drop: (view: EditorView, event: DragEvent) => {
              if (!event.dataTransfer?.files.length) return false;
              const files = Array.from(event.dataTransfer.files) as File[];
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
              const pos = coords?.pos ?? view.state.selection.from;
              const handled = handleFiles({
                files,
                view,
                pos,
                uploader: internalUploader,
                validate,
                replaceSelection: false,
              });
              if (handled) event.preventDefault();
              return false;
            },
          },
        },
      }),
    ];
  },
});
