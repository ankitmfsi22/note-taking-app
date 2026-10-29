import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { errorBody } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { routes } from '@/routes/router';

const TOKEN = 'T'.repeat(43);
const URL_PATTERN = `*/api/v1/public/shares/${TOKEN}`;

const renderPublic = () => {
  const router = createMemoryRouter(routes, { initialEntries: [`/s/${TOKEN}`] });
  const view = render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, ...view };
};

const note = (content: unknown) => ({
  title: 'Shared plan',
  content,
  updatedAt: '2026-10-28T09:30:00.000Z',
});

describe('public shared note page', () => {
  it('S-AB1014-04: public page renders the note read-only and safely', async () => {
    let authorization: string | null | undefined;
    server.use(
      http.get(URL_PATTERN, ({ request }) => {
        authorization = request.headers.get('authorization');
        return HttpResponse.json(
          note({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: '<script>alert(1)</script>' },
                  { type: 'text', text: ' bold', marks: [{ type: 'bold' }] },
                ],
              },
            ],
          }),
        );
      }),
    );
    const { container } = renderPublic();

    expect(await screen.findByRole('heading', { name: 'Shared plan' })).toBeInTheDocument();
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    // The script text is literal; nothing was parsed as HTML.
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(authorization).toBeNull();

    // Read-only and anonymous: no editor, no actions, no owner data.
    expect(document.querySelector('[contenteditable="true"], textarea, input')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/ada@example\.com/)).toBeNull();
  });

  it('refuses a link mark that is not http, https or mailto (the shared schema rejects it)', async () => {
    server.use(
      http.get(URL_PATTERN, () =>
        HttpResponse.json(
          note({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'click',
                    marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
                  },
                ],
              },
            ],
          }),
        ),
      ),
    );
    renderPublic();
    expect(await screen.findByText('This link is not available')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('click')).toBeNull();
  });

  it('S-AB1014-05: public link answered 404 SHARE_LINK_NOT_FOUND shows the unavailable state', async () => {
    let requests = 0;
    server.use(
      http.get(URL_PATTERN, () => {
        requests += 1;
        return HttpResponse.json(errorBody('SHARE_LINK_NOT_FOUND', 'Share link not found'), {
          status: 404,
        });
      }),
    );
    renderPublic();
    expect(await screen.findByText('This link is not available')).toBeInTheDocument();
    expect(screen.queryByText('Shared plan')).toBeNull();
    expect(screen.queryByText(/revoked|expired|unknown/i, { selector: 'h1' })).toBeNull();
    // No retry loop.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(requests).toBe(1);
  });

  it('shows the same unavailable state for a network failure', async () => {
    server.use(http.get(URL_PATTERN, () => HttpResponse.error()));
    renderPublic();
    expect(await screen.findByText('This link is not available')).toBeInTheDocument();
  });
});
