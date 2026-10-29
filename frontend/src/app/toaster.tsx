import type { CSSProperties } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

// The generated shadcn `sonner` wrapper imports `next-themes`, which this Vite app does not use
// (AB-1012 design). This wrapper maps the toast colours to the shadcn tokens instead.
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as CSSProperties
      }
    />
  );
}
