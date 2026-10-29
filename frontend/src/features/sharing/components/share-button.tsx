import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShareModal } from './share-modal';

// Mount point for the editor (AC-FEEDIT-09): `<ShareButton noteId={note.id} />`.
export function ShareButton({ noteId }: { noteId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Share
      </Button>
      {open && <ShareModal noteId={noteId} open onOpenChange={setOpen} />}
    </>
  );
}
