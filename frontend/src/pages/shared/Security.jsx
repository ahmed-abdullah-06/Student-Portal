import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, MonitorSmartphone, LogOut, KeyRound, QrCode, Trash2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Card, Spinner, Alert, PageHeader, Badge, Modal, btnPrimary, btnSecondary, btnDanger, inputCls } from '../../components/ui/UI';

const labelCls = 'block text-[11px] font-semibold text-[#344054] mb-1';

function Sessions() {
  const [sessions, setSessions] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api.get('/auth/sessions');
    setSessions(res.data.sessions);
  }
  useEffect(() => { load().catch(() => setSessions([])); }, []);

  async function revoke(id) {
    setMsg(null);
    try {
      await api.delete(`/auth/sessions/${id}`);
      setMsg({ type: 'success', text: 'Session signed out' });
      await load();
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); }
  }

  async function revokeAll() {
    if (!window.confirm('Sign out of ALL sessions (including this one)? You will need to log in again.')) return;
    setBusy(true); setMsg(null);
    try {
      await api.post('/auth/sessions/revoke-all');
      window.location.href = '/login';
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); setBusy(false); }
  }

  if (!sessions) return <Spinner label="Loading sessions..." />;

  return (
    <Card
      title="Active sessions"
      subtitle="Every device currently signed in to your account"
      className="p-0 overflow-hidden"
      action={<button onClick={revokeAll} disabled={busy} className={btnDanger}>{busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Sign out all</button>}
    >
      {msg && <div className="p-4 pb-0"><Alert type={msg.type}>{msg.text}</Alert></div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">Device</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">IP address</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">Signed in</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">Last seen</th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-[#f9fafc]">
                <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">
                  <span className="flex items-center gap-2">
                    <MonitorSmartphone size={14} className="text-[#697386]" />
                    <span className="truncate max-w-[260px] inline-block">{s.userAgent || 'Unknown device'}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-[11px] text-[#697386] border-b border-[#edf0f3] font-mono">{s.ipAddress}</td>
                <td className="px-4 py-3 text-[11px] text-[#697386] border-b border-[#edf0f3]">{new Date(s.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-[11px] text-[#697386] border-b border-[#edf0f3]">{new Date(s.lastSeenAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-right border-b border-[#edf0f3]">
                  <button
                    onClick={() => revoke(s.id)}
                    className="py-1.5 px-2.5 text-[11px] rounded-lg border border-[#f5c6c6] text-[#d14545] hover:bg-[#fde8e8] transition bg-transparent"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-sm text-[#98a0ae]">No active sessions</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TwoFactor() {
  const { user } = useAuth();
  const enabled = Boolean(user?.twoFactorEnabled);
  const [setup, setSetup] = useState(null); // { secret, qr, otpauthUrl }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showDisable, setShowDisable] = useState(false);
  const [disableCreds, setDisableCreds] = useState({ password: '', code: '' });

  async function beginSetup() {
    setBusy(true); setMsg(null);
    try {
      const res = await api.post('/auth/2fa/enable');
      setSetup(res.data);
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.post('/auth/2fa/confirm', { code });
      setMsg({ type: 'success', text: 'Two-factor authentication is now enabled' });
      setSetup(null);
      setCode('');
      window.location.reload();
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  async function disable(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.post('/auth/2fa/disable', {
        password: disableCreds.password || undefined,
        code: disableCreds.code || undefined,
      });
      setShowDisable(false);
      window.location.reload();
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  return (
    <Card
      title="Two-factor authentication (TOTP)"
      subtitle="Add an authenticator app as a second step at login"
      action={<Badge tone={enabled ? 'green' : 'gray'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>}
    >
      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      {!enabled && !setup && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[12px] text-[#697386] m-0 flex-1 min-w-[240px]">
            Protect your account with a time-based one-time password (Google Authenticator, Authy, 1Password…).
          </p>
          <button onClick={beginSetup} disabled={busy} className={btnPrimary}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Set up 2FA
          </button>
        </div>
      )}

      {setup && (
        <form onSubmit={confirm} className="space-y-4">
          <ol className="text-[12px] text-[#465166] space-y-1.5 list-decimal pl-5 m-0">
            <li>Scan the QR code with your authenticator app (or enter the key manually).</li>
            <li>Enter the 6-digit code the app shows to verify.</li>
          </ol>
          <div className="flex flex-wrap gap-5 items-start">
            {setup.qr ? (
              <img src={setup.qr} alt="QR code for two-factor setup" className="w-40 h-40 border border-[#e4e7ec] rounded-lg bg-white p-2" />
            ) : (
              <div className="w-40 h-40 border border-[#e4e7ec] rounded-lg grid place-items-center text-[#98a0ae]"><QrCode size={32} /></div>
            )}
            <div className="min-w-[220px] flex-1">
              <span className={labelCls}>Setup key</span>
              <code className="block break-all text-[12px] bg-[#f6f8fc] border border-[#e4e7ec] rounded-lg px-3 py-2 mb-4">{setup.secret}</code>
              <label className={labelCls} htmlFor="totp-code">Verification code *</label>
              <input
                id="totp-code"
                required
                pattern="[0-9]{6}"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className={inputCls}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || code.length !== 6} className={btnPrimary}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Verify & enable
            </button>
            <button type="button" onClick={() => { setSetup(null); setCode(''); }} className={btnSecondary}>Cancel</button>
          </div>
        </form>
      )}

      {enabled && !showDisable && (
        <div className="flex items-center gap-3">
          <p className="text-[12px] text-[#697386] m-0 flex-1">Your account requires an authenticator code at every login.</p>
          <button onClick={() => setShowDisable(true)} className={btnDanger}><Trash2 size={14} /> Disable 2FA</button>
        </div>
      )}

      {enabled && showDisable && (
        <Modal title="Disable two-factor authentication" onClose={() => setShowDisable(false)}>
          <form onSubmit={disable} className="space-y-3">
            <Alert type="warning">Enter your password or a current authenticator code to confirm.</Alert>
            <div>
              <label className={labelCls} htmlFor="disable-pw">Password</label>
              <input id="disable-pw" type="password" autoComplete="current-password" className={inputCls} value={disableCreds.password} onChange={(e) => setDisableCreds({ ...disableCreds, password: e.target.value })} />
            </div>
            <div>
              <label className={labelCls} htmlFor="disable-code">Authenticator code (optional if password given)</label>
              <input id="disable-code" inputMode="numeric" placeholder="123456" className={inputCls} value={disableCreds.code} onChange={(e) => setDisableCreds({ ...disableCreds, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy || (!disableCreds.password && !disableCreds.code)} className={btnDanger + ' flex-1 justify-center'}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Disable 2FA
              </button>
              <button type="button" onClick={() => setShowDisable(false)} className={btnSecondary}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

export default function Security() {
  return (
    <div>
      <PageHeader
        title="Security"
        subtitle="Active sessions, sign-out control and two-factor authentication"
        action={<ShieldCheck size={20} className="text-[#11875d]" />}
      />
      <div className="grid grid-cols-1 gap-4">
        <TwoFactor />
        <Sessions />
      </div>
    </div>
  );
}
