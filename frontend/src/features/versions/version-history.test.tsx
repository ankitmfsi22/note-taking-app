import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Component } from '@/features/editor/pages/note-editor-page';
import { routes } from '@/routes/router';
import { NOTE_ID, getEditor, noteFixture, renderEditorRoute, signIn } from '@/test/editor-fixtures';
import { errorBody } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { docOf, versionDetail, versionPage } from '@/test/version-fixtures';

const NOTE_URL = `*/api/v1/notes/${NOTE_ID}`;
const LIST_URL = `${NOTE_URL}/versions`;
const LOAD = { timeout: 10_000 };

// The editor chunk pulls in TipTap; loading it cold can take several seconds under coverage.
beforeAll(async () => {
  await import('@/features/editor/pages/note-editor-page');
}, 60_000);

const baseHandlers = () =>
  server.use(
    http.get(NOTE_URL, () => HttpResponse.json(noteFixture({ latestVersion: 2 }))),
    http.get('*/api/v1/tags', () => HttpResponse.json({ items: [] })),
    http.get(`${LIST_URL}/:n`, ({ params }) =>
      HttpResponse.json(versionDetail(Number(params['n']))),
    ),
  );

const openDrawerAndRestoreVersion1 = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Version history' }));
  await user.click(await screen.findByRole('button', { name: /Version 1/ }, LOAD));
  await user.click(await screen.findByRole('button', { name: 'Restore this version' }, LOAD));
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Restore' }),
  );
};

describe('version history in the editor', () => {
  it('S-AB1015-02: restore flushes pending edits first then updates the editor and list', async () => {
    const user = userEvent.setup();
    signIn();
    baseHandlers();
    const calls: string[] = [];
    let restored = false;
    server.use(
      http.patch(NOTE_URL, async ({ request }) => {
        calls.push('flush');
        const body = (await request.json()) as { title?: string; content?: unknown };
        return HttpResponse.json({
          ...noteFixture({ latestVersion: 3 }),
          ...(body.content ? { content: body.content } : {}),
        });
      }),
      http.get(LIST_URL, () =>
        HttpResponse.json(restored ? versionPage([4, 3, 2, 1]) : versionPage([2, 1])),
      ),
      http.post(`${LIST_URL}/1/restore`, () => {
        calls.push('restore');
        restored = true;
        return HttpResponse.json(
          noteFixture({
            title: 'Title v1',
            content: docOf('Content of version 1'),
            latestVersion: 4,
          }),
        );
      }),
    );
    renderEditorRoute({ Component });
    const editor = await getEditor();
    await screen.findByDisplayValue('My note');

    act(() => {
      editor.commands.insertContent('unsaved edit');
    });
    await openDrawerAndRestoreVersion1(user);

    expect(
      await screen.findByText(/was restored as version 4/, undefined, LOAD),
    ).toBeInTheDocument();
    // The pending edit is saved first; msw saw the PATCH before the restore request.
    expect(calls).toEqual(['flush', 'restore']);
    expect(JSON.stringify(editor.getJSON())).toContain('Content of version 1');
    expect(JSON.stringify(editor.getJSON())).not.toContain('unsaved edit');
    expect(screen.getByLabelText('Title')).toHaveValue('Title v1');
    // The refetched list shows the new version on top.
    const list = await screen.findByRole('list', { name: 'Versions' }, LOAD);
    await vi.waitFor(() =>
      expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Version 4'),
    );
  });

  it('S-AB1015-05: a failed flush blocks the restore', async () => {
    const user = userEvent.setup();
    signIn();
    baseHandlers();
    let restoreCalls = 0;
    server.use(
      http.patch(NOTE_URL, () =>
        HttpResponse.json(errorBody('VALIDATION_ERROR', 'Invalid note'), { status: 400 }),
      ),
      http.get(LIST_URL, () => HttpResponse.json(versionPage([2, 1]))),
      http.post(`${LIST_URL}/1/restore`, () => {
        restoreCalls += 1;
        return HttpResponse.json(noteFixture());
      }),
    );
    renderEditorRoute({ Component });
    const editor = await getEditor();
    await screen.findByDisplayValue('My note');

    act(() => {
      editor.commands.insertContent('unsaved edit');
    });
    await openDrawerAndRestoreVersion1(user);

    expect(
      await screen.findByText(
        'Your unsaved changes could not be saved, so the version was not restored.',
        undefined,
        LOAD,
      ),
    ).toBeInTheDocument();
    expect(restoreCalls).toBe(0);
    expect(JSON.stringify(editor.getJSON())).toContain('unsaved edit');
    expect(screen.getByLabelText('Title')).toHaveValue('My note');
  });

  it('S-AB1015-06: an expired session is refreshed once then redirected to login', async () => {
    const user = userEvent.setup();
    signIn();
    baseHandlers();
    let refreshCalls = 0;
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json(errorBody('UNAUTHORIZED', 'Sign in again'), { status: 401 }),
      ),
      http.post('*/api/v1/auth/refresh', () => {
        refreshCalls += 1;
        return HttpResponse.json(errorBody('INVALID_REFRESH_TOKEN', 'Session expired'), {
          status: 401,
        });
      }),
    );
    const router = createMemoryRouter(routes, { initialEntries: [`/notes/${NOTE_ID}`] });
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Version history' }, LOAD));

    expect(await screen.findByRole('heading', { name: 'Sign in' }, LOAD)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(refreshCalls).toBe(1);
  });
});
