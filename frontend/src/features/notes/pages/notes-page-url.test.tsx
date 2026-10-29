import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { noteListItem, pageOf, tag } from '@/test/fixtures';
import { renderRoute, signInViaRefresh } from '@/test/render';
import { server } from '@/test/server';

const [t1, t2, t3] = [
  tag(1, { name: 'alpha' }),
  tag(2, { name: 'beta' }),
  tag(3, { name: 'gamma' }),
];

const recordNotes = () => {
  const urls: URL[] = [];
  server.use(
    http.get('*/api/v1/tags', () => HttpResponse.json({ items: [t1, t2, t3] })),
    http.get('*/api/v1/notes', ({ request }) => {
      const url = new URL(request.url);
      urls.push(url);
      return HttpResponse.json(
        pageOf([noteListItem(1)], { page: Number(url.searchParams.get('page')), totalPages: 3 }),
      );
    }),
  );
  return urls;
};

describe('NotesPage URL state', () => {
  it('S-AB1011-02: page, sort and tag filter live in the URL', async () => {
    signInViaRefresh();
    const urls = recordNotes();
    const user = userEvent.setup();

    // The URL drives the request and the controls.
    const { router } = renderRoute(
      `/notes?page=2&sortBy=title&sortOrder=asc&tagIds=${t1.id},${t2.id}`,
    );
    await screen.findByText('Note 1');
    const first = urls[0]?.searchParams;
    expect(first?.get('page')).toBe('2');
    expect(first?.get('sortBy')).toBe('title');
    expect(first?.get('sortOrder')).toBe('asc');
    expect(first?.get('tagIds')).toBe(`${t1.id},${t2.id}`);
    expect(screen.getByLabelText('Sort by')).toHaveValue('title');
    expect(screen.getByLabelText('Order')).toHaveValue('asc');
    expect(screen.getByRole('button', { name: 'alpha' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'beta' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'gamma' })).toHaveAttribute('aria-pressed', 'false');

    // Another sort field resets the page.
    await user.selectOptions(screen.getByLabelText('Sort by'), 'createdAt');
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('sortBy')).toBe('createdAt'));
    expect(urls.at(-1)?.searchParams.get('page')).toBe('1');
    expect(router.state.location.search).toContain('sortBy=createdAt');
    expect(router.state.location.search).not.toContain('page=');

    // Selecting a tag adds it to the URL and the request.
    await user.click(screen.getByRole('button', { name: 'gamma' }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('tagIds')).toContain(t3.id));
    expect(urls.at(-1)?.searchParams.get('page')).toBe('1');
    expect(new URLSearchParams(router.state.location.search).get('tagIds')).toBe(
      `${t1.id},${t2.id},${t3.id}`,
    );
    cleanup();

    // Invalid values fall back to the defaults and show no error.
    urls.length = 0;
    renderRoute('/notes?page=abc&sortBy=bogus');
    await screen.findByText('Note 1');
    const fallback = urls[0]?.searchParams;
    expect(fallback?.get('page')).toBe('1');
    expect(fallback?.get('sortBy')).toBe('updatedAt');
    expect(fallback?.get('sortOrder')).toBe('desc');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
