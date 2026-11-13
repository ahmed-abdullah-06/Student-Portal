import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { I18nProvider } from './i18n';
import AppRoutes from './App';
import ErrorBoundary from './components/shared/ErrorBoundary';
import NetworkStatus from './components/shared/NetworkStatus';
import './index.css';
import { initTelemetry, Sentry } from './utils/telemetry';

initTelemetry();

function ErrorBoundaryFallback() {
  return (
    <main role="alert" className="min-h-screen grid place-items-center bg-slate-50 px-6 text-center">
      <section className="max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-3 text-sm text-slate-600">The portal could not render this page. Try reloading.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white">
          Reload
        </button>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorBoundaryFallback />}>
    <ErrorBoundary>
      <NetworkStatus />
      <BrowserRouter>
        <I18nProvider>
          <BrandingProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrandingProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
    </Sentry.ErrorBoundary>
  </StrictMode>
);
