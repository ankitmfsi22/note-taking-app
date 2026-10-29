import { Outlet } from 'react-router';

// No session, no navigation and no owner controls: the public page is read-only.
export function Component() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl p-6">
      <Outlet />
    </main>
  );
}
