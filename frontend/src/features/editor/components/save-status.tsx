import { Button } from '@/components/ui/button';
import { useEditorSaveStore } from '../save-store';

export function SaveStatus() {
  const status = useEditorSaveStore((state) => state.status);
  const isDirty = useEditorSaveStore((state) => state.isDirty);
  const errorMessage = useEditorSaveStore((state) => state.errorMessage);
  const canRetry = useEditorSaveStore((state) => state.canRetry);
  const retry = useEditorSaveStore((state) => state.retry);

  return (
    <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      {status === 'saving' && <span>Saving…</span>}
      {status === 'saved' && !isDirty && <span>Saved</span>}
      {(status === 'idle' || (status === 'saved' && isDirty)) && <span>Unsaved changes</span>}
      {status === 'error' && (
        <>
          <span className="text-destructive">Failed</span>
          {errorMessage && <span className="hidden sm:inline">{errorMessage}</span>}
          {canRetry && retry && (
            <Button type="button" size="sm" variant="outline" onClick={() => void retry()}>
              Retry
            </Button>
          )}
        </>
      )}
    </div>
  );
}
