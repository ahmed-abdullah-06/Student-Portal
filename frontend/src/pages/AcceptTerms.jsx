import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { apiMessage } from '../services/api';
import { Alert, Card, btnPrimary } from '../components/ui/UI';

export default function AcceptTerms() {
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    try {
      await api.post('/auth/accept-terms', { accepted });
      window.location.reload();
    } catch (err) { setError(apiMessage(err)); }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5">
      <Card title="Before you continue" subtitle="Please review and accept the portal terms">
        {error && <div className="mb-4"><Alert>{error}</Alert></div>}
        <p className="max-w-xl text-sm leading-6 text-slate-600">The Student Portal processes academic, attendance, support, and payment information to provide university services. Use your account only for authorized university activity.</p>
        <p className="mt-3 text-sm text-slate-600"><Link className="text-brand-700 underline" to="/privacy" target="_blank">Privacy policy</Link> · <Link className="text-brand-700 underline" to="/terms" target="_blank">Terms of service</Link></p>
        <form onSubmit={submit} className="mt-6">
          <label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required className="mt-1" /> I have read and accept the Privacy Policy and Terms of Service.</label>
          <button type="submit" className={`${btnPrimary} mt-6`} disabled={!accepted}>Accept and continue</button>
        </form>
      </Card>
    </main>
  );
}
