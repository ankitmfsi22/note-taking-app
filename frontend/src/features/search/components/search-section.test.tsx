import type { SearchResponse, SearchResultItem } from '@note-app/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/features/auth/session-store';
import { routes } from '@/routes/router';
import { authResponse, errorBody } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';

const item = (
  id: string,
  title: string,
  snippet = 'a <mark>plan</mark> here',
): SearchResultItem => ({
  id,
  title,
  titleHighlight: title,
  snippet,
  tags: [],
  updatedAt: '2026-10-01T10:00:00.000Z',
});

const page = (items: SearchResultItem[], extra: Partial<SearchResponse> = {}): SearchResponse => ({
  items,
  page: 1,
  pageSize: 20,
  total: items.length,
  totalPages: items.length === 0 ? 0 : 1,
  ...extra,
});

const NORMAL_LIST = 'No notes to show yet.';
const LOAD = { timeout: 5000 };

const setup = async (path = '/notes') => {
  useAuthStore.getState().setSession(authResponse());
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const box = await screen.findByRole('searchbox', { name: 'Search notes' }, LOAD);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const debounce = (ms = 300) => act(() => vi.advanceTimersByTimeAsync(ms));
  return { router, box, user, debounce };
};

const recordSearch = (respond: (url: URL) => Response | Promise<Response>) => {
  const urls: URL[] = [];
  server.use(
    http.get('*/api/v1/search', ({ request }) => {
      const url = new URL(request.url);
      urls.push(url);
      return respond(url);
    }),
  );
  return urls;
};

