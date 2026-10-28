import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { renderWithQuery } from '@/test/render';
import { ApiStatus } from './api-status';

describe('ApiStatus', () => {
  it('shows a checking state first, then that the API is up', async () => {
    renderWithQuery(<ApiStatus />);
    expect(screen.getByRole('status')).toHaveTextContent('Checking the API');
    expect(await screen.findByText('The API is up.')).toBeInTheDocument();
  });

  it('shows the server error message with a Retry button when the API fails', async () => {
    server.use(
      http.get('*/api/v1/health', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: 'r1' } },
          { status: 500 },
        ),
      ),
    );
    renderWithQuery(<ApiStatus />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
  });

  it('shows a network failure message when the API cannot be reached', async () => {
    server.use(http.get('*/api/v1/health', () => HttpResponse.error()));
    renderWithQuery(<ApiStatus />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  });

  it('recovers when Retry is clicked and the API is back', async () => {
    // The first request fails once; the default handler (API up) answers the retry.
    server.use(
      http.get('*/api/v1/health', () => new HttpResponse('down', { status: 503 }), { once: true }),
    );
    const user = userEvent.setup();
    renderWithQuery(<ApiStatus />);
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('The API is up.')).toBeInTheDocument();
  });
});
