import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notesListKey, tagsKey } from '@/features/notes/queries';
import { createTag, deleteTag, listTags, updateTag } from './api';

export const useTagsQuery = () => useQuery({ queryKey: tagsKey, queryFn: listTags });

// A tag change also changes the tags on note cards (SDS 9.2).
const useInvalidateTags = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: tagsKey }),
      queryClient.invalidateQueries({ queryKey: notesListKey }),
    ]);
};

export const useCreateTagMutation = () =>
  useMutation({ mutationFn: createTag, onSuccess: useInvalidateTags() });

export const useUpdateTagMutation = () =>
  useMutation({
    mutationFn: ({ tagId, body }: { tagId: string; body: Parameters<typeof updateTag>[1] }) =>
      updateTag(tagId, body),
    onSuccess: useInvalidateTags(),
  });

export const useDeleteTagMutation = () =>
  useMutation({ mutationFn: deleteTag, onSuccess: useInvalidateTags() });
