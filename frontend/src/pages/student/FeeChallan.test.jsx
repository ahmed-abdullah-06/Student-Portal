import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FeeChallan from './FeeChallan';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  apiMessage: vi.fn(() => 'Request failed'),
}));

vi.mock('../../components/ui/UI', () => ({
  Card: ({ children, title }) => <section><h2>{title}</h2>{children}</section>,
  Badge: ({ children }) => <span>{children}</span>,
  Spinner: ({ label }) => <span>{label}</span>,
  PageHeader: ({ title }) => <h1>{title}</h1>,
  Modal: ({ children }) => <div role="dialog">{children}</div>,
  btnPrimary: 'primary',
  btnGhost: 'ghost',
}));

test('shows a payment error when checkout is declined', async () => {
  api.get.mockResolvedValue({ data: { challans: [{ id: 'c1', voucherId: 'V-1', semester: 1, dueDate: '2026-10-30', totalAmount: 1000, status: 'UNPAID' }] } });
  api.post.mockRejectedValue({ response: { status: 402, data: { message: 'Payment declined' } } });

  render(<FeeChallan />);
  await waitFor(() => expect(screen.getByText('V-1')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /pay now/i }));
  fireEvent.click(screen.getByRole('button', { name: /proceed to payment/i }));
  await waitFor(() => expect(screen.getAllByText('Payment declined').length).toBeGreaterThan(0));
});
