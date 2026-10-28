import { ApiStatus } from '@/features/health/components/api-status';

export function Component() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Note App</h1>
      <ApiStatus />
    </main>
  );
}
