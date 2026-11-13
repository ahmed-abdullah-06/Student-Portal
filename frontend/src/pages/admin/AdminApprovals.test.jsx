import { render, screen, waitFor } from '@testing-library/react';
import AdminApprovals from './AdminApprovals';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn() },
  apiMessage: vi.fn(() => 'Request failed'),
}));

vi.mock('../../components/ui/UI', () => ({
  Card: ({ children }) => <section>{children}</section>,
  Spinner: ({ label }) => <span>{label}</span>,
  Alert: ({ children }) => <div role="alert">{children}</div>,
  Badge: ({ children }) => <span>{children}</span>,
  PageHeader: ({ title }) => <h1>{title}</h1>,
  Tabs: ({ tabs }) => <nav>{tabs.map((tab) => <button key={tab}>{tab}</button>)}</nav>,
  btnPrimary: 'primary',
  btnDanger: 'danger',
  inputCls: 'input',
}));

test('renders all seven approval categories', async () => {
  api.get.mockResolvedValue({ data: {} });
  render(<AdminApprovals />);
  await waitFor(() => expect(screen.getByText('Approvals')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Re-checks' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Freezes' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Installments' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Refunds' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Scholarships' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Certificates' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bank Proofs' })).toBeInTheDocument();
});
