'use client';

import * as React from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { toast } from 'sonner';

// These are the only languages we register with Lowlight (see DocEditor)
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

export function CodeBlockView(props: NodeViewProps) {
  const { node, extension, updateAttributes, editor } = props;
  const current = (node.attrs.language as string | null) ?? null;

  // get the language list directly from the configured lowlight instance
  const languages: string[] = React.useMemo(
    () =>
      extension.options?.lowlight?.listLanguages?.()
        ? extension.options.lowlight.listLanguages()
        : [],
    [extension.options?.lowlight],
  );

  // If the document contains an old/unsupported language, reset to auto-detect
  React.useEffect(() => {
    if (current && !languages.includes(current)) {
      updateAttributes({ language: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, languages.join('|')]);

  const [copied, setCopied] = React.useState(false);

  const supported = React.useMemo(() => {
    const set = new Set(languages);
    // only show languages that are actually registered
    return SUPPORTED.filter((l) => set.has(l));
  }, [languages]);

  const onChangeLanguage: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const v = e.target.value;
    updateAttributes({ language: v === 'auto' ? null : v });
    editor?.commands.focus();
  };

  const onCopy = async () => {
    const codeText = node.textContent ?? '';
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      toast.success('Code copied');
      setTimeout(() => setCopied(false), 900);
    } catch {
      toast.error('Copy failed');
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
            value={current ?? 'auto'}
            onChange={onChangeLanguage}
            aria-label="Select code language"
          >
            <option value="auto">Auto detect</option>
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
        {/* contentDOMElementTag is set to 'code' in the NodeView renderer */}
        <NodeViewContent className={codeClass} />
      </pre>
    </NodeViewWrapper>
  );
}
