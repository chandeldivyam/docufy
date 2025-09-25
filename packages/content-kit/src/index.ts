export * from './preset/index.js';
export * as Lowlight from './lowlight/index.js';
export * from './renderer/index.js';
export * from './extensions/code-block/index.js';
export * from './extensions/image/index.js';
export * from './plugins/upload-images.js';
export {
  Command,
  renderItems,
  createSuggestionItems,
  handleCommandNavigation,
  type SuggestionItem,
} from './extensions/slash-command/index.js';

// NEW: command UI + provider
export { EditorRoot } from './components/editor-root.js';
export { EditorCommand, EditorCommandList } from './components/command/editor-command.js';
export { EditorCommandItem, EditorCommandEmpty } from './components/command/editor-command-item.js';
