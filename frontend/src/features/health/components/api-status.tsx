import { Button } from '@/components/ui/button';
import { useHealth } from '../queries';

export function ApiStatus() {
  const { status, error, isFetching, refetch } = useHealth();

  if (status === 'pending') {
    return <p role="status">Checking the API…</p>;
  }

  if (status === 'error') {
    return (
      <div role="alert" className="flex items-center gap-3">
        <p>The API is not reachable: {error.message}.</p>
        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return <p role="status">The API is up.</p>;
}
