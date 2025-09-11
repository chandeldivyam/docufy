// apps/dashboard/convex/_publish/serialize.ts
import { renderToHTMLString } from '@tiptap/static-renderer';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import { JSONContent } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';

// Register just a few languages you care about (keeps bundle small)
import ts from 'highlight.js/lib/languages/typescript';
import js from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';

const lowlight = createLowlight();
lowlight.register('ts', ts);
lowlight.register('typescript', ts);
lowlight.register('js', js);
lowlight.register('javascript', js);
lowlight.register('json', json);
lowlight.register('bash', bash);
lowlight.register('shell', bash);
lowlight.register('python', python);

// Stable slug for heading IDs
function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

// Walk a PM node to collect plain text (for TOC, search excerpts)
function textOf(node: JSONContent | Node): string {
  if (!node) return '';

  // Handle TipTap JSONContent format
  if ('text' in node && typeof node.text === 'string') {
    return node.text;
  }

  // Handle ProseMirror Node format
  if ('textContent' in node && typeof node.textContent === 'string') {
    return node.textContent;
  }

  // Handle content array
  const content = 'content' in node ? node.content : [];
  if (Array.isArray(content)) {
    return content.map(textOf).join('');
  }

  return '';
}

// Extract TOC entries from PM JSON
export function extractToc(pm: JSONContent) {
  const toc: { level: number; text: string; id: string }[] = [];
  const seen = new Set<string>();

  function walk(n: JSONContent) {
    if (!n) return;
    if (n.type === 'heading') {
      const level = Math.min(Math.max(n.attrs?.level ?? 1, 1), 6);
      const text = textOf(n);
      let id = slugify(text) || `h${level}`;
      // ensure uniqueness
      let suffix = 1;
      const base = id;
      while (seen.has(id)) id = `${base}-${suffix++}`;
      seen.add(id);
      toc.push({ level, text, id });
    }
    (n.content ?? []).forEach(walk);
  }
  walk(pm);
  return toc;
}

// Image with width/height passthrough (matches your editor)
const StaticImage = Image.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      width: { default: null },
      height: { default: null },
    };
  },
});

// Code block with Lowlight highlighting but without any NodeView/React
const StaticCodeBlock = CodeBlockLowlight.configure({ lowlight }).extend({
  // ensure no NodeView is used on the server
  addNodeView() {
    return null;
  },
});

// Post-process HTML to add heading IDs based on TOC
function addHeadingIds(html: string, toc: { level: number; text: string; id: string }[]): string {
  let processedHtml = html;

  // Create a map of heading text to ID for quick lookup
  const headingMap = new Map<string, string>();
  toc.forEach((entry) => {
    headingMap.set(entry.text, entry.id);
  });

  // Replace headings with ID attributes
  processedHtml = processedHtml.replace(
    /<h([1-6])([^>]*)>(.*?)<\/h[1-6]>/g,
    (match, level, attrs, content) => {
      // Extract plain text from content (remove any inner HTML tags)
      const plainText = content.replace(/<[^>]*>/g, '');
      const id = headingMap.get(plainText);

      if (id) {
        // Add id attribute if not already present
        if (!attrs.includes('id=')) {
          const newAttrs = attrs.trim() ? `${attrs} id="${id}"` : ` id="${id}"`;
          return `<h${level}${newAttrs}>${content}</h${level}>`;
        }
      }

      return match;
    },
  );

  return processedHtml;
}

export function serializeWithTiptap(pmDoc: JSONContent): {
  html: string;
  toc: { level: number; text: string; id: string }[];
} {
  const toc = extractToc(pmDoc);

  // Use standard extensions without custom renderHTML that conflicts with static renderer
  let html = renderToHTMLString({
    extensions: [
      StarterKit.configure({ codeBlock: false }), // we'll provide our own code block
      Heading, // Use standard heading extension
      StaticImage,
      StaticCodeBlock,
    ],
    content: pmDoc ?? { type: 'doc', content: [] },
  });

  // Post-process HTML to add heading IDs
  html = addHeadingIds(html, toc);

  return { html, toc };
}
