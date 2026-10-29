import type { ShareLinkResponse } from '@note-app/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { errorBody, shareLink } from '@/test/fixtures';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { ShareButton } from './share-button';
import { ShareModal } from './share-modal';

const NOTE_ID = '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e99';
const SHARES = '*/api/v1/notes/:noteId/shares';

const pad = (n: number) => String(n).padStart(2, '0');
const localInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const daysFromNow = (days: number) => localInput(new Date(Date.now() + days * 86_400_000));

// An in-memory API for one note: POST adds a link, GET lists them, revoke flips the status.
const useShareApi = (initial: ShareLinkResponse[] = []) => {
  const links = [...initial];
  const calls = { create: [] as unknown[], revoke: [] as string[] };
  let next = initial.length;
  server.use(
    http.get(SHARES, () => HttpResponse.json({ items: links })),
    http.post(SHARES, async ({ request }) => {
      const body = (await request.json()) as { expiresAt?: string };
      calls.create.push(body);
      next += 1;
      const link = shareLink({
        id: `01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e${pad(next)}`,
        token: String(next).repeat(43),
        expiresAt: body.expiresAt ?? null,
      });
      links.push(link);
      return HttpResponse.json(link, { status: 201 });
    }),
    http.post('*/api/v1/shares/:shareId/revoke', ({ params }) => {
      calls.revoke.push(String(params['shareId']));
      const link = links.find((item) => item.id === params['shareId']);
      if (link) {
        link.status = 'revoked';
        link.revokedAt = '2026-10-29T12:00:00.000Z';
      }
      return HttpResponse.json(link);
    }),
  );
  return { links, calls };
};

const renderModal = () =>
  renderWithQuery(<ShareModal noteId={NOTE_ID} open onOpenChange={() => undefined} />);

const setExpiry = (value: string) =>
  fireEvent.change(screen.getByLabelText('Expires at (optional)'), { target: { value } });

describe('ShareModal', () => {
  it('S-AB1014-01: create links with and without expiry, list and copy them, reject a past expiry', async () => {
    const api = useShareApi();
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderModal();
    expect(await screen.findByText('No links yet.')).toBeInTheDocument();

    // A past expiry never reaches the server.
    setExpiry(daysFromNow(-1));
    await user.click(screen.getByRole('button', { name: 'Create link' }));
    expect(await screen.findByText('Expiry must be in the future.')).toBeInTheDocument();
    expect(api.calls.create).toHaveLength(0);

    // No expiry, then 7 days ahead.
    setExpiry('');
    await user.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() => expect(api.calls.create).toEqual([{}]));
    setExpiry(daysFromNow(7));
    await user.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() => expect(api.calls.create).toHaveLength(2));

    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(within(row).getByText('active')).toBeInTheDocument();
      expect(within(row).getByText('Views: 0')).toBeInTheDocument();
    }
    expect(within(rows[0] as HTMLElement).getByText('Expires: Never')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).queryByText('Expires: Never')).toBeNull();

    await user.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/${'1'.repeat(43)}`);
    expect(await screen.findByText('Copied')).toBeInTheDocument();

    // A server-side range error lands on the expiry field.
    server.use(
      http.post(SHARES, () =>
        HttpResponse.json(
          errorBody('VALIDATION_ERROR', 'Invalid input', [
            { field: 'expiresAt', message: 'Expiry must be within 365 days' },
          ]),
          { status: 400 },
        ),
      ),
    );
    setExpiry(daysFromNow(30));
    await user.click(screen.getByRole('button', { name: 'Create link' }));
    expect(await screen.findByText('Expiry must be within 365 days')).toBeInTheDocument();
  });

  it('S-AB1014-02: revoke asks for confirmation and leaves other links active', async () => {
    const [a, b] = [
      shareLink({ id: '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e01', token: 'a'.repeat(43) }),
      shareLink({ id: '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e02', token: 'b'.repeat(43) }),
    ];
    const api = useShareApi([a, b]);
    const user = userEvent.setup();
    renderModal();
    const revokeFirst = async () =>
      user.click((await screen.findAllByRole('button', { name: 'Revoke' }))[0] as HTMLElement);

    // Cancel: nothing is sent.
    await revokeFirst();
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(api.calls.revoke).toEqual([]);
    expect(screen.getAllByText('active')).toHaveLength(2);

    // Confirm: A is revoked, B stays active.
    await revokeFirst();
    await user.click(await screen.findByRole('button', { name: 'Revoke link' }));
    await waitFor(() => expect(api.calls.revoke).toEqual([a.id]));
    await waitFor(() => expect(screen.getByText('revoked')).toBeInTheDocument());
    expect(screen.getAllByText('active')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1);

    // The server no longer knows B: a not-found message, and the list is refetched.
    let listed = 0;
    server.use(
      http.get(SHARES, () => {
        listed += 1;
        return HttpResponse.json({ items: [{ ...a, status: 'revoked' }] });
      }),
      http.post('*/api/v1/shares/:shareId/revoke', () =>
        HttpResponse.json(errorBody('SHARE_LINK_NOT_FOUND', 'Share link not found'), {
          status: 404,
        }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await user.click(await screen.findByRole('button', { name: 'Revoke link' }));
    expect(await screen.findByText('This link no longer exists.')).toBeInTheDocument();
    await waitFor(() => expect(listed).toBeGreaterThan(0));
  });

  it('shows a retryable error when the links cannot be loaded', async () => {
    server.use(
      http.get(SHARES, () => HttpResponse.json(errorBody('INTERNAL_ERROR'), { status: 500 })),
    );
    const user = userEvent.setup();
    renderModal();
    expect(await screen.findByText('Could not load the links.')).toBeInTheDocument();
    useShareApi([shareLink()]);
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Views: 0')).toBeInTheDocument();
  });

  it('shows a generic message when revoking fails and copy failures are reported', async () => {
    useShareApi([shareLink()]);
    server.use(
      http.post('*/api/v1/shares/:shareId/revoke', () =>
        HttpResponse.json(errorBody('INTERNAL_ERROR'), { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    renderModal();
    await user.click(await screen.findByRole('button', { name: 'Copy' }));
    expect(await screen.findByText('Could not copy')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await user.click(await screen.findByRole('button', { name: 'Revoke link' }));
    expect(await screen.findByText(/Could not revoke the link/)).toBeInTheDocument();
  });

  it('rejects an expiry more than 365 days away and does not list revoked links as copyable', async () => {
    const api = useShareApi([
      shareLink({ status: 'revoked', revokedAt: '2026-10-29T11:00:00.000Z' }),
    ]);
    const user = userEvent.setup();
    renderModal();
    expect(await screen.findByText('revoked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    setExpiry(daysFromNow(400));
    await user.click(screen.getByRole('button', { name: 'Create link' }));
    expect(await screen.findByText('Expiry must be within 365 days.')).toBeInTheDocument();
    expect(api.calls.create).toHaveLength(0);
  });

  it('the Share button opens the modal and Close dismisses it', async () => {
    useShareApi();
    const user = userEvent.setup();
    renderWithQuery(<ShareButton noteId={NOTE_ID} />);
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByRole('dialog', { name: 'Share note' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
