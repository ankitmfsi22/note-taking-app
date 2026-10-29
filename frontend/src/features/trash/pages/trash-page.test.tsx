import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { errorBody, noteListItem, pageOf, trashItem, uuid } from '@/test/fixtures';
import { renderRoute, signInViaRefresh } from '@/test/render';
import { server } from '@/test/server';

const DAY = 86_400_000;
// The page reads the real clock, so rows are placed relative to it instead of faking timers.
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

describe('TrashPage', () => {
  it('S-AB1011-05: trash lists notes with days remaining and restores them', async () => {
    signInViaRefresh();
    const user = userEvent.setup();

    // Loading, then a note deleted 25 days ago.
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let trash = [trashItem(1, { title: 'Old note', deletedAt: daysAgo(25) })];
    let trashCalls = 0;
    server.use(
      http.get('*/api/v1/notes/trash', async () => {
        trashCalls += 1;
        if (trashCalls === 1) await gate;
        return HttpResponse.json(pageOf(trash));
      }),
    );
    renderRoute('/notes/trash');
    expect(await screen.findByRole('status', { name: 'Loading trash' })).toBeInTheDocument();
    release();
    const row = (await screen.findByText('Old note')).closest('li') as HTMLElement;
    expect(within(row).getByText('5 days left')).toBeInTheDocument();
    expect(within(row).getByText(/Deleted Oct \d+, 2026/)).toBeInTheDocument();
    cleanup();

    // Empty.
    trash = [];
    renderRoute('/notes/trash');
    expect(await screen.findByText('Trash is empty.')).toBeInTheDocument();
    cleanup();

    // Error, then Retry.
    let failing = true;
    server.use(
      http.get('*/api/v1/notes/trash', () =>
        failing
          ? HttpResponse.json(errorBody('INTERNAL_ERROR'), { status: 500 })
          : HttpResponse.json(pageOf([trashItem(1, { title: 'Old note' })])),
      ),
    );
    renderRoute('/notes/trash');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the trash');
    failing = false;
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Old note')).toBeInTheDocument();
    cleanup();

    // Restore 200: the row goes and the normal list is reloaded.
    trash = [trashItem(1, { title: 'Old note' }), trashItem(2, { title: 'Other note' })];
    server.use(
      http.get('*/api/v1/notes/trash', () => HttpResponse.json(pageOf(trash))),
      http.post('*/api/v1/notes/:noteId/restore', ({ params }) => {
        trash = trash.filter((item) => item.id !== params['noteId']);
        return HttpResponse.json({
          id: uuid(1),
          title: 'Old note',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
          tags: [],
          latestVersion: 1,
          createdAt: daysAgo(40),
          updatedAt: daysAgo(40),
        });
      }),
      http.get('*/api/v1/notes', () =>
        HttpResponse.json(pageOf([noteListItem(1, { title: 'Old note' })])),
      ),
      http.get('*/api/v1/tags', () => HttpResponse.json({ items: [] })),
    );
    const restored = renderRoute('/notes/trash');
    const invalidate = vi.spyOn(restored.queryClient, 'invalidateQueries');
    await screen.findByText('Other note');
    await user.click(screen.getByRole('button', { name: 'Restore Old note' }));
    await waitFor(() => expect(screen.queryByText('Old note')).not.toBeInTheDocument());
    expect(screen.getByText('Other note')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notes', 'list'] });
    await restored.router.navigate('/notes');
    expect(await screen.findByText('Old note')).toBeInTheDocument();
    cleanup();

    // Restore 404: a clear message, and the trash list is reloaded.
    trash = [trashItem(3, { title: 'Gone note' })];
    let reloads = 0;
    server.use(
      http.get('*/api/v1/notes/trash', () => {
        reloads += 1;
        return HttpResponse.json(pageOf(trash));
      }),
      http.post('*/api/v1/notes/:noteId/restore', () =>
        HttpResponse.json(errorBody('NOTE_NOT_FOUND', 'Note not found'), { status: 404 }),
      ),
    );
    renderRoute('/notes/trash');
    await screen.findByText('Gone note');
    const before = reloads;
    await user.click(screen.getByRole('button', { name: 'Restore Gone note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This note can no longer be restored.',
    );
    await waitFor(() => expect(reloads).toBeGreaterThan(before));
  });
});
