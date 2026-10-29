import { Navigate, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { useLogoutMutation } from '@/features/auth/queries';
import { useAuthStore } from '@/features/auth/session-store';

export function Component() {
  const user = useAuthStore((state) => state.user);
  const logout = useLogoutMutation();

  // The loader guards navigations; this covers the session ending on an open page
  // (logout, or a failed silent refresh).
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
        <span className="font-semibold">Note App</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{user.displayName ?? user.email}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
