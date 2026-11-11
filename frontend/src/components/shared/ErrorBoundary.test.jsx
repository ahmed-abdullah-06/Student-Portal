import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Broken() {
  throw new Error('render failure');
}

test('shows recovery actions when a child crashes', () => {
  const originalError = console.error;
  console.error = () => {};
  render(<ErrorBoundary><Broken /></ErrorBoundary>);
  console.error = originalError;

  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
});

test('renders children when no error occurs', () => {
  render(<ErrorBoundary><button type="button">Continue</button></ErrorBoundary>);
  expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
});
