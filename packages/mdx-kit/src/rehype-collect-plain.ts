// packages/mdx-kit/src/rehype-collect-plain.ts
import type { Plugin } from 'unified';
import type { Root } from 'hast'; // 1. Import Root type for the HTML tree
import type { VFile } from 'vfile'; // 2. Import VFile type
import { toText as hastToText } from 'hast-util-to-text';

// 3. Define a custom interface for your file data if you want strict typing
interface MdxVFileData {
  plainText?: string;
  [key: string]: unknown;
}

// 4. Type the Plugin generic: Plugin<[Options], RootType>
export const collectPlainText: Plugin<[], Root> = () => (tree: Root, file: VFile) => {
  const text = hastToText(tree);

  // 5. Cast file.data to your custom type or just assign it safely
  // file.data is generic, so we tell TS it contains our plainText property
  const data = file.data as MdxVFileData;
  data.plainText = text.replace(/\s+/g, ' ').trim();
};
