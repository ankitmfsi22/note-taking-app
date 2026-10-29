import { create } from 'zustand';
import type { AutosaveState } from './autosave';

interface EditorSaveState extends AutosaveState {
  // Registered by the open editor, null when no editor is open. AB-1015 flushes through this
  // before it restores a version.
  flush: (() => Promise<boolean>) | null;
  retry: (() => Promise<void>) | null;
  apply: (state: AutosaveState) => void;
  register: (
    handlers: { flush: () => Promise<boolean>; retry: () => Promise<void> } | null,
  ) => void;
  reset: () => void;
}

const initial: AutosaveState = {
  status: 'saved',
  isDirty: false,
  errorMessage: null,
  canRetry: false,
  fieldErrors: {},
};

// One of the two Zustand stores (frontend/CLAUDE.md): only the save state of the open note.
// The note itself stays in TanStack Query and the live document in the editor.
export const useEditorSaveStore = create<EditorSaveState>()((set) => ({
  ...initial,
  flush: null,
  retry: null,
  apply: (state) => set(state),
  register: (handlers) => set({ flush: handlers?.flush ?? null, retry: handlers?.retry ?? null }),
  reset: () => set({ ...initial, flush: null, retry: null }),
}));
