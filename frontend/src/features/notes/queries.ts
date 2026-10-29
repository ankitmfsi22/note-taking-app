import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createNote, deleteNote, listNotes } from './api';
import type { ListParams } from './list-params';

export const notesListKey = ['notes', 'list'] as const;
export const notesTrashKey = ['notes', 'trash'] as const;
export const tagsKey = ['tags'] as const;

export const useNotesQuery = (params: ListParams) =>
  useQuery({
    queryKey: [...notesListKey, params],
    queryFn: () => listNotes(params),
    placeholderData: keepPreviousData,
  });

export const useCreateNoteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesListKey }),
  });
};

export const useDeleteNoteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNote,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: notesListKey }),
        queryClient.invalidateQueries({ queryKey: notesTrashKey }),
        queryClient.invalidateQueries({ queryKey: tagsKey }),
      ]),
  });
};
