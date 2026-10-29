import type { NoteResponse } from '@note-app/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import { getNote, listTags, setNoteTags } from './api';

export const noteDetailKey = (noteId: string) => ['notes', 'detail', noteId] as const;
export const tagsKey = ['tags'] as const;

export const useNoteQuery = (noteId: string) =>
  useQuery({
    queryKey: noteDetailKey(noteId),
    queryFn: () => getNote(noteId),
    // The editor owns the live document; a background refetch must not reach it.
    staleTime: Infinity,
    retry: (count, error) =>
      !(error instanceof ApiError && error.status < 500 && error.status > 0) && count < 1,
  });

export const useTagsQuery = () => useQuery({ queryKey: tagsKey, queryFn: listTags });

export const useSetNoteTagsMutation = (noteId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagIds: string[]) => setNoteTags(noteId, { tagIds }),
    onSuccess: (note) => {
      // Only the tags: the cached title and content belong to the autosave.
      queryClient.setQueryData(noteDetailKey(noteId), (old: NoteResponse | undefined) =>
        old ? { ...old, tags: note.tags } : note,
      );
      void queryClient.invalidateQueries({ queryKey: tagsKey });
      void queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
    },
  });
};
