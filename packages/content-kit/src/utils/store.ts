import { createStore } from 'jotai';

// keep isolated from app Jotai stores
// biome-ignore lint/suspicious/noExplicitAny: library store may be typed by callers later
export const contentKitStore = createStore();
export * from 'jotai';
