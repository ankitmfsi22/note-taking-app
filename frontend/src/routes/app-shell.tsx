import { Navigate, NavLink, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { useLogoutMutation } from '@/features/auth/queries';
import { useAuthStore } from '@/features/auth/session-store';

const NAV_LINK_CLASS =
  'rounded-md px-2 py-1 text-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:font-semibold';

export function Component() {
  const user = useAuthStore((state) => state.user);
  const logout = useLogoutMutation();

  // The loader guards navigations; this covers the session ending on an open page
  // (logout, or a failed silent refresh).
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-3 focus:ring-ring/50"
      >
        Skip to main content
      </a>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Note App</span>
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavLink to="/notes" end className={NAV_LINK_CLASS}>
              Notes
            </NavLink>
            <NavLink to="/shares" className={NAV_LINK_CLASS}>
              Shared links
            </NavLink>
          </nav>
        </div>
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
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
