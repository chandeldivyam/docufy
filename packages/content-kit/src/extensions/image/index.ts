import Image from '@tiptap/extension-image';

export const ResizableImage = Image.extend({
  name: 'image',
  addAttributes() {
    return {
      ...((this as unknown as { parent?: () => Record<string, unknown> }).parent?.() ?? {}),
      width: { default: null },
      height: { default: null },
    };
  },
});

// Static variant is identical (kept for parity and future static tweaks)
export const StaticImage = ResizableImage;
