import { AuthResponseSchema, type LoginRequest, type RegisterRequest } from '@note-app/shared';
import { apiFetch, apiSend } from '@/lib/api-client';

const postJson = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
  auth: false,
});

export const login = (body: LoginRequest) => apiFetch('/auth/login', AuthResponseSchema, postJson(body));

export const register = (body: RegisterRequest) =>
  apiFetch('/auth/register', AuthResponseSchema, postJson(body));

export const logout = () => apiSend('/auth/logout', { method: 'POST', auth: false });
