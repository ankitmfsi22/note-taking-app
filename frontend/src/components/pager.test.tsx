import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pager } from './pager';

describe('Pager', () => {
  it('renders nothing for a single page', () => {
    render(<Pager page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('moves to the previous and next page and stops at the ends', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(<Pager page={2} totalPages={3} onPageChange={onPageChange} />);
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange.mock.calls).toEqual([[1], [3]]);

    rerender(<Pager page={1} totalPages={3} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    rerender(<Pager page={3} totalPages={3} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
