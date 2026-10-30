import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDocumentMeta, type DocumentMeta } from './use-document-meta';

function Page(props: DocumentMeta) {
  useDocumentMeta(props);
  return null;
}

const meta = (name: string) => document.head.querySelectorAll(`meta[name="${name}"]`);

afterEach(() => {
  document.head.querySelectorAll('meta[name="description"], meta[name="robots"]').forEach((el) => {
    el.remove();
  });
});

describe('useDocumentMeta', () => {
  it('S-AB1016-13: the hook sets the title and description', () => {
    const view = render(<Page title="Sign in" description="First description" />);
    expect(document.title).toBe('Sign in | Note App');
    expect(meta('description')[0]).toHaveAttribute('content', 'First description');

    view.rerender(<Page title="Register" description="Second description" />);
    expect(document.title).toBe('Register | Note App');
    expect(meta('description')).toHaveLength(1);
    expect(meta('description')[0]).toHaveAttribute('content', 'Second description');
  });

  it('S-AB1016-14: noindex is added and removed with the route', () => {
    const view = render(<Page title="Notes" description="Private" noindex />);
    expect(meta('robots')[0]).toHaveAttribute('content', 'noindex, nofollow');

    view.rerender(<Page title="Sign in" description="Public" />);
    expect(meta('robots')).toHaveLength(0);
  });
});
