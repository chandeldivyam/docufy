import { atom } from 'jotai';
import type { Range, Editor } from '@tiptap/core';

export const queryAtom = atom('');
export const rangeAtom = atom<Range | null>(null);
export const editorAtom = atom<Editor | null>(null);
