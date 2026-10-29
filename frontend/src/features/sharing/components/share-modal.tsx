import { CreateShareLinkRequestSchema } from '@note-app/shared';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormError, FormField } from '@/features/auth/components/form-field';
import { applyServerError } from '@/features/auth/server-errors';
import { Button } from '@/components/ui/button';
import { useCreateShare, useNoteShares } from '../queries';
import { expiryRangeError } from '../share-utils';
import { ShareLinkRow } from './share-link-row';

interface FormValues {
  expiresAt: string;
}

interface ShareModalProps {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareModal({ noteId, open, onOpenChange }: ShareModalProps) {
  const links = useNoteShares(noteId);
  const create = useCreateShare(noteId);
  const [notice, setNotice] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { expiresAt: '' } });

  const onSubmit = handleSubmit(async ({ expiresAt }) => {
    setNotice(undefined);
    // The picker gives local time without a zone; the API takes an ISO instant.
    const expiry = expiresAt ? new Date(expiresAt) : undefined;
    const invalid = () =>
      setError('expiresAt', { type: 'validate', message: 'Enter a valid date and time.' });
    if (expiry && Number.isNaN(expiry.getTime())) return invalid();
    const body = CreateShareLinkRequestSchema.safeParse(
      expiry ? { expiresAt: expiry.toISOString() } : {},
    );
    if (!body.success) return invalid();
    const rangeError = expiry && expiryRangeError(expiry);
    if (rangeError) return setError('expiresAt', { type: 'validate', message: rangeError });
    try {
      await create.mutateAsync(body.data);
      reset();
    } catch (error) {
      applyServerError(error, setError, ['expiresAt']);
    }
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-40 flex max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl bg-background p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">Share note</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            Anyone with a link can read this note without signing in.
          </Dialog.Description>

          <form
            noValidate
            onSubmit={(event) => void onSubmit(event)}
            className="flex flex-col gap-3"
          >
            <FormField
              id="share-expires-at"
              label="Expires at (optional)"
              type="datetime-local"
              error={errors.expiresAt?.message}
              registration={register('expiresAt')}
            />
            <FormError message={errors.root?.server?.message} />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create link'}
            </Button>
          </form>

          {notice && (
            <p role="alert" className="text-sm text-destructive">
              {notice}
            </p>
          )}

          {links.isPending && <p>Loading links…</p>}
          {links.isError && (
            <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
              Could not load the links.
              <Button variant="outline" size="sm" onClick={() => void links.refetch()}>
                Retry
              </Button>
            </div>
          )}
          {links.data &&
            (links.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No links yet.</p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label="Share links">
                {links.data.items.map((link) => (
                  <ShareLinkRow key={link.id} link={link} onError={setNotice} />
                ))}
              </ul>
            ))}

          <Dialog.Close asChild>
            <Button variant="outline" className="self-end">
              Close
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
