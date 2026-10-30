import { Link } from 'react-router';
import { useDocumentMeta } from '@/lib/use-document-meta';

export function Component() {
  useDocumentMeta({
    title: 'Page not found',
    description: 'The page you are looking for does not exist.',
    noindex: true,
  });
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-primary underline-offset-4 hover:underline">
        Back to the start
      </Link>
    </main>
  );
}
