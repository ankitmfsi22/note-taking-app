import { HealthResponseSchema } from '@note-app/shared';
import { apiFetch } from '@/lib/api-client';

export const fetchHealth = () => apiFetch('/health', HealthResponseSchema);