describe('search section', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('S-AB1013-01: typing searches after the debounce and a result opens the note', async () => {
    const urls = recordSearch(() =>
      HttpResponse.json(
        page([
          {
            ...item('01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e5f', 'Budget', 'the <mark>bu</mark>dget'),
            titleHighlight: '<mark>Bu</mark>dget',
          },
        ]),
      ),
    );
    const { router, box, user, debounce } = await setup();
    expect(screen.getByText(NORMAL_LIST)).toBeInTheDocument();

    await user.type(box, 'b');
    await debounce(400);
    expect(urls).toHaveLength(0);

    await user.type(box, 'u');
    await debounce(250);
    expect(urls).toHaveLength(0);
    await debounce(60);

    const link = await screen.findByRole('link', { name: /Budget/ });
    expect(urls).toHaveLength(1);
    expect(urls[0]?.search).toBe('?q=bu&page=1&pageSize=20');
    expect(link.querySelectorAll('mark')).toHaveLength(2);
    expect(within(link).getByText('Bu', { selector: 'mark' })).toBeInTheDocument();
    expect(within(link).getByText('bu', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.queryByText(NORMAL_LIST)).not.toBeInTheDocument();

    await user.click(link);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/notes/01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e5f'),
    );
  });

  it('S-AB1013-02: result text is rendered as text, never as markup', async () => {
    recordSearch(() =>
      HttpResponse.json(
        page([
          item(
            '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e5f',
            'T',
            '&lt;script&gt;alert(1)&lt;/script&gt; <mark>plan</mark> &amp; &quot;q&quot; &#39;x&#39; &lt;mark&gt;fake&lt;/mark&gt;',
          ),
        ]),
      ),
    );
    const { box, user, debounce } = await setup();
    await user.type(box, 'plan');
    await debounce();

    const link = await screen.findByRole('link', { name: /plan/ });
    expect(link.textContent).toContain(
      '<script>alert(1)</script> plan & "q" \'x\' <mark>fake</mark>',
    );
    expect(document.querySelector('script')).toBeNull();
    const marks = link.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent('plan');
  });

  it('S-AB1013-03: results paginate and an empty page shows the no-results state', async () => {
    const urls = recordSearch(async (url) => {
      if (url.searchParams.get('q') === 'nothing') return HttpResponse.json(page([]));
      await delay(50);
      const current = Number(url.searchParams.get('page'));
      return HttpResponse.json(
        page([item(`0193000${current}-0000-7000-8000-000000000000`, `Note on page ${current}`)], {
          page: current,
          total: 25,
          totalPages: 2,
        }),
      );
    });
    const { box, user, debounce } = await setup();
    await user.type(box, 'plan');
    await debounce();
    expect(await screen.findByRole('status')).toHaveTextContent('Searching');
    expect(await screen.findByText('Note on page 1')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(await screen.findByText('Note on page 2')).toBeInTheDocument();
    expect(urls.at(-1)?.searchParams.get('page')).toBe('2');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('Note on page 1')).toBeInTheDocument();

    await user.clear(box);
    await user.type(box, 'nothing');
    await debounce();
    expect(await screen.findByText('No results for "nothing".')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('S-AB1013-04: clearing the box returns to the normal notes list', async () => {
    recordSearch(async () => {
      await delay(100);
      return HttpResponse.json(page([item('01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e5f', 'Old result')]));
    });
    const { router, box, user, debounce } = await setup('/notes?q=plan');
    expect(box).toHaveValue('plan');

    // Clear while the request for the old query is still in flight.
    await user.clear(box);
    expect(screen.getByText(NORMAL_LIST)).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    await debounce(400);
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.queryByText('Old result')).not.toBeInTheDocument();
    expect(screen.getByText(NORMAL_LIST)).toBeInTheDocument();

    // Fewer than two characters also returns to the list.
    await user.type(box, 'p');
    await debounce();
    expect(screen.getByText(NORMAL_LIST)).toBeInTheDocument();
  });

  it('S-AB1013-05: a 400 or 500 shows an error state with retry and operator text is sent plain', async () => {
    const typed = 'a & !(b:*)';
    let call = 0;
    const urls = recordSearch(() => {
      call += 1;
      if (call === 1) {
        return HttpResponse.json(errorBody('VALIDATION_ERROR', 'Query is not valid'), {
          status: 400,
        });
      }
      if (call === 2) {
        return HttpResponse.json(errorBody('INTERNAL_ERROR', 'Something went wrong'), {
          status: 500,
        });
      }
      return HttpResponse.json(page([item('01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e5f', 'Recovered')]));
    });
    const { box, user, debounce } = await setup();
    await user.type(box, typed);
    await debounce();

    expect(await screen.findByRole('alert')).toHaveTextContent('Query is not valid');
    expect(box).toHaveValue(typed);
    expect(urls[0]?.searchParams.get('q')).toBe(typed);
    expect(urls[0]?.search).toContain('q=a+%26+%21%28b%3A*%29');

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(box).toHaveValue(typed);

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Recovered')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('S-AB1013-06: a 401 refreshes once and a failed refresh sends the user to login', async () => {
    let searches = 0;
    let refreshes = 0;
    server.use(
      http.get('*/api/v1/search', ({ request }) => {
        searches += 1;
        const token = request.headers.get('authorization');
        if (token === 'Bearer access-2') {
          return HttpResponse.json(
            page([item('01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e5f', 'After refresh')]),
          );
        }
        return HttpResponse.json(errorBody('UNAUTHORIZED', 'Sign in again'), { status: 401 });
      }),
      http.post('*/api/v1/auth/refresh', () => {
        refreshes += 1;
        return refreshes === 1
          ? HttpResponse.json(authResponse('access-2'))
          : HttpResponse.json(errorBody('INVALID_REFRESH_TOKEN'), { status: 401 });
      }),
    );
    const { router, box, user, debounce } = await setup();
    await user.type(box, 'plan');
    await debounce();
    expect(await screen.findByText('After refresh')).toBeInTheDocument();
    expect(searches).toBe(2);
    expect(refreshes).toBe(1);

    // The token is now stale for the server, so the next search is rejected again.
    useAuthStore.getState().setSession(authResponse('access-stale'));
    await user.clear(box);
    await user.type(box, 'other');
    await debounce();

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(refreshes).toBe(2);
    expect(useAuthStore.getState().status).toBe('guest');
    expect(screen.queryByText('After refresh')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert', { name: /search/i })).not.toBeInTheDocument();
  });
});
