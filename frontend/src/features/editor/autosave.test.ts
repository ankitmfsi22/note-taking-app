import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { SaveRejected, createAutosaver, type AutosaveState } from './autosave';

const network = () => new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
const serverError = () => new ApiError(500, 'INTERNAL_ERROR', 'Server error');

interface Deferred {
  resolve: () => void;
  reject: (error: unknown) => void;
}

const setup = (impl?: (call: number) => Promise<void>) => {
  const states: AutosaveState[] = [];
  const deferreds: Deferred[] = [];
  const save = vi.fn((): Promise<void> => {
    if (impl) return impl(save.mock.calls.length);
    return new Promise<void>((resolve, reject) => deferreds.push({ resolve, reject }));
  });
  const autosaver = createAutosaver({ save, onState: (state) => states.push(state) });
  const last = () => states.at(-1);
  return { autosaver, save, deferreds, states, last };
};

describe('createAutosaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('restarts the 2 s debounce on every edit and saves once', async () => {
    const { autosaver, save, deferreds, last } = setup();
    autosaver.markDirty();
    await vi.advanceTimersByTimeAsync(1500);
    autosaver.markDirty();
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(last()?.status).toBe('saving');
    deferreds[0]?.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toMatchObject({ status: 'saved', isDirty: false });
  });

  it('coalesces edits made during a save into one later save', async () => {
    const { autosaver, save, deferreds } = setup();
    autosaver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    autosaver.markDirty();
    autosaver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
    deferreds[0]?.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    deferreds[1]?.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('retries a network error after 2, 4 and 8 seconds and then waits for Retry', async () => {
    const { autosaver, save, last } = setup(() => Promise.reject(network()));
    autosaver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(last()).toMatchObject({ status: 'error', canRetry: false });
    await vi.advanceTimersByTimeAsync(1999);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    expect(save).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(8000);
    expect(save).toHaveBeenCalledTimes(4);
    expect(last()).toMatchObject({ status: 'error', canRetry: true, isDirty: true });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(4);
  });

  it('retries a 500 as well', async () => {
    const { autosaver, save } = setup((call) =>
      call < 2 ? Promise.reject(serverError()) : Promise.resolve(),
    );
    autosaver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 400 or a 404 and explains a missing note', async () => {
    const bad = setup(() =>
      Promise.reject(
        new ApiError(400, 'VALIDATION_ERROR', 'Invalid', [
          { field: 'content', message: 'Too big' },
        ]),
      ),
    );
    bad.autosaver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(bad.save).toHaveBeenCalledTimes(1);
    expect(bad.last()).toMatchObject({
      status: 'error',
      canRetry: true,
      fieldErrors: { content: 'Too big' },
    });

    const gone = setup(() => Promise.reject(new ApiError(404, 'NOTE_NOT_FOUND', 'Note not found')));
    gone.autosaver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(gone.save).toHaveBeenCalledTimes(1);
    expect(gone.last()).toMatchObject({ status: 'error', canRetry: false });
    expect(gone.last()?.errorMessage).toMatch(/no longer exists/);
  });

  it('keeps a rejected draft out of the network and reports its field errors', async () => {
    const { autosaver, last } = setup(() =>
      Promise.reject(new SaveRejected('Fix the title', { title: 'Title is required' })),
    );
    autosaver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    expect(last()).toMatchObject({
      status: 'error',
      canRetry: true,
      errorMessage: 'Fix the title',
      fieldErrors: { title: 'Title is required' },
    });
  });

  it('Retry saves immediately and resets the retry sequence', async () => {
    let fail = true;
    const { autosaver, save, last } = setup(() =>
      fail ? Promise.reject(network()) : Promise.resolve(),
    );
    autosaver.markDirty();
    await vi.advanceTimersByTimeAsync(2000 + 2000 + 4000 + 8000);
    expect(save).toHaveBeenCalledTimes(4);
    fail = false;
    await autosaver.retry();
    expect(save).toHaveBeenCalledTimes(5);
    expect(last()).toMatchObject({ status: 'saved', isDirty: false, canRetry: false });
  });

  it('flush saves a dirty draft now and reports success or failure', async () => {
    const ok = setup(() => Promise.resolve());
    ok.autosaver.markDirty();
    await expect(ok.autosaver.flush()).resolves.toBe(true);
    expect(ok.save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(ok.save).toHaveBeenCalledTimes(1);

    const clean = setup(() => Promise.resolve());
    await expect(clean.autosaver.flush()).resolves.toBe(true);
    expect(clean.save).not.toHaveBeenCalled();

    const failing = setup(() => Promise.reject(network()));
    failing.autosaver.markDirty();
    await expect(failing.autosaver.flush()).resolves.toBe(false);
    // A failed flush leaves the normal retry sequence running for a user who stays.
    await vi.advanceTimersByTimeAsync(2000);
    expect(failing.save).toHaveBeenCalledTimes(2);
  });

  it('flush waits for a save in flight and then saves the newer edits', async () => {
    const { autosaver, save, deferreds } = setup();
    autosaver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    autosaver.markDirty();
    const flushed = autosaver.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
    deferreds[0]?.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    deferreds[1]?.resolve();
    await expect(flushed).resolves.toBe(true);
  });

  it('dispose cancels timers', async () => {
    const { autosaver, save } = setup(() => Promise.resolve());
    autosaver.markDirty();
    autosaver.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });
});
