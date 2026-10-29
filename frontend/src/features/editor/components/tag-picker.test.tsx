import type { SetNoteTagsRequest } from '@note-app/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { Toaster } from '@/app/toaster';
import { NOTE_ID, noteFixture, signIn, tagFixture } from '@/test/editor-fixtures';
import { errorBody } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { useNoteQuery } from '../queries';
import { TagPicker } from './tag-picker';

const tags = [tagFixture(1), tagFixture(2), tagFixture(3)];

function Host() {
  const query = useNoteQuery(NOTE_ID);
  return query.data ? <TagPicker noteId={NOTE_ID} tags={query.data.tags} /> : null;
}

describe('TagPicker', () => {
  it('S-AB1012-02: tags are assigned and removed, and a failed change restores the tags', async () => {
    signIn();
    const user = userEvent.setup();
    const bodies: SetNoteTagsRequest[] = [];
    let failNext = false;
    let current = [tags[0]!];
    server.use(
      http.get(`*/api/v1/notes/${NOTE_ID}`, () =>
        HttpResponse.json(noteFixture({ tags: current })),
      ),
      http.get('*/api/v1/tags', () =>
        HttpResponse.json({ items: tags.map((tag) => ({ ...tag, noteCount: 1 })) }),
      ),
      http.put(`*/api/v1/notes/${NOTE_ID}/tags`, async ({ request }) => {
        const body = (await request.json()) as SetNoteTagsRequest;
        bodies.push(body);
        if (failNext) {
          return HttpResponse.json(errorBody('TAG_NOT_FOUND', 'One of the tags no longer exists'), {
            status: 404,
          });
        }
        current = tags.filter((tag) => body.tagIds.includes(tag.id));
        return HttpResponse.json(noteFixture({ tags: current }));
      }),
    );
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Host />
        <Toaster />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('tag-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    await user.click(await screen.findByRole('button', { name: 'tag-2' }));
    expect(await screen.findByRole('button', { name: 'Remove tag-2' })).toBeInTheDocument();
    expect(bodies[0]?.tagIds).toEqual([tags[0]!.id, tags[1]!.id]);

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Remove tag-1' }));
    await screen.findByText('tag-2');
    expect(screen.queryByRole('button', { name: 'Remove tag-1' })).not.toBeInTheDocument();
    expect(bodies[1]?.tagIds).toEqual([tags[1]!.id]);

    failNext = true;
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    await user.click(await screen.findByRole('button', { name: 'tag-3' }));
    expect(bodies[2]?.tagIds).toEqual([tags[1]!.id, tags[2]!.id]);
    expect(await screen.findByText('One of the tags no longer exists')).toBeInTheDocument();
    const remaining = screen.getAllByRole('button', { name: /^Remove tag-/ });
    expect(remaining.map((button) => button.getAttribute('aria-label'))).toEqual(['Remove tag-2']);
    expect(within(document.body).queryByRole('button', { name: 'Remove tag-3' })).toBeNull();
  });
});
