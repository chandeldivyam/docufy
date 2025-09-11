declare module '@tiptap/extension-code-block-lowlight' {
  const anyDefault: any;
  export default anyDefault;
}

declare module '@tiptap/extension-image' {
  const anyDefault: any;
  export default anyDefault;
}

declare module '@tiptap/pm/state' {
  export type EditorState = any;
  export type Transaction = any;
  export class PluginKey {
    constructor(name?: string);
    getState(state: any): any;
  }
  export class Plugin {
    constructor(options: any);
  }
}

declare module '@tiptap/pm/view' {
  export type EditorView = any;
  export class DecorationSet {
    static empty: DecorationSet;
    map(...args: any[]): DecorationSet;
    add(doc: any, decos: any[]): DecorationSet;
    remove(decos: any[]): DecorationSet;
    find(from?: any, to?: any, pred?: (spec: any) => boolean): any[];
  }
  export class Decoration {
    static widget(pos: number, dom: HTMLElement, options?: any): any;
  }
}

declare module 'lowlight/lib/core.js' {
  export type LowlightRoot = any;
}
