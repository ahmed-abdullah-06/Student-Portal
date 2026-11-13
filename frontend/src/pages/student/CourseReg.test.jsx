import { render, screen, waitFor } from '@testing-library/react';
import CourseReg from './CourseReg';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  apiMessage: vi.fn((error) => error?.message || 'Error'),
}));

vi.mock('../../components/ui/UI', () => ({
  Card: ({ children, title }) => <section><h2>{title}</h2>{children}</section>,
  Badge: ({ children }) => <span>{children}</span>,
  Spinner: ({ label }) => <span>{label}</span>,
  Alert: ({ children }) => <div role="alert">{children}</div>,
  PageHeader: ({ title }) => <h1>{title}</h1>,
  Modal: ({ children }) => <div>{children}</div>,
  btnPrimary: 'primary',
  btnGhost: 'ghost',
}));

test('disables a course when selecting it would exceed the credit limit', async () => {
  api.get
    .mockResolvedValueOnce({ data: { courses: [{ id: 'new', code: 'CS-2', title: 'New', creditHours: 4, prerequisitesMet: true, enrolledCount: 1, capacity: 30 }] } })
    .mockResolvedValueOnce({ data: { enrollments: [{ id: 'old', section: { course: { creditHours: 18 } } }] } });

  render(<CourseReg />);
  await waitFor(() => expect(screen.getByText('Available Courses')).toBeInTheDocument());
  expect(screen.getByRole('checkbox')).toBeDisabled();
});
