import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { errorBody, tag } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { TagManager } from './tag-manager';

describe('TagManager', () => {
  it('S-AB1011-04: tag manager validates and manages tags', async () => {
    const user = userEvent.setup();
    let tags = [tag(1, { name: 'work', color: '#112233', noteCount: 3 }), tag(2, { name: 'home' })];
    const sent: { method: string; body: unknown }[] = [];
    let listCalls = 0;
    let createStatus = 409;
    server.use(
      http.get('*/api/v1/tags', () => {
        listCalls += 1;
        return HttpResponse.json({ items: tags });
      }),
      http.post('*/api/v1/tags', async ({ request }) => {
        const body = (await request.json()) as { name: string; color?: string };
        sent.push({ method: 'POST', body });
        if (createStatus === 409) {
          return HttpResponse.json(errorBody('TAG_NAME_TAKEN', 'Tag name taken'), { status: 409 });
        }
        const created = tag(3, { name: body.name, color: body.color ?? '#6B7280' });
        tags = [...tags, created];
        return HttpResponse.json(created, { status: 201 });
      }),
      http.patch('*/api/v1/tags/:tagId', async ({ request, params }) => {
        const body = (await request.json()) as { name?: string; color?: string };
        sent.push({ method: 'PATCH', body });
        tags = tags.map((item) => (item.id === params['tagId'] ? { ...item, ...body } : item));
        return HttpResponse.json(tags.find((item) => item.id === params['tagId']));
      }),
      http.delete('*/api/v1/tags/:tagId', ({ params }) => {
        sent.push({ method: 'DELETE', body: params['tagId'] });
        tags = tags.filter((item) => item.id !== params['tagId']);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <QueryClientProvider client={queryClient}>
        <TagManager />
      </QueryClientProvider>,
    );

    // Each tag shows its name, colour and note count.
    const work = (await screen.findByText('work')).closest('li') as HTMLElement;
    expect(within(work).getByText('3 notes')).toBeInTheDocument();
    expect(within(work).getByTitle('#112233')).toBeInTheDocument();
    expect(screen.getByText('0 notes')).toBeInTheDocument();

    // Empty and 31-character names are rejected before any request.
    const name = screen.getByLabelText('New tag name');
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    await user.type(name, 'x'.repeat(31));
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    expect(name).toHaveValue('x'.repeat(31));
    expect(sent).toEqual([]);

    // A taken name shows on the field and keeps the value.
    await user.clear(name);
    await user.type(name, 'work');
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    expect(await screen.findByText('A tag with this name already exists.')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveValue('work');
    expect(sent).toHaveLength(1);

    // Create, rename, recolour and delete each reload the tags and the note list.
    createStatus = 201;
    await user.clear(name);
    await user.type(name, 'ideas');
    const before = listCalls;
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    expect(await screen.findByText('ideas')).toBeInTheDocument();
    expect(listCalls).toBeGreaterThan(before);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tags'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notes', 'list'] });

    await user.click(screen.getByRole('button', { name: 'Edit home' }));
    const rename = screen.getByLabelText('Tag name');
    await user.clear(rename);
    await user.type(rename, 'house');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('house')).toBeInTheDocument();
    expect(sent.at(-1)).toMatchObject({ method: 'PATCH', body: { name: 'house' } });

    await user.click(screen.getByRole('button', { name: 'Edit house' }));
    fireEvent.change(screen.getByLabelText('Tag color'), { target: { value: '#ff0000' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTitle('#ff0000')).toBeInTheDocument());
    expect(sent.at(-1)).toMatchObject({ method: 'PATCH', body: { color: '#ff0000' } });

    const afterEdits = listCalls;
    await user.click(screen.getByRole('button', { name: 'Delete house' }));
    await user.click(await screen.findByRole('button', { name: 'Delete tag' }));
    await waitFor(() => expect(screen.queryByText('house')).not.toBeInTheDocument());
    expect(sent.at(-1)).toMatchObject({ method: 'DELETE' });
    expect(listCalls).toBeGreaterThan(afterEdits);
  });
});
