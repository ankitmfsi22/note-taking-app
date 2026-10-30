import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { noteListItem, pageOf, uuid } from '@/test/fixtures';
import { renderRoute, signInViaRefresh } from '@/test/render';
import { server } from '@/test/server';

const created = {
  id: uuid(900),
  title: 'Untitled note',
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  tags: [],
  latestVersion: 1,
  createdAt: '2026-10-29T10:00:00.000Z',
  updatedAt: '2026-10-29T10:00:00.000Z',
};

describe('NotesPage actions', () => {
  it('S-AB1011-03: new note opens the editor, delete asks first', async () => {
    signInViaRefresh();
    const user = userEvent.setup();
    let notes = [noteListItem(1, { title: 'Keep me' }), noteListItem(2, { title: 'Drop me' })];
    const deletes: string[] = [];
    server.use(
      http.get('*/api/v1/tags', () => HttpResponse.json({ items: [] })),
      http.get('*/api/v1/notes', () => HttpResponse.json(pageOf(notes))),
      http.post('*/api/v1/notes', () => HttpResponse.json(created, { status: 201 })),
      http.delete('*/api/v1/notes/:noteId', ({ params }) => {
        deletes.push(String(params['noteId']));
        notes = notes.filter((note) => note.id !== params['noteId']);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderRoute('/notes');
    await screen.findByText('Drop me');

    // Delete asks first and sends nothing until confirmed.
    await user.click(screen.getByRole('button', { name: 'Delete Drop me' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('You can restore it from Trash for 30 days.');
    expect(deletes).toEqual([]);

    // Cancel keeps the note.
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deletes).toEqual([]);
    expect(screen.getByText('Drop me')).toBeInTheDocument();

    // Confirm sends DELETE and the list reloads without the note.
    await user.click(screen.getByRole('button', { name: 'Delete Drop me' }));
    await user.click(await screen.findByRole('button', { name: 'Delete note' }));
    await waitFor(() => expect(screen.queryByText('Drop me')).not.toBeInTheDocument());
    expect(deletes).toEqual([uuid(2)]);
    expect(screen.getByText('Keep me')).toBeInTheDocument();

    // New note posts, then opens /notes/<id> (the editor route arrives with AB-1012).
    await user.click(screen.getByRole('button', { name: 'New note' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/notes/${created.id}`));
  });

  // Small fix (no spec scenario): the card title is the way back into the editor.
  it('note card title links to the editor and Delete does not navigate', async () => {
    signInViaRefresh();
    const user = userEvent.setup();
    server.use(
      http.get('*/api/v1/tags', () => HttpResponse.json({ items: [] })),
      http.get('*/api/v1/notes', () =>
        HttpResponse.json(pageOf([noteListItem(1, { title: 'Reopen me' })])),
      ),
    );
    const { router } = renderRoute('/notes');

    const link = await screen.findByRole('link', { name: 'Reopen me' });
    expect(link).toHaveAttribute('href', `/notes/${uuid(1)}`);

    await user.click(screen.getByRole('button', { name: 'Delete Reopen me' }));
    expect(router.state.location.pathname).toBe('/notes');
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await user.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/notes/${uuid(1)}`));
  });
});
