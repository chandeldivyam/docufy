import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const uploadPluginKey = new PluginKey('upload-videos-extension');

export type VideoUploadResult = {
  url: string;
  width?: number;
  height?: number;
  poster?: string;
};

export type VideoUploadContext = {
  orgSlug?: string;
  documentId?: string;
};

type InternalUploader = (file: File) => Promise<VideoUploadResult>;

const defaultValidateFile = (file: File) =>
  file.type.startsWith('video/') && file.size <= 40 * 1024 * 1024; // 40 MB cap

const findVideoPos = (view: EditorView, predicate: (node: PMNode) => boolean): number | null => {
  let found: number | null = null;
  view.state.doc.descendants((node: PMNode, pos: number) => {
    if (node.type.name === 'video' && predicate(node)) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
};

const updateVideoNode = (view: EditorView, pos: number, attrs: Record<string, unknown>) => {
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;
  const nextAttrs = { ...node.attrs, ...attrs };
  const tr = view.state.tr.setNodeMarkup(pos, undefined, nextAttrs, node.marks);
  view.dispatch(tr);
};

const removeVideoNode = (view: EditorView, pos: number) => {
  const tr = view.state.tr.delete(pos, pos + 1);
  view.dispatch(tr);
};

const processFile = ({
  file,
  view,
  pos,
  uploader,
}: {
  file: File;
  view: EditorView;
  pos: number;
  uploader?: InternalUploader;
}): number => {
  const { schema } = view.state;
  const videoType = schema.nodes.video;
  if (!videoType) return pos;

  const objectUrl = URL.createObjectURL(file);
  const attrs: Record<string, unknown> = { src: objectUrl, controls: true };
  if (uploader) attrs['data-uploading'] = '1';

  const node = videoType.create(attrs);
  const tr = view.state.tr.insert(pos, node);
  view.dispatch(tr);
  const nextPos = pos + node.nodeSize;

  if (!uploader) {
    URL.revokeObjectURL(objectUrl);
    const insertedPos = findVideoPos(view, (n) => n.attrs.src === objectUrl);
    if (insertedPos != null) removeVideoNode(view, insertedPos);
    console.warn('UploadVideosExtension: missing uploader. Video removed.');
    return nextPos;
  }

  void (async () => {
    try {
      const result = await uploader(file);
      const currentPos = findVideoPos(view, (n) => n.attrs.src === objectUrl);
      if (currentPos == null) return;
      updateVideoNode(view, currentPos, {
        src: result.url,
        width: result.width ?? null,
        height: result.height ?? null,
        poster: result.poster ?? null,
        'data-uploading': null,
      });
    } catch (error) {
      const currentPos = findVideoPos(view, (n) => n.attrs.src === objectUrl);
      if (currentPos != null) removeVideoNode(view, currentPos);
      console.error('Video upload failed:', error);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  })();

  return nextPos;
};

const handleFiles = ({
  files,
  view,
  pos,
  uploader,
  validate = defaultValidateFile,
  replaceSelection = false,
}: {
  files: File[];
  view: EditorView;
  pos: number;
  uploader?: InternalUploader;
  validate?: (file: File) => boolean;
  replaceSelection?: boolean;
}): boolean => {
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
  return accepted.length > 0;
};

export interface UploadVideosExtensionOptions {
  uploader?: (
    file: File,
    ctx: { orgSlug?: string; documentId: string },
  ) => Promise<VideoUploadResult>;
  context?: VideoUploadContext;
  validateFile?: (file: File) => boolean;
}

/**
 * Paste/Drop handler for video/* files.
 * NOTE: returns `false` after preventDefault so other media plugins (images) can also run.
 */
export const UploadVideosExtension = Extension.create<UploadVideosExtensionOptions>({
  name: 'UploadVideos',

  addOptions() {
    return {
      uploader: undefined,
      context: {},
      validateFile: undefined,
    } satisfies UploadVideosExtensionOptions;
  },

  addProseMirrorPlugins() {
    const uploaderOption = this.options.uploader;
    const context = this.options.context ?? {};
    const documentId = context.documentId;

    if (!uploaderOption || !documentId) return [];

    const internalUploader: InternalUploader = (file) =>
      uploaderOption(file, {
        orgSlug: context.orgSlug,
        documentId,
      });

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
              // Allow image plugin to also process the same event (mixed paste)
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
              // Allow image plugin to also process the same event (mixed drop)
              return false;
            },
          },
        },
      }),
    ];
  },
});
