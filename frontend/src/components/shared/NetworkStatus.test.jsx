import { act, render, screen } from '@testing-library/react';
import NetworkStatus from './NetworkStatus';

test('announces offline state and session expiry accessibly', () => {
  render(<NetworkStatus />);
  act(() => window.dispatchEvent(new Event('offline')));
  expect(screen.getByRole('status')).toHaveTextContent('You are offline');

  act(() => window.dispatchEvent(new CustomEvent('portal:session-expired')));
  expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
});
