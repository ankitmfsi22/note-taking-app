import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchHealth } from './api';

export const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: fetchHealth,
});

export const useHealth = () => useQuery(healthQueryOptions);
