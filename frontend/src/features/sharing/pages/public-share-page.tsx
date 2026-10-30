import { useParams } from 'react-router';
import { useDocumentMeta } from '@/lib/use-document-meta';
import { TiptapView } from '../components/tiptap-view';
import { usePublicShare } from '../queries';

// One state for every failure, so the page never reveals why a link does not work (AC-SHARE-14).
function Unavailable() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">This link is not available</h1>
      <p className="text-muted-foreground">
        It may have been removed, revoked or expired. Ask the owner for a new link.
      </p>
    </section>
  );
}

export function Component() {
  const { token = '' } = useParams();
  const note = usePublicShare(token);
  // Shared by a private link: kept out of search indexes, and the description never repeats
  // note content.
  useDocumentMeta({
    title: note.data?.title ?? 'Shared note',
    description: 'A note shared with you through a private, read-only link.',
    noindex: true,
  });

  if (note.isPending) return <p>Loading…</p>;
  if (note.isError) return <Unavailable />;

  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold break-words">{note.data.title}</h1>
        <p className="text-sm text-muted-foreground">
          Last updated{' '}
          <time dateTime={note.data.updatedAt}>
            {new Date(note.data.updatedAt).toLocaleString()}
          </time>
        </p>
      </header>
      <TiptapView doc={note.data.content} />
    </article>
  );
}
