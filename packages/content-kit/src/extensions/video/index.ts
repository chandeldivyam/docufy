import { Node } from '@tiptap/core';

const isTrue = (v: unknown) => v === true || v === '' || v === 'true' || v === 1 || v === '1';

export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      poster: { default: null },
      width: { default: null },
      height: { default: null },
      autoplay: { default: null },
      loop: { default: null },
      muted: { default: null },
      'data-uploading': {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-uploading'),
        renderHTML: (attrs: Record<string, unknown>) => {
          const v = attrs['data-uploading'];
          return v ? { 'data-uploading': v as string } : {};
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const a = HTMLAttributes;

    // Wrapper <figure>
    const wrapper: Record<string, string> = { class: 'dfy-video' };
    if (a['data-uploading']) wrapper['data-uploading'] = a['data-uploading'];

    // Build <video> attributes explicitly - omit falsy/null values
    const videoAttrs: Record<string, string> = {
      controls: '', // always on
      playsinline: '', // better mobile UX
      preload: 'metadata', // no eager download
    };

    if (a.src) videoAttrs.src = a.src;
    if (a.poster && a.poster !== 'null') videoAttrs.poster = a.poster;
    if (a.width != null) videoAttrs.width = a.width;
    if (a.height != null) videoAttrs.height = a.height;

    // Only include boolean flags if truly enabled
    if (isTrue(a.autoplay)) videoAttrs.autoplay = '';
    if (isTrue(a.loop)) videoAttrs.loop = '';
    if (isTrue(a.muted)) videoAttrs.muted = '';

    return ['figure', wrapper, ['video', videoAttrs]];
  },
});

// Static variant stays identical
export const StaticVideo = Video;
