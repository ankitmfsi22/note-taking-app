import { NoteUpdateRequestSchema, TITLE_MAX } from '@note-app/shared';
import type { JSONContent } from '@tiptap/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { updateNote } from './api';
import { SaveRejected, createAutosaver, type Autosaver } from './autosave';
import { noteDetailKey } from './queries';
import { useEditorSaveStore } from './save-store';
import { toSavedDoc } from './to-saved-doc';

export interface Draft {
  title: string;
  content: JSONContent;
}

interface UseAutosaveOptions {
  noteId: string;
  // Read when a request starts, so a save always carries the latest title and content.
  getDraft: () => Draft | null;
}

const TITLE_MESSAGE = `Title must be 1 to ${TITLE_MAX} characters`;

// Wires the autosave state machine to the note API, the query cache and the save-state store.
export const useAutosave = ({ noteId, getDraft }: UseAutosaveOptions) => {
  const queryClient = useQueryClient();
  const autosaver = useRef<Autosaver | null>(null);
  const getDraftRef = useRef(getDraft);
  useEffect(() => {
    getDraftRef.current = getDraft;
  });

  useEffect(() => {
    const store = useEditorSaveStore.getState();
    let announced = false;

    const save = async () => {
      const draft = getDraftRef.current();
      if (!draft) return;
      let content;
      try {
        content = toSavedDoc(draft.content);
      } catch {
        throw new SaveRejected('The note content cannot be saved in its current form.');
      }
      const parsed = NoteUpdateRequestSchema.safeParse({ title: draft.title, content });
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const field = String(issue.path[0] ?? 'content');
          fieldErrors[field] = field === 'title' ? TITLE_MESSAGE : issue.message;
        }
        throw new SaveRejected(
          fieldErrors['title'] ? 'Fix the title to save your changes.' : 'The note is too large.',
          fieldErrors,
        );
      }
      const note = await updateNote(noteId, parsed.data);
      queryClient.setQueryData(noteDetailKey(noteId), note);
      void queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
    };

    const instance = createAutosaver({
      save,
      onState: (state) => {
        useEditorSaveStore.getState().apply(state);
        // One toast per failure streak, not one per retry.
        if (state.status === 'error' && !announced) {
          announced = true;
          toast.error(state.errorMessage ?? 'The note could not be saved.');
        } else if (state.status === 'saved') {
          announced = false;
        }
      },
    });
    autosaver.current = instance;
    store.reset();
    store.register({ flush: instance.flush, retry: instance.retry });

    return () => {
      instance.dispose();
      autosaver.current = null;
      useEditorSaveStore.getState().reset();
    };
  }, [noteId, queryClient]);

  return useCallback(() => autosaver.current?.markDirty(), []);
};
