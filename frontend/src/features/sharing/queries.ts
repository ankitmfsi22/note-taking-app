import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateShareLinkRequest } from '@note-app/shared';
import { createShare, getPublicShare, listActiveShares, listNoteShares, revokeShare } from './api';

export const shareKeys = {
  all: ['shares'] as const,
  note: (noteId: string) => ['shares', 'note', noteId] as const,
  active: (page: number) => ['shares', 'active', page] as const,
  publicNote: (token: string) => ['shares', 'public', token] as const,
};

export const useNoteShares = (noteId: string) =>
  useQuery({ queryKey: shareKeys.note(noteId), queryFn: () => listNoteShares(noteId) });

export const useActiveShares = (page: number) =>
  useQuery({ queryKey: shareKeys.active(page), queryFn: () => listActiveShares(page) });

export const useCreateShare = (noteId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateShareLinkRequest) => createShare(noteId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shareKeys.all }),
  });
};

// Settled, not just success: a 404 means the list is stale and must be refetched.
export const useRevokeShare = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeShare,
    onSettled: () => queryClient.invalidateQueries({ queryKey: shareKeys.all }),
  });
};

// Any failure shows the same unavailable state, so retrying would only repeat it.
export const usePublicShare = (token: string) =>
  useQuery({
    queryKey: shareKeys.publicNote(token),
    queryFn: () => getPublicShare(token),
    retry: false,
    staleTime: Infinity,
  });
