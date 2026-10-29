import { TipTapDocSchema, type TipTapDoc } from '@note-app/shared';
import type { Editor } from '@tiptap/core';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { NOTE_ID, getEditor, noteFixture, renderEditorRoute, signIn } from '@/test/editor-fixtures';
import { server } from '@/test/server';
import { Component } from '../pages/note-editor-page';
import { toSavedDoc } from '../to-saved-doc';
import { NoteEditor } from './note-editor';

const DOC: TipTapDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
};

const renderEditor = async () => {
  let editor: Editor | undefined;
  const onChange = vi.fn();
  render(
    <NoteEditor
      content={DOC}
      onChange={onChange}
      onEditorReady={(instance) => {
        editor = instance;
      }}
    />,
  );
  await screen.findByRole('button', { name: 'Bold' });
  if (!editor) throw new Error('editor not ready');
  return { editor, onChange };
};

const selectText = (editor: Editor) => {
  act(() => {
    editor.commands.setContent('<p>text</p>');
    editor.commands.selectAll();
  });
};

describe('NoteEditor', () => {
  it('S-AB1012-01: the editor offers the allowed formatting set and its output passes TipTapDocSchema', async () => {
    const user = userEvent.setup();
    signIn();
    server.use(
      http.get(`*/api/v1/notes/${NOTE_ID}`, () => HttpResponse.json(noteFixture())),
      http.get('*/api/v1/tags', () => HttpResponse.json({ items: [] })),
    );
    renderEditorRoute({ Component });
    const editor = await getEditor();

    expect(await screen.findByDisplayValue('My note')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Version history' })).toBeEnabled();
    for (const name of [
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Bold',
      'Italic',
      'Strikethrough',
      'Bullet list',
      'Numbered list',
      'Quote',
      'Code',
      'Code block',
      'Link',
      'Undo',
      'Redo',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /underline/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rule/i })).not.toBeInTheDocument();

    for (const name of [
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Bold',
      'Italic',
      'Strikethrough',
      'Bullet list',
      'Numbered list',
      'Quote',
      'Code',
      'Code block',
    ]) {
      selectText(editor);
      await user.click(screen.getByRole('button', { name }));
      expect(TipTapDocSchema.safeParse(toSavedDoc(editor.getJSON())).success, name).toBe(true);
    }

    selectText(editor);
    await user.click(screen.getByRole('button', { name: 'Link' }));
    await user.type(screen.getByLabelText('Link address'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: 'Apply link' }));
    expect(JSON.stringify(editor.getJSON())).toContain('"type":"link"');
    expect(TipTapDocSchema.safeParse(toSavedDoc(editor.getJSON())).success).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(TipTapDocSchema.safeParse(toSavedDoc(editor.getJSON())).success).toBe(true);
  });

  it('S-AB1012-08: pasted script content never runs', async () => {
    const { editor, onChange } = await renderEditor();
    const html =
      '<p onclick="window.__x=1">hi<script>window.__x=2</script><a href="javascript:window.__x=3">go</a></p>';

    act(() => {
      // jsdom has no ClipboardEvent; ProseMirror only passes the event on to its paste hooks.
      editor.view.pasteHTML(html, new Event('paste') as ClipboardEvent);
    });

    expect(editor.getText()).toContain('hi');
    expect(editor.getText()).toContain('go');
    expect(editor.view.dom.querySelector('script')).toBeNull();
    expect(editor.view.dom.querySelector('[onclick]')).toBeNull();
    expect(editor.view.dom.querySelector('a[href^="javascript:"]')).toBeNull();
    expect((window as unknown as { __x?: number }).__x).toBeUndefined();
    expect(TipTapDocSchema.safeParse(toSavedDoc(editor.getJSON())).success).toBe(true);
    expect(onChange).toHaveBeenCalled();
  });

  it('keeps an unsafe link out of the saved document', async () => {
    const user = userEvent.setup();
    const { editor } = await renderEditor();
    selectText(editor);
    await user.click(screen.getByRole('button', { name: 'Link' }));
    await user.type(screen.getByLabelText('Link address'), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Apply link' }));
    expect(JSON.stringify(editor.getJSON())).not.toContain('javascript:');
  });
});

describe('toSavedDoc', () => {
  it('drops attributes the schema does not allow and rejects what stays invalid', () => {
    const doc = toSavedDoc({
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: { start: 1, type: null },
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'a',
                      marks: [
                        {
                          type: 'link',
                          attrs: { href: 'https://example.com', title: null, target: '_blank' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { type: 'paragraph' },
      ],
    });
    expect(doc.content?.[0]).toMatchObject({ type: 'orderedList', attrs: { start: 1 } });
    expect(() => toSavedDoc({ type: 'doc', content: [{ type: 'horizontalRule' }] })).toThrow();
  });
});
