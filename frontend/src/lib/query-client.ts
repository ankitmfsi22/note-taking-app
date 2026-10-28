import { QueryClient } from '@tanstack/react-query';

// SDS 9.2 (SA-33): one retry for queries, none for mutations, no refetch on window focus.
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
