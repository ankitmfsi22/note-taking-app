import { ApiError } from '@/lib/api-client';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutosaveState {
  status: SaveStatus;
  // Edits that no successful save has covered yet (includes the one being saved).
  isDirty: boolean;
  errorMessage: string | null;
  // True when the user can press Retry: the automatic retries are used up, or the error is not
  // one a retry can fix on its own.
  canRetry: boolean;
  fieldErrors: Record<string, string>;
}

// Thrown by `save` for a draft that must not be sent (invalid title, content outside the schema).
export class SaveRejected extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'SaveRejected';
  }
}

interface Timers {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export interface AutosaverOptions {
  save: () => Promise<void>;
  onState: (state: AutosaveState) => void;
  debounceMs?: number;
  retryDelaysMs?: readonly number[];
  timers?: Timers;
}

export interface Autosaver {
  markDirty: () => void;
  // Saves now. Resolves true when nothing unsaved is left.
  flush: () => Promise<boolean>;
  // Manual Retry: saves now and restarts the retry sequence.
  retry: () => Promise<void>;
  dispose: () => void;
}

interface Failure {
  retryable: boolean;
  canRetry: boolean;
  message: string;
  fieldErrors: Record<string, string>;
}

const describeFailure = (error: unknown): Failure => {
  if (error instanceof SaveRejected) {
    return {
      retryable: false,
      canRetry: true,
      message: error.message,
      fieldErrors: error.fieldErrors,
    };
  }
  if (error instanceof ApiError) {
    if (error.status === 0 || error.status >= 500) {
      return { retryable: true, canRetry: false, message: error.message, fieldErrors: {} };
    }
    if (error.status === 404) {
      return {
        retryable: false,
        canRetry: false,
        message: 'This note no longer exists, so it cannot be saved.',
        fieldErrors: {},
      };
    }
    const fieldErrors = Object.fromEntries(
      (error.details ?? []).map((detail) => [detail.field, detail.message]),
    );
    return { retryable: false, canRetry: true, message: error.message, fieldErrors };
  }
  return {
    retryable: false,
    canRetry: true,
    message: 'The note could not be saved.',
    fieldErrors: {},
  };
};

const defaultTimers: Timers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

// The save state machine of SDS 9.4: debounce, one request in flight, coalesced edits, and
// automatic retries. Framework-free so fake timers can drive it.
export const createAutosaver = ({
  save,
  onState,
  debounceMs = 2000,
  retryDelaysMs = [2000, 4000, 8000],
  timers = defaultTimers,
}: AutosaverOptions): Autosaver => {
  let state: AutosaveState = {
    status: 'saved',
    isDirty: false,
    errorMessage: null,
    canRetry: false,
    fieldErrors: {},
  };
  let debounceHandle: unknown = null;
  let retryHandle: unknown = null;
  let inFlight: Promise<void> | null = null;
  let pending = false;
  let retryIndex = 0;
  let disposed = false;

  const update = (patch: Partial<AutosaveState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    onState(state);
  };

  const clearTimers = () => {
    if (debounceHandle !== null) timers.clearTimeout(debounceHandle);
    if (retryHandle !== null) timers.clearTimeout(retryHandle);
    debounceHandle = null;
    retryHandle = null;
  };

  const onSaved = () => {
    retryIndex = 0;
    if (state.isDirty) {
      // Edited while saving: the next save is already queued or its debounce is running.
      update({ status: pending ? 'saving' : 'idle', errorMessage: null, canRetry: false });
    } else {
      update({ status: 'saved', errorMessage: null, canRetry: false, fieldErrors: {} });
    }
  };

  const onFailed = (error: unknown) => {
    const failure = describeFailure(error);
    const willRetry = failure.retryable && retryIndex < retryDelaysMs.length && !pending;
    if (willRetry) {
      const delay = retryDelaysMs[retryIndex] ?? 0;
      retryIndex += 1;
      retryHandle = timers.setTimeout(() => {
        retryHandle = null;
        void attempt(true);
      }, delay);
    }
    update({
      status: 'error',
      isDirty: true,
      errorMessage: failure.message,
      canRetry: failure.retryable ? !willRetry && !pending : failure.canRetry,
      fieldErrors: failure.fieldErrors,
    });
  };

  // `quiet` keeps the Failed status visible while an automatic retry runs.
  async function attempt(quiet = false): Promise<void> {
    if (disposed) return;
    if (inFlight) {
      pending = true;
      return;
    }
    clearTimers();
    update(quiet ? { isDirty: false } : { status: 'saving', isDirty: false, canRetry: false });
    inFlight = save()
      .then(onSaved, onFailed)
      .finally(() => {
        inFlight = null;
        if (pending) {
          pending = false;
          void attempt();
        }
      });
    await inFlight;
  }

  const waitForSaves = async () => {
    while (inFlight) await inFlight;
  };

  return {
    markDirty: () => {
      if (disposed) return;
      retryIndex = 0;
      clearTimers();
      update(inFlight ? { isDirty: true } : { isDirty: true, status: 'idle', canRetry: false });
      debounceHandle = timers.setTimeout(() => {
        debounceHandle = null;
        void attempt();
      }, debounceMs);
    },
    flush: async () => {
      clearTimers();
      await waitForSaves();
      if (!state.isDirty) return true;
      await attempt();
      await waitForSaves();
      return !state.isDirty;
    },
    retry: async () => {
      retryIndex = 0;
      await attempt();
      await waitForSaves();
    },
    dispose: () => {
      disposed = true;
      clearTimers();
    },
  };
};
