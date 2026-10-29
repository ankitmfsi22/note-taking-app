import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { noteDetailKey } from '@/features/editor/queries';
import { useEditorSaveStore } from '@/features/editor/save-store';
import { getVersion, listVersions, restoreVersion } from './api';

export const versionsKey = (noteId: string) => ['versions', noteId] as const;
const versionsListKey = (noteId: string) => [...versionsKey(noteId), 'list'] as const;
const versionKey = (noteId: string, versionNumber: number) =>
  [...versionsKey(noteId), versionNumber] as const;

// Thrown instead of sending the restore when the editor could not save its pending edits.
export class FlushFailedError extends Error {
  constructor() {
    super('Your unsaved changes could not be saved, so the version was not restored.');
    this.name = 'FlushFailedError';
  }
}

export const useVersionsQuery = (noteId: string) =>
  useInfiniteQuery({
    queryKey: versionsListKey(noteId),
    queryFn: ({ pageParam }) => listVersions(noteId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

export const useVersionQuery = (noteId: string, versionNumber: number | null) =>
  useQuery({
    queryKey: versionKey(noteId, versionNumber ?? 0),
    queryFn: () => getVersion(noteId, versionNumber ?? 0),
    enabled: versionNumber !== null,
    // A version is immutable (SDS 9.2).
    staleTime: Infinity,
  });

export const useRestoreVersion = (noteId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionNumber: number) => {
      // AC-FEVER-07: the editor's pending edits are saved before the restore request goes out.
      const flush = useEditorSaveStore.getState().flush;
      if (flush && !(await flush())) throw new FlushFailedError();
      return restoreVersion(noteId, versionNumber);
    },
    onSuccess: (note) => {
      queryClient.setQueryData(noteDetailKey(noteId), note);
      void queryClient.invalidateQueries({ queryKey: versionsListKey(noteId) });
      void queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
    },
  });
};
