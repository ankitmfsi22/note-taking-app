import { useMutation, useQueryClient } from '@tanstack/react-query';
import { forgotPassword, login, logout, register, resetPassword } from './api';
import { useAuthStore } from './session-store';

export const useLoginMutation = () =>
  useMutation({ mutationFn: login, onSuccess: (auth) => useAuthStore.getState().setSession(auth) });

export const useRegisterMutation = () =>
  useMutation({
    mutationFn: register,
    onSuccess: (auth) => useAuthStore.getState().setSession(auth),
  });

export const useForgotPasswordMutation = () => useMutation({ mutationFn: forgotPassword });

export const useResetPasswordMutation = () => useMutation({ mutationFn: resetPassword });

// The session ends locally even if the request fails, since the server always answers 204
// (proposal assumption). RequireAuth then shows the login page.
export const useLogoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      useAuthStore.getState().clearSession();
      queryClient.clear();
    },
  });
};
