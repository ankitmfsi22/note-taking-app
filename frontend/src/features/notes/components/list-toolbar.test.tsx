import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { tag } from '@/test/fixtures';
import type { ListParams } from '../list-params';
import { ListToolbar } from './list-toolbar';

const params: ListParams = { page: 1, sortBy: 'updatedAt', sortOrder: 'desc', tagIds: [] };

describe('ListToolbar layout', () => {
  it('S-AB1016-23: the tag filter row keeps its space while tags load', () => {
    const view = render(
      <ListToolbar params={params} tags={[]} tagsLoading onChange={() => undefined} />,
    );
    expect(screen.queryByRole('group', { name: 'Filter by tag' })).not.toBeInTheDocument();
    const placeholder = view.container.querySelector('[aria-hidden="true"].h-6');
    expect(placeholder).not.toBeNull();

    view.rerender(
      <ListToolbar
        params={params}
        tags={[tag(1, { name: 'work' })]}
        tagsLoading={false}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('group', { name: 'Filter by tag' })).toHaveClass('min-h-6');
    expect(view.container.querySelector('[aria-hidden="true"].h-6')).toBeNull();
  });
});
