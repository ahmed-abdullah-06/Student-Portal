import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Alert, btnPrimary, inputCls } from '../../components/ui/UI';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword: password, confirmPassword: confirm });
      setMsg({ type: 'success', text: res.data.message });
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
      <Card className="w-full max-w-[440px]">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#edf2ff] text-[#1e3a8a] grid place-items-center mx-auto mb-3">
            <KeyRound size={22} />
          </div>
          <h1 className="text-[22px] font-bold text-[#172033] m-0">Reset Password</h1>
          <p className="text-sm text-[#697386] mt-1">Paste your reset token and choose a new password.</p>
        </div>

        {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

        <form onSubmit={submit}>
          <label className="block mb-4">
            <span className="block text-xs font-semibold text-[#344054] mb-2">Reset Token</span>
            <input type="text" required value={token} onChange={(e) => setToken(e.target.value)} className={inputCls + ' font-mono text-[11px]'} />
          </label>
          <label className="block mb-4">
            <span className="block text-xs font-semibold text-[#344054] mb-2">New Password</span>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls + ' pr-11'}
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98a0ae]" tabIndex={-1}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <small className="block text-[10px] text-[#98a0ae] mt-1">Min 8 chars with upper, lower and number</small>
          </label>
          <label className="block mb-5">
            <span className="block text-xs font-semibold text-[#344054] mb-2">Confirm Password</span>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </label>
          <button type="submit" disabled={busy} className={btnPrimary + ' w-full justify-center py-3'}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> Resetting...</> : 'Reset password'}
          </button>
        </form>

        <p className="text-center mt-5">
          <Link to="/login" className="text-xs text-[#1e3a8a] hover:underline">Back to login</Link>
        </p>
      </Card>
    </div>
  );
}
