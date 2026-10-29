import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { NOTE_ID, signIn } from '@/test/editor-fixtures';
import { errorBody } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { versionDetail, versionPage } from '@/test/version-fixtures';
import { VersionDrawer } from './version-drawer';

const LIST_URL = `*/api/v1/notes/${NOTE_ID}/versions`;
const restoreUrl = (n: number) => `${LIST_URL}/${n}/restore`;
const LOAD = { timeout: 10_000 };

const renderDrawer = (latestVersion: number, onRestored = vi.fn()) => {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <VersionDrawer
        noteId={NOTE_ID}
        latestVersion={latestVersion}
        open
        onOpenChange={() => undefined}
        onRestored={onRestored}
      />
    </QueryClientProvider>,
  );
  return onRestored;
};

const useDetails = () =>
  server.use(
    http.get(`${LIST_URL}/:n`, ({ params }) =>
      HttpResponse.json(versionDetail(Number(params['n']))),
    ),
  );

describe('version drawer', () => {
  it('S-AB1015-01: the drawer lists versions and shows a selected one read-only', async () => {
    const user = userEvent.setup();
    signIn();
    server.use(http.get(LIST_URL, () => HttpResponse.json(versionPage([3, 2, 1]))));
    useDetails();
    renderDrawer(3);

    const list = await screen.findByRole('list', { name: 'Versions' }, LOAD);
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('span')?.textContent)).toEqual([
      'Version 3',
      'Version 2',
      'Version 1',
    ]);
    for (const item of items) expect(item.querySelector('time')).not.toBeNull();

    await user.click(within(items[1]!).getByRole('button'));
    expect(await screen.findByRole('heading', { name: 'Title v2' }, LOAD)).toBeInTheDocument();
    expect(await screen.findByText('Content of version 2', undefined, LOAD)).toBeInTheDocument();
    const preview = screen.getByLabelText('Version content');
    expect(preview.querySelector('[contenteditable="true"]')).toBeNull();
    expect(preview).toHaveAttribute('contenteditable', 'false');
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();
  });

  it('S-AB1015-03: restoring the latest version is blocked, also when the server answers 409', async () => {
    const user = userEvent.setup();
    signIn();
    server.use(http.get(LIST_URL, () => HttpResponse.json(versionPage([3, 2, 1]))));
    useDetails();
    const first = renderDrawer(3);

    await user.click(await screen.findByRole('button', { name: /Version 3/ }, LOAD));
    const blocked = await screen.findByRole('button', { name: 'Restore this version' }, LOAD);
    expect(blocked).toBeDisabled();
    expect(screen.getByText('This is already the current version.')).toBeInTheDocument();
    expect(first).not.toHaveBeenCalled();

    cleanup();
    let listCalls = 0;
    server.use(
      http.get(LIST_URL, () => {
        listCalls += 1;
        return HttpResponse.json(versionPage([3, 2, 1]));
      }),
      http.post(restoreUrl(2), () =>
        HttpResponse.json(errorBody('VERSION_ALREADY_CURRENT', 'Already current'), { status: 409 }),
      ),
    );
    // A stale latestVersion lets the button through; the server answer is shown the same way.
    const second = renderDrawer(5);
    await user.click(await screen.findByRole('button', { name: /Version 2/ }, LOAD));
    await user.click(await screen.findByRole('button', { name: 'Restore this version' }, LOAD));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Restore' }),
    );

    expect(
      await within(await screen.findByRole('alert', undefined, LOAD)).findByText(
        'This is already the current version.',
      ),
    ).toBeInTheDocument();
    expect(second).not.toHaveBeenCalled();
    expect(listCalls).toBe(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('S-AB1015-04: the drawer shows loading, empty, paging and error states', async () => {
    const user = userEvent.setup();
    signIn();

    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(LIST_URL, async () => {
        await gate;
        return HttpResponse.json(versionPage([]));
      }),
    );
    renderDrawer(1);
    expect(await screen.findByText('Loading versions...', undefined, LOAD)).toBeInTheDocument();
    release();
    expect(await screen.findByText('No versions yet.', undefined, LOAD)).toBeInTheDocument();

    cleanup();
    server.use(
      http.get(LIST_URL, ({ request }) =>
        new URL(request.url).searchParams.get('page') === '2'
          ? HttpResponse.json(versionPage([1], 2, 2, 3))
          : HttpResponse.json(versionPage([3, 2], 1, 2, 3)),
      ),
    );
    useDetails();
    const onRestored = renderDrawer(3);
    expect(await screen.findAllByRole('listitem', undefined, LOAD)).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('button', { name: /Version 1/ }, LOAD)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();

    const restore = async (n: number) => {
      await user.click(screen.getByRole('button', { name: new RegExp(`Version ${n}`) }));
      await user.click(await screen.findByRole('button', { name: 'Restore this version' }, LOAD));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Restore' }),
      );
    };
    server.use(
      http.post(restoreUrl(2), () =>
        HttpResponse.json(errorBody('VERSION_NOT_FOUND', 'Version not found'), { status: 404 }),
      ),
      http.post(restoreUrl(1), () =>
        HttpResponse.json(errorBody('INTERNAL_ERROR', 'Server error'), { status: 500 }),
      ),
    );
    await restore(2);
    expect(await screen.findByRole('alert', undefined, LOAD)).toHaveTextContent(
      'Version not found',
    );
    await restore(1);
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server error'));
    expect(onRestored).not.toHaveBeenCalled();
  });
});
