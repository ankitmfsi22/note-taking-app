import { useEffect } from 'react';

export const APP_NAME = 'Note App';

export interface DocumentMeta {
  title: string;
  description: string;
  // Authenticated pages and private share links must stay out of search indexes.
  noindex?: boolean;
}

const upsertMeta = (name: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.append(element);
  }
  element.content = content;
};

// Sets the title and meta tags of the current route. React 19 can hoist <title> and <meta>
// itself, but index.html already carries static defaults, and a second <title> in the head leaves
// the browser's choice undefined. Updating the existing tags keeps exactly one of each.
export function useDocumentMeta({ title, description, noindex = false }: DocumentMeta) {
  useEffect(() => {
    document.title = `${title} | ${APP_NAME}`;
    upsertMeta('description', description);
    if (noindex) {
      upsertMeta('robots', 'noindex, nofollow');
    } else {
      document.head.querySelector('meta[name="robots"]')?.remove();
    }
  }, [title, description, noindex]);
}
