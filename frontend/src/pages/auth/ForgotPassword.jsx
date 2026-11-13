import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Loader2, KeyRound } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Alert, btnPrimary, inputCls } from '../../components/ui/UI';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [devToken, setDevToken] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setDevToken('');
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMsg({ type: 'success', text: res.data.message });
      if (res.data.devToken) setDevToken(res.data.devToken);
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
          <h1 className="text-[22px] font-bold text-[#172033] m-0">Forgot Password</h1>
          <p className="text-sm text-[#697386] mt-1">Enter your email or registration number to receive a reset link.</p>
        </div>

        {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

        {devToken && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-[11px] font-semibold text-amber-700 mb-1">Dev token (email not configured):</p>
            <code className="text-[10px] text-amber-800 break-all">{devToken}</code>
          </div>
        )}

        <form onSubmit={submit}>
          <label className="block mb-4">
            <span className="block text-xs font-semibold text-[#344054] mb-2">Email / Registration Number</span>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sp23-bscs-001@student.novastra.edu.pk"
              className={inputCls}
            />
          </label>
          <button type="submit" disabled={busy} className={btnPrimary + ' w-full justify-center py-3'}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : <><Send size={15} /> Send reset link</>}
          </button>
        </form>

        <div className="text-center mt-5">
          <Link to="/reset-password" className="text-xs text-[#1e3a8a] hover:underline">Have a token? Reset password</Link>
          <span className="mx-2 text-[#d8dde6]">|</span>
          <Link to="/login" className="text-xs text-[#1e3a8a] hover:underline">Back to login</Link>
        </div>
      </Card>
    </div>
  );
}
