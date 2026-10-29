import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notesListKey, notesTrashKey, tagsKey } from '@/features/notes/queries';
import { listTrash, restoreNote } from './api';

export const useTrashQuery = (page: number) =>
  useQuery({
    queryKey: [...notesTrashKey, page],
    queryFn: () => listTrash(page),
    placeholderData: keepPreviousData,
  });

export const useRestoreNoteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreNote,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: notesListKey }),
        queryClient.invalidateQueries({ queryKey: notesTrashKey }),
        queryClient.invalidateQueries({ queryKey: tagsKey }),
      ]),
    // A failed restore (for example 404 after the purge) leaves the row stale, so reload it.
    onError: () => queryClient.invalidateQueries({ queryKey: notesTrashKey }),
  });
};
