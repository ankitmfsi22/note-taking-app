import type { NoteUpdateRequest } from '@note-app/shared';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorSaveStore } from '../save-store';
import { NOTE_ID, getEditor, noteFixture, renderEditorRoute, signIn } from '@/test/editor-fixtures';
import { errorBody } from '@/test/fixtures';
import { server } from '@/test/server';
import { Component } from './note-editor-page';

const NOTE_URL = `*/api/v1/notes/${NOTE_ID}`;

interface Gate {
  promise: Promise<void>;
  open: () => void;
}
const gate = (): Gate => {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
};

// Real timers load the page; fake timers then drive the debounce and the retries.
const openNote = async () => {
  signIn();
  const requests: NoteUpdateRequest[] = [];
  server.use(
    http.get(NOTE_URL, () => HttpResponse.json(noteFixture())),
    http.get('*/api/v1/tags', () => HttpResponse.json({ items: [] })),
  );
  renderEditorRoute({ Component });
  const editor = await getEditor();
  await screen.findByDisplayValue('My note');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  return { editor, requests };
};

const type = (editor: Awaited<ReturnType<typeof getEditor>>, text: string) =>
  act(() => {
    editor.commands.insertContent(text);
  });

const status = () => within(screen.getByRole('status'));

describe('note editor autosave', () => {
  beforeEach(() => {
    useEditorSaveStore.getState().reset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('S-AB1012-03: edits autosave once after two seconds and the status follows', async () => {
    const { editor, requests } = await openNote();
    const first = gate();
    server.use(
      http.patch(NOTE_URL, async ({ request }) => {
        const body = (await request.json()) as NoteUpdateRequest;
        requests.push(body);
        if (requests.length === 1) await first.promise;
        return HttpResponse.json(
          noteFixture({
            title: body.title ?? '',
            ...(body.content ? { content: body.content } : {}),
          }),
        );
      }),
    );

    type(editor, 'a');
    await vi.advanceTimersByTimeAsync(1000);
    type(editor, 'b');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New title' } });
    await vi.advanceTimersByTimeAsync(1000);
    type(editor, 'c');
    await vi.advanceTimersByTimeAsync(1999);
    expect(requests).toHaveLength(0);
    expect(status().getByText('Unsaved changes')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(status().getByText(/Saving/)).toBeInTheDocument();
    expect(requests[0]?.title).toBe('New title');
    expect(JSON.stringify(requests[0]?.content)).toContain('abchello');

    // An edit while the first request is in flight starts no second request until it ends.
    type(editor, 'd');
    await vi.advanceTimersByTimeAsync(2000);
    expect(requests).toHaveLength(1);

    first.open();
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    expect(JSON.stringify(requests[1]?.content)).toContain('abcdhello');
    await vi.waitFor(() => expect(status().getByText('Saved')).toBeInTheDocument());
    expect(editor.getText()).toBe('abcdhello');
  });

  it('S-AB1012-04: a failed autosave keeps the edits, retries and then waits for Retry', async () => {
    const { editor, requests } = await openNote();
    let failing = true;
    server.use(
      http.patch(NOTE_URL, async ({ request }) => {
        requests.push((await request.json()) as NoteUpdateRequest);
        if (failing) return HttpResponse.error();
        return HttpResponse.json(noteFixture());
      }),
    );

    type(editor, 'x');
    await vi.advanceTimersByTimeAsync(2000);
    await vi.waitFor(() => expect(status().getByText('Failed')).toBeInTheDocument());
    expect(requests).toHaveLength(1);
    expect(editor.getText()).toBe('xhello');
    await vi.waitFor(() =>
      expect(screen.getAllByText(/Could not reach the server/).length).toBeGreaterThan(0),
    );

    for (const [delay, count] of [
      [2000, 2],
      [4000, 3],
      [8000, 4],
    ] as const) {
      await vi.advanceTimersByTimeAsync(delay);
      await vi.waitFor(() => expect(requests).toHaveLength(count));
      await vi.waitFor(() => expect(status().getByText('Failed')).toBeInTheDocument());
    }

    await vi.advanceTimersByTimeAsync(60_000);
    expect(requests).toHaveLength(4);
    expect(editor.getText()).toBe('xhello');

    failing = false;
    fireEvent.click(status().getByRole('button', { name: 'Retry' }));
    await vi.waitFor(() => expect(status().getByText('Saved')).toBeInTheDocument());
    expect(requests).toHaveLength(5);
    expect(JSON.stringify(requests[4]?.content)).toContain('xhello');
  });

  it('S-AB1012-05: an empty or over-long title is rejected and a server validation error is shown', async () => {
    const { editor, requests } = await openNote();
    server.use(
      http.patch(NOTE_URL, async ({ request }) => {
        requests.push((await request.json()) as NoteUpdateRequest);
        return HttpResponse.json(
          errorBody('VALIDATION_ERROR', 'The content is invalid', [
            { field: 'content', message: 'Content is too large' },
          ]),
          { status: 400 },
        );
      }),
    );

    type(editor, 'kept ');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } });
    await vi.advanceTimersByTimeAsync(2000);
    await vi.waitFor(() =>
      expect(screen.getByText('Title must be 1 to 200 characters')).toBeInTheDocument(),
    );
    expect(requests).toHaveLength(0);
    expect(editor.getText()).toBe('kept hello');

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'x'.repeat(201) } });
    await vi.advanceTimersByTimeAsync(2000);
    await vi.waitFor(() =>
      expect(screen.getByText('Title must be 1 to 200 characters')).toBeInTheDocument(),
    );
    expect(requests).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Valid title' } });
    await vi.advanceTimersByTimeAsync(2000);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await vi.waitFor(() => expect(status().getByText('Failed')).toBeInTheDocument());
    expect(status().getByText('The content is invalid')).toBeInTheDocument();
    expect(editor.getText()).toBe('kept hello');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(requests).toHaveLength(1);
  });
});
