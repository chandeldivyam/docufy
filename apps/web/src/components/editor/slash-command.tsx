"use client"

import {
  Command as SlashCommandExtension,
  createSuggestionItems,
  renderItems,
  type SuggestionItem,
} from "@docufy/content-kit"
import {
  ArrowRight,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Text,
  TextQuote,
} from "lucide-react"

export const suggestionItems: SuggestionItem[] = createSuggestionItems([
  {
    title: "Heading 1",
    description: "Big section heading.",
    searchTerms: ["title", "big", "large"],
    icon: <Heading1 size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run()
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading.",
    searchTerms: ["subtitle", "medium"],
    icon: <Heading2 size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run()
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading.",
    searchTerms: ["subtitle", "small"],
    icon: <Heading3 size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run()
    },
  },
  {
    title: "Text",
    description: "Just start typing with plain text.",
    searchTerms: ["p", "paragraph"],
    icon: <Text size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode("paragraph", "paragraph")
        .run()
    },
  },
  {
    title: "Bullet List",
    description: "Create a simple bullet list.",
    searchTerms: ["unordered", "point"],
    icon: <List size={18} />,
    command: ({ editor, range }) => {
      // @ts-expect-error the toggleBulletList exists as per tiptap official documentation
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: "Numbered List",
    description: "Create a list with numbering.",
    searchTerms: ["ordered"],
    icon: <ListOrdered size={18} />,
    command: ({ editor, range }) => {
      // @ts-expect-error the toggleOrderedList exists as per tiptap official documentation
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: "Quote",
    description: "Capture a quote.",
    searchTerms: ["blockquote"],
    icon: <TextQuote size={18} />,
    command: ({ editor, range }) => {
      editor
      .chain()
      .focus()
      .deleteRange(range)
      .toggleNode("paragraph", "paragraph")
      // @ts-expect-error the toggleBlockquote exists as per tiptap official documentation
        .toggleBlockquote()
        .run()
    },
  },
  {
    title: "Code",
    description: "Capture a code snippet.",
    searchTerms: ["codeblock"],
    icon: <Code size={18} />,
    command: ({ editor, range }) => {
      // @ts-expect-error the toggleCodeBlock exists as per tiptap official documentation
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    title: "Expand",
    description: "Collapsible section.",
    searchTerms: ["expand", "collapsible"],
    icon: <ArrowRight size={18} />,
    command: ({ editor, range }) => {
      // @ts-expect-error the setDetails exists as per tiptap official documentation
      editor.chain().focus().deleteRange(range).setDetails().run()
    },
  },
])

export const slashCommand = SlashCommandExtension.configure({
  suggestion: {
    items: () => suggestionItems,
    render: renderItems,
  },
})
