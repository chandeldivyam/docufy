'use client';

import * as React from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';

const SUPPORTED = [
  'typescript',
  'javascript',
  'json',
  'bash',
  'html',
  'css',
  'python',
  'go',
  'java',
  'ruby',
  'php',
  'c',
  'cpp',
  'rust',
  'sql',
  'yaml',
  'markdown',
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CodeBlockView(props: any) {
  const { node, extension, updateAttributes, editor } = props;
  const current = (node.attrs?.language as string | null) ?? null;

  const languages: string[] = React.useMemo(
    () =>
      extension.options?.lowlight?.listLanguages?.()
        ? extension.options.lowlight.listLanguages()
        : [],
    [extension.options?.lowlight],
  );

  // Avoid calling TipTap's updateAttributes directly inside React lifecycle
  // because TipTap internally uses React.flushSync, which triggers
  // "flushSync was called from inside a lifecycle method" in React 18.
  // Defer the attribute update to a microtask so React has finished the
  // current render/effect before TipTap flushes.
  React.useEffect(() => {
    if (current && !languages.includes(current)) {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled && !editor?.isDestroyed) {
          updateAttributes({ language: null });
        }
      });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, languages.join('|')]);

  const [copied, setCopied] = React.useState(false);

  const supported = React.useMemo(() => {
    const set = new Set(languages);
    return SUPPORTED.filter((l) => set.has(l));
  }, [languages]);

  const onChangeLanguage: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const v = e.target.value;
    updateAttributes({ language: v === 'typescript' ? null : v });
    editor?.commands.focus();
  };

  const onCopy = async () => {
    const codeText = node.textContent ?? '';
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      // no-op
    }
  };

  const codeClass = current ? `hljs language-${current}` : 'hljs';

  return (
    <NodeViewWrapper as="div" className="tt-codeblock-group">
      <div className="tt-codeblock-header" contentEditable={false}>
        <div className="tt-codeblock-left">
          <label htmlFor="tt-lang" className="sr-only">
            Language
          </label>
          <select
            id="tt-lang"
            className="tt-codeblock-select"
            value={current ?? 'typescript'}
            onChange={onChangeLanguage}
            aria-label="Select code language"
          >
            {supported.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="tt-codeblock-right">
          <button
            type="button"
            className="tt-codeblock-copy"
            onClick={onCopy}
            aria-label="Copy code"
            title="Copy code"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <pre className="tt-codeblock-pre">
        <NodeViewContent className={codeClass} />
      </pre>
    </NodeViewWrapper>
  );
}
