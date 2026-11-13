import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }));

// Auth context: user stays null so the form renders; login is a stable shared mock
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, login: loginMock }),
  AuthProvider: ({ children }) => <div>{children}</div>,
}));

// Branding context: minimal branding so TenantSwitcher and header render
vi.mock('../context/BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      universityName: 'Test University',
      portalName: 'Test Portal',
      tagline: 'Campus Portal',
      primaryColor: '#1e3a8a',
      supportEmail: 'support@test.edu.pk',
      supportPhone: '0300-0000000',
    },
    tenantError: null,
  }),
  BrandingProvider: ({ children }) => <div>{children}</div>,
}));

// API module: captcha fetch resolves with a fixed code
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { code: 'ABC', token: 'captcha-token' } })),
  },
  apiMessage: (error, fallback) => error?.response?.data?.message || error?.message || fallback,
}));

function renderLogin() {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
}

describe('Login Component', () => {
  beforeEach(() => {
    loginMock.mockReset();
    localStorage.clear();
  });

  it('renders email and password fields with a sign-in button', async () => {
    renderLogin();

    expect(await screen.findByLabelText(/email \/ registration number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to portal/i })).toBeInTheDocument();
  });

  it('shows the captcha input and refresh control', async () => {
    renderLogin();

    expect(await screen.findByLabelText(/captcha answer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh captcha/i })).toBeInTheDocument();
  });

  it('calls login with credentials and captcha values', async () => {
    loginMock.mockResolvedValue({ token: 'test-token', user: { role: 'STUDENT' } });

    renderLogin();

    fireEvent.change(await screen.findByLabelText(/email \/ registration number/i), {
      target: { value: 'sp23-bscs-001@student.novastra.edu.pk' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'student123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in to portal/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith(
        'sp23-bscs-001@student.novastra.edu.pk',
        'student123',
        expect.any(String),
        'captcha-token',
        undefined,
      );
    });
  });

  it('shows the server error message when login fails', async () => {
    loginMock.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });

    renderLogin();

    fireEvent.change(await screen.findByLabelText(/email \/ registration number/i), {
      target: { value: 'sp23-bscs-001@student.novastra.edu.pk' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in to portal/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
