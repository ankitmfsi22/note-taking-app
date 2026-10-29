import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useRevokeShare } from '../queries';
import { REVOKE_MESSAGES } from '../share-utils';

interface RevokeLinkButtonProps {
  shareId: string;
  // Parents show the message, because the row may vanish once the list is refetched.
  onError: (message: string) => void;
}

// Asks first (AC-FESHARE-04); the list is refetched after every outcome (see useRevokeShare).
export function RevokeLinkButton({ shareId, onError }: RevokeLinkButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const revoke = useRevokeShare();

  const confirm = () => {
    revoke.mutate(shareId, {
      onSuccess: () => setConfirming(false),
      onError: (error) => {
        setConfirming(false);
        const notFound =
          error instanceof ApiError &&
          (error.code === 'SHARE_LINK_NOT_FOUND' || error.code === 'NOTE_NOT_FOUND');
        onError(notFound ? REVOKE_MESSAGES.notFound : REVOKE_MESSAGES.failed);
      },
    });
  };

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
        Revoke
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Revoke this link?"
        description="Anyone who has this link will no longer be able to open the note. This cannot be undone."
        confirmLabel="Revoke link"
        pending={revoke.isPending}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
