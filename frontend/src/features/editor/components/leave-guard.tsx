import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEditorSaveStore } from '../save-store';

const hasUnsaved = () => {
  const { isDirty, status } = useEditorSaveStore.getState();
  return isDirty || status === 'saving';
};

// AC-FEEDIT-06: an in-app navigation saves first and continues only if the save worked; a failed
// save asks. Closing the tab gets the browser's own warning.
export function LeaveGuard() {
  const unsaved = useEditorSaveStore((state) => state.isDirty || state.status === 'saving');
  const [asking, setAsking] = useState(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsaved() && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let active = true;
    const flush = useEditorSaveStore.getState().flush;
    void (flush ? flush() : Promise.resolve(true)).then((saved) => {
      if (!active) return;
      if (saved) blocker.proceed();
      else setAsking(true);
    });
    return () => {
      active = false;
    };
  }, [blocker]);

  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const stay = () => {
    setAsking(false);
    if (blocker.state === 'blocked') blocker.reset();
  };

  const leave = () => {
    setAsking(false);
    if (blocker.state === 'blocked') blocker.proceed();
  };

  return (
    <AlertDialog open={asking} onOpenChange={(open) => !open && stay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>
            Your latest edits could not be saved. If you leave now, they are lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={stay}>Stay</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={leave}>
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
