import { NOTE_TAGS_MAX, type TagResponse } from '@note-app/shared';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ApiError } from '@/lib/api-client';
import { useSetNoteTagsMutation, useTagsQuery } from '../queries';

interface TagPickerProps {
  noteId: string;
  tags: TagResponse[];
}

// Assigns existing tags only; creating and renaming tags belongs to the tag management ticket.
// The tags shown are always the server's: a failed request changes nothing on screen.
export function TagPicker({ noteId, tags }: TagPickerProps) {
  const tagsQuery = useTagsQuery();
  const mutation = useSetNoteTagsMutation(noteId);
  const assigned = new Set(tags.map((tag) => tag.id));

  const change = (tagIds: string[]) =>
    mutation.mutate(tagIds, {
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : 'The tags could not be changed.'),
    });

  const toggle = (tagId: string) =>
    change(
      assigned.has(tagId)
        ? tags.filter((tag) => tag.id !== tagId).map((tag) => tag.id)
        : [...tags.map((tag) => tag.id), tagId],
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <Badge key={tag.id} variant="secondary" className="gap-1">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
          {tag.name}
          <button
            type="button"
            aria-label={`Remove ${tag.name}`}
            disabled={mutation.isPending}
            className="rounded-full hover:bg-foreground/10"
            onClick={() => toggle(tag.id)}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Plus />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex w-64 flex-col gap-1">
          {tagsQuery.isPending && <p className="text-sm text-muted-foreground">Loading tags…</p>}
          {tagsQuery.isError && (
            <p role="alert" className="text-sm text-destructive">
              Tags could not be loaded.
            </p>
          )}
          {tagsQuery.data?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">You have no tags yet.</p>
          )}
          {tagsQuery.data?.items.map((tag) => {
            const isOn = assigned.has(tag.id);
            return (
              <Button
                key={tag.id}
                type="button"
                variant={isOn ? 'secondary' : 'ghost'}
                size="sm"
                className="justify-start"
                aria-pressed={isOn}
                disabled={mutation.isPending || (!isOn && assigned.size >= NOTE_TAGS_MAX)}
                onClick={() => toggle(tag.id)}
              >
                {tag.name}
              </Button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
}
