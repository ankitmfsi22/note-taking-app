import { useQueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from './providers';

describe('AppProviders', () => {
  it('provides a QueryClient with the app defaults and keeps the same one across re-renders', () => {
    const { result, rerender } = renderHook(() => useQueryClient(), { wrapper: AppProviders });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(first.getDefaultOptions().queries?.retry).toBe(1);
  });
});
