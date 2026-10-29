import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { NOTE_ID, getEditor, noteFixture, renderEditorRoute, signIn } from '@/test/editor-fixtures';
import { errorBody } from '@/test/fixtures';
import { server } from '@/test/server';
import { Component } from '../pages/note-editor-page';

const beforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('LeaveGuard', () => {
  it('S-AB1012-06: leaving with unsaved edits saves first, or asks, and the tab warns', async () => {
    signIn();
    const user = userEvent.setup();
    let saveFails = false;
    let patches = 0;
    server.use(
      http.get(`*/api/v1/notes/${NOTE_ID}`, () => HttpResponse.json(noteFixture())),
      http.get('*/api/v1/tags', () => HttpResponse.json({ items: [] })),
      http.patch(`*/api/v1/notes/${NOTE_ID}`, () => {
        patches += 1;
        return saveFails
          ? HttpResponse.json(errorBody('VALIDATION_ERROR', 'The content is invalid'), {
              status: 400,
            })
          : HttpResponse.json(noteFixture());
      }),
    );
    const { router } = renderEditorRoute({ Component });
    const editor = await getEditor();

    // No unsaved changes: no warning and no block.
    expect(beforeUnload()).toBe(false);

    // The flush succeeds: the edit is saved first and no dialog appears.
    act(() => {
      editor.commands.insertContent('one ');
    });
    expect(beforeUnload()).toBe(true);
    await act(async () => {
      await router.navigate('/notes');
    });
    expect(await screen.findByRole('heading', { name: 'Notes page' })).toBeInTheDocument();
    expect(patches).toBe(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(beforeUnload()).toBe(false);

    // The flush fails: the dialog lets the user stay or leave.
    saveFails = true;
    await act(async () => {
      await router.navigate(`/notes/${NOTE_ID}`);
    });
    const second = await getEditor();
    act(() => {
      second.commands.insertContent('two ');
    });
    await act(async () => {
      await router.navigate('/notes');
    });
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Discard changes?');
    expect(patches).toBe(2);

    await user.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/notes/${NOTE_ID}`);
    expect(second.getText()).toContain('two');

    await act(async () => {
      await router.navigate('/notes');
    });
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('heading', { name: 'Notes page' })).toBeInTheDocument();
  });
});
