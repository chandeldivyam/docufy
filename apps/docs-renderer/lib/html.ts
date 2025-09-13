// Lightweight sanitizer placeholder.
// Content is trusted from our own pipeline, so we keep this as a no-op for performance.
// If you need defense-in-depth, prefer a small allowlist sanitizer that runs on the Edge runtime
// without Node.js APIs. For example, a minimal tag/attr filter using an HTML tokenizer.

export function sanitize(html: string) {
  return html;
}
