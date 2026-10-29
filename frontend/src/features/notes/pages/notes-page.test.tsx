import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { errorBody, noteListItem, pageOf, tag } from '@/test/fixtures';
import { renderRoute, signInViaRefresh } from '@/test/render';
import { server } from '@/test/server';

describe('NotesPage list states', () => {
  it('S-AB1011-01: list shows notes, loading, empty and error with retry', async () => {
    signInViaRefresh();
    server.use(http.get('*/api/v1/tags', () => HttpResponse.json({ items: [] })));

    // Loading, then the items.
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = noteListItem(1, {
      title: 'Groceries',
      preview: 'Milk and eggs',
      tags: [tag(1, { name: 'work' })],
      updatedAt: '2026-10-02T10:00:00.000Z',
    });
    server.use(
      http.get('*/api/v1/notes', async () => {
        await gate;
        return HttpResponse.json(pageOf([first]));
      }),
    );
    renderRoute('/notes');
    expect(await screen.findByRole('status', { name: 'Loading notes' })).toBeInTheDocument();
    release();

    const card = (await screen.findByText('Groceries')).closest('article');
    expect(card).not.toBeNull();
    const inCard = within(card as HTMLElement);
    expect(inCard.getByText('Milk and eggs')).toBeInTheDocument();
    expect(inCard.getByText('work')).toBeInTheDocument();
    expect(inCard.getByText('Oct 2, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading notes' })).not.toBeInTheDocument();
    cleanup();

    // Empty: a New note action and no card.
    server.use(http.get('*/api/v1/notes', () => HttpResponse.json(pageOf([]))));
    renderRoute('/notes');
    expect(await screen.findByText('No notes yet.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New note' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    cleanup();

    // Error first, then Retry loads the notes.
    let calls = 0;
    server.use(
      http.get('*/api/v1/notes', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(errorBody('INTERNAL_ERROR'), { status: 500 })
          : HttpResponse.json(pageOf([noteListItem(1, { title: 'Back again' })]));
      }),
    );
    renderRoute('/notes');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load your notes');
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Back again')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(calls).toBe(2);
  });
});
