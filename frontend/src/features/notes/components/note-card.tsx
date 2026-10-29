import type { NoteListItem } from '@note-app/shared';
import { Button } from '@/components/ui/button';
import { TagBadge } from '@/features/tags/components/tag-badge';
import { formatDate } from '@/lib/format-date';

interface NoteCardProps {
  note: NoteListItem;
  onDelete: (note: NoteListItem) => void;
}

// Everything is rendered as React text nodes, never as HTML.
export function NoteCard({ note, onDelete }: NoteCardProps) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium break-words">{note.title}</h3>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Delete ${note.title}`}
          onClick={() => onDelete(note)}
        >
          Delete
        </Button>
      </div>
      {note.preview && <p className="text-sm break-words text-muted-foreground">{note.preview}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {note.tags.map((tag) => (
          <TagBadge key={tag.id} tag={tag} />
        ))}
        <time dateTime={note.updatedAt} className="ml-auto text-xs text-muted-foreground">
          {formatDate(note.updatedAt)}
        </time>
      </div>
    </article>
  );
}
