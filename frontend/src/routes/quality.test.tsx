import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/features/auth/session-store';
import { axeViolations } from '@/test/axe';
import { noteListItem, pageOf, tag, trashItem } from '@/test/fixtures';
import { renderRoute, signInViaRefresh } from '@/test/render';
import { server } from '@/test/server';

const LOAD = { timeout: 10_000 };
const TOKEN = 'T'.repeat(43);

const metaContent = (name: string) =>
  document.head.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;

const waitForTitle = (title: string) =>
  waitFor(() => expect(document.title).toBe(`${title} | Note App`), LOAD);

const notesApi = (items = [noteListItem(1, { title: 'Groceries' })]) =>
  server.use(
    http.get('*/api/v1/notes', () => HttpResponse.json(pageOf(items))),
    http.get('*/api/v1/tags', () => HttpResponse.json({ items: [tag(1, { name: 'work' })] })),
  );

describe('route metadata', () => {
  it('S-AB1016-15: public routes have distinct titles and stay indexable', async () => {
    const seen = new Map<string, string | null>();
    for (const [path, title] of [
      ['/login', 'Sign in'],
      ['/register', 'Create account'],
      ['/forgot-password', 'Forgot your password'],
    ] as const) {
      renderRoute(path);
      await waitForTitle(title);
      expect(metaContent('robots')).toBeNull();
      seen.set(title, metaContent('description'));
      cleanup();
    }
    const descriptions = [...seen.values()];
    expect(descriptions.every(Boolean)).toBe(true);
    expect(new Set(descriptions).size).toBe(3);
    expect(document.head.querySelectorAll('title')).toHaveLength(1);
  });

  it('S-AB1016-16: private routes are noindex', async () => {
    signInViaRefresh();
    notesApi();
    server.use(
      http.get('*/api/v1/notes/trash', () => HttpResponse.json(pageOf([trashItem(1)]))),
      http.get('*/api/v1/shares', () => HttpResponse.json(pageOf([]))),
      http.get(`*/api/v1/public/shares/${TOKEN}`, () =>
        HttpResponse.json({
          title: 'Shared plan',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
          updatedAt: '2026-10-28T09:30:00.000Z',
        }),
      ),
    );
    const descriptions = new Set<string | null>();
    for (const [path, title] of [
      ['/notes', 'Your notes'],
      ['/notes/trash', 'Trash'],
      ['/shares', 'Shared links'],
      [`/s/${TOKEN}`, 'Shared plan'],
    ] as const) {
      renderRoute(path);
      await waitForTitle(title);
      expect(metaContent('robots')).toBe('noindex, nofollow');
      descriptions.add(metaContent('description'));
      cleanup();
    }
    expect(descriptions.size).toBe(4);
  });
});

describe('accessible structure', () => {
  it('S-AB1016-18: the signed-in shell has landmarks and a skip link', async () => {
    signInViaRefresh();
    notesApi();
    renderRoute('/notes');
    await screen.findByRole('heading', { name: 'Your notes' }, LOAD);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/notes');
    expect(within(nav).getByRole('link', { name: 'Shared links' })).toHaveAttribute(
      'href',
      '/shares',
    );
    const main = screen.getByRole('main');
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', `#${main.id}`);
    // First in tab order: it precedes the navigation in the DOM.
    expect(skip.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('S-AB1016-19: form fields have accessible names', async () => {
    const forms = [
      ['/login', ['Email', 'Password']],
      ['/register', ['Email', 'Password']],
      ['/forgot-password', ['Email']],
      ['/reset-password', ['Email', 'New password']],
    ] as const;
    for (const [path, labels] of forms) {
      renderRoute(path);
      await screen.findByRole('main', undefined, LOAD);
      for (const label of labels) {
        expect(
          await screen.findByLabelText(new RegExp(`^${label}`), undefined, LOAD),
        ).toBeInTheDocument();
      }
      cleanup();
    }
  });

  it('S-AB1016-20: pages have no axe violations', async () => {
    renderRoute('/login');
    await screen.findByRole('heading', { name: 'Sign in' }, LOAD);
    expect(await axeViolations()).toEqual([]);
    cleanup();
    useAuthStore.setState(useAuthStore.getInitialState(), true); // a fresh page load

    signInViaRefresh();
    notesApi();
    renderRoute('/notes');
    await screen.findByText('Groceries', undefined, LOAD);
    await screen.findByRole('heading', { name: 'Tags' }, LOAD);
    expect(await axeViolations()).toEqual([]);
  });

  it('S-AB1016-21: the notes page has a logical heading order', async () => {
    signInViaRefresh();
    notesApi([noteListItem(1, { title: 'Groceries' }), noteListItem(2, { title: 'Ideas' })]);
    renderRoute('/notes');
    await screen.findByRole('heading', { name: 'Tags' }, LOAD);

    const levels = screen
      .getAllByRole('heading')
      .map((heading) => [heading.tagName, heading.textContent]);
    expect(levels).toEqual([
      ['H1', 'Your notes'],
      ['H2', 'Groceries'],
      ['H2', 'Ideas'],
      ['H2', 'Tags'],
    ]);
  });
});

describe('stable layout', () => {
  it('S-AB1016-24: the tag manager waits for the notes', async () => {
    signInViaRefresh();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('*/api/v1/notes', async () => {
        await gate;
        return HttpResponse.json(pageOf([noteListItem(1, { title: 'Groceries' })]));
      }),
      http.get('*/api/v1/tags', () => HttpResponse.json({ items: [] })),
    );
    renderRoute('/notes');
    await screen.findByRole('status', { name: 'Loading notes' }, LOAD);
    expect(screen.queryByRole('heading', { name: 'Tags' })).not.toBeInTheDocument();

    release();
    expect(await screen.findByRole('heading', { name: 'Tags' }, LOAD)).toBeInTheDocument();
  });
});
