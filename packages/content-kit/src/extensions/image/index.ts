import Image from '@tiptap/extension-image';

export const ResizableImage = Image.extend({
  name: 'image',
  addAttributes() {
    return {
      ...((this as unknown as { parent?: () => Record<string, unknown> }).parent?.() ?? {}),
      width: { default: null },
      height: { default: null },
      'data-uploading': {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-uploading'),
        renderHTML: (attributes: Record<string, unknown>) => {
          const value = attributes['data-uploading'];
          return value ? { 'data-uploading': value as string } : {};
        },
      },
    };
  },
});

// Static variant is identical (kept for parity and future static tweaks)
export const StaticImage = ResizableImage;
