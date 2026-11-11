import { Component } from 'react';
import { captureException } from '../../utils/telemetry';
import { en, ur } from '../../i18n/index.jsx';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    captureException(error, { componentStack: info?.componentStack || 'unknown' });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const dictionary = document.documentElement.lang === 'ur' ? ur : en;
    const t = (key) => dictionary[key] || en[key] || key;

    return (
      <main role="alert" className="min-h-screen grid place-items-center bg-slate-50 px-6 text-center">
        <section className="max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">{t('errors.generic')}</h1>
          <p className="mt-3 text-sm text-slate-600">
            {t('errors.renderDescription')}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={this.handleReload} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
              {t('errors.tryAgain')}
            </button>
            <a href="/login" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              {t('errors.signIn')}
            </a>
          </div>
        </section>
      </main>
    );
  }
}
