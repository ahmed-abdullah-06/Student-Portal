import { useState } from 'react';
import { Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, PageHeader, Alert, btnPrimary, inputCls } from '../../components/ui/UI';

export default function ChangePassword() {
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post('/auth/change-password', form);
      setMsg({ type: 'success', text: res.data.message });
      setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Change Password" subtitle="Update your account password" />
      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}
      <Card className="max-w-[480px]">
        <form onSubmit={submit}>
          <label className="block mb-4">
            <span className="block text-xs font-semibold text-[#344054] mb-2">Current Password</span>
            <input type="password" required value={form.oldPassword} onChange={(e) => setForm({ ...form, oldPassword: e.target.value })} className={inputCls} />
          </label>
          <label className="block mb-4">
            <span className="block text-xs font-semibold text-[#344054] mb-2">New Password</span>
            <div className="relative">
              <input type={show ? 'text' : 'password'} required minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} className={inputCls + ' pr-11'} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98a0ae]" tabIndex={-1}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <small className="block text-[10px] text-[#98a0ae] mt-1">Min 8 chars with uppercase, lowercase and a number</small>
          </label>
          <label className="block mb-5">
            <span className="block text-xs font-semibold text-[#344054] mb-2">Confirm New Password</span>
            <input type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className={inputCls} />
          </label>
          <button type="submit" disabled={busy} className={btnPrimary + ' py-2.5'}>
            {busy ? <><Loader2 size={15} className="animate-spin" /> Updating...</> : <><ShieldCheck size={15} /> Update password</>}
          </button>
        </form>
      </Card>
    </div>
  );
}
