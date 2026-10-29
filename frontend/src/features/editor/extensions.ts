import StarterKit from '@tiptap/starter-kit';

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

// Same rule as the link mark in TipTapDocSchema (SDS 8.1).
const isSafeUri = (url: string): boolean => {
  try {
    return LINK_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
};

// The one extension list. Its nodes and marks equal the allow-list of TipTapDocSchema: no
// underline, no horizontal rule, headings 1 to 3 only.
export const editorExtensions = [
  StarterKit.configure({
    underline: false,
    horizontalRule: false,
    heading: { levels: [1, 2, 3] },
    link: {
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      isAllowedUri: (url) => isSafeUri(url),
    },
  }),
];
