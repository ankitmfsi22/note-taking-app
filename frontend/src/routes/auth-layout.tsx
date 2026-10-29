import { Outlet } from 'react-router';
import { ApiStatus } from '@/features/health/components/api-status';

export function Component() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Note App</h1>
      <Outlet />
      <footer className="text-sm text-muted-foreground">
        <ApiStatus />
      </footer>
    </main>
  );
}
