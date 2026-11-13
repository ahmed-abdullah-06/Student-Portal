import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Loader2, Save, Trash2, Eye } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { useBranding } from '../../context/BrandingContext';
import { Card, Spinner, Alert, PageHeader, Tabs, btnPrimary, btnSecondary, inputCls } from '../../components/ui/UI';

const labelCls = 'block text-[11px] font-semibold text-[#344054] mb-1';
const SECTIONS = ['branding', 'academics', 'fees', 'features', 'retention'];

// Explicit field definitions per section: [key, label, type]
const FIELDS = {
  branding: [
    ['universityName', 'University name', 'text'],
    ['portalName', 'Portal name', 'text'],
    ['tagline', 'Tagline', 'text'],
    ['logoText', 'Logo text', 'text'],
    ['primaryColor', 'Primary color', 'color'],
    ['accentColor', 'Accent color', 'color'],
    ['supportEmail', 'Support email', 'email'],
    ['supportPhone', 'Support phone', 'text'],
  ],
  academics: [
    ['maxCreditHours', 'Max credit hours per semester', 'number'],
    ['minAttendancePct', 'Minimum attendance %', 'number'],
    ['passingGradePoints', 'Passing grade points', 'number'],
    ['deansListCgpa', "Dean's list CGPA", 'number'],
    ['withdrawalWindowDays', 'Withdrawal window (days)', 'number'],
    ['degreeRequirementCredits', 'Degree requirement credits', 'number'],
  ],
  fees: [
    ['currency', 'Currency', 'text'],
    ['lateFeePct', 'Late fee %', 'number'],
    ['challengeGraceDays', 'Challenge grace days (days)', 'number'],
    ['installmentPlans', 'Installment plans (comma separated)', 'text'],
  ],
  features: [
    ['registrationOpen', 'Course registration open', 'bool'],
    ['evaluationsOpen', 'Course evaluations open', 'bool'],
    ['chatEnabled', 'Messaging / chat enabled', 'bool'],
    ['smsNotifications', 'SMS notifications', 'bool'],
    ['emailNotifications', 'Email notifications', 'bool'],
  ],
  retention: [
    ['auditLogDays', 'Audit log retention (days)', 'number'],
    ['chatMessageDays', 'Chat message retention (days)', 'number'],
    ['notificationDays', 'Notification retention (days)', 'number'],
  ],
};

export default function Settings() {
  const { refresh } = useBranding();
  const [active, setActive] = useState('branding');
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [retention, setRetention] = useState(null);

  async function load() {
    const res = await api.get('/settings');
    setSettings(res.data.settings);
  }

  useEffect(() => {
    load().catch((err) => setMsg({ type: 'error', text: apiMessage(err) }));
  }, []);

  useEffect(() => {
    if (!settings || !FIELDS[active]) return;
    const src = settings[active] || {};
    const init = {};
    for (const [key, , type] of FIELDS[active]) {
      const v = src[key];
      if (type === 'bool') init[key] = Boolean(v);
      else if (type === 'text' && Array.isArray(v)) init[key] = v.join(', ');
      else init[key] = v ?? '';
    }
    if (active === 'academics' && src.evaluationWeights) {
      init.evaluationWeights = { ...src.evaluationWeights };
    }
    setForm(init);
    setMsg(null);
  }, [settings, active]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const payload = {};
      for (const [key, , type] of FIELDS[active]) {
        let v = form[key];
        if (type === 'number') v = Number(v);
        if (type === 'bool') v = Boolean(v);
        if (key === 'installmentPlans' && typeof v === 'string') {
          v = v.split(',').map((s) => s.trim()).filter(Boolean);
        }
        payload[key] = v;
      }
      if (active === 'academics' && form.evaluationWeights) {
        payload.evaluationWeights = Object.fromEntries(
          Object.entries(form.evaluationWeights).map(([k, v]) => [k, Number(v)]),
        );
      }
      const res = await api.put(`/settings/${active}`, payload);
      setSettings((prev) => ({ ...prev, [active]: res.data.settings }));
      setMsg({ type: 'success', text: `${active[0].toUpperCase() + active.slice(1)} settings saved` });
      if (active === 'branding') await refresh();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function previewRetention() {
    setMsg(null);
    try {
      const res = await api.get('/admin/retention/preview');
      setRetention(res.data);
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); }
  }

  async function runRetention() {
    if (!window.confirm('Permanently delete records past their retention period? This cannot be undone.')) return;
    setBusy(true); setMsg(null);
    try {
      const res = await api.post('/admin/retention/run');
      setRetention(res.data);
      setMsg({ type: 'success', text: 'Retention cleanup completed' });
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  if (!settings) return <Spinner label="Loading settings..." />;

  return (
    <div>
      <PageHeader
        title="Portal Settings"
        subtitle="Branding, academic policy, fees, feature flags and data retention"
        action={<SettingsIcon size={20} className="text-[#1e3a8a]" />}
      />
      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <Card className="p-0 overflow-hidden">
        <div className="px-5 pt-4">
          <Tabs tabs={SECTIONS} active={active} onChange={setActive} ariaLabel="Settings sections" />
        </div>

        <form onSubmit={save} className="p-5">
          <div id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(FIELDS[active] || []).map(([key, label, type]) => (
                <div key={key}>
                  <label className={labelCls} htmlFor={`set-${key}`}>{label}</label>
                  {type === 'bool' ? (
                    <label className="flex items-center gap-2.5 py-2">
                      <input
                        id={`set-${key}`}
                        type="checkbox"
                        checked={Boolean(form[key])}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                        className="w-4 h-4 accent-[#0f9d8a]"
                      />
                      <span className="text-[12px] text-[#465166]">{form[key] ? 'Enabled' : 'Disabled'}</span>
                    </label>
                  ) : type === 'color' ? (
                    <div className="flex items-center gap-2">
                      <input
                        id={`set-${key}`}
                        type="color"
                        value={form[key] || '#000000'}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        className="w-10 h-10 rounded border border-[#d8dde6] bg-white p-1 cursor-pointer"
                      />
                      <input
                        value={form[key] || ''}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        className={inputCls + ' flex-1'}
                        aria-label={label}
                      />
                    </div>
                  ) : (
                    <input
                      id={`set-${key}`}
                      type={type}
                      className={inputCls}
                      value={form[key] ?? ''}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  )}
                </div>
              ))}

              {active === 'academics' && form.evaluationWeights && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <span className={labelCls}>Evaluation weights (%) — assignments / quizzes / midterms / finals</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['assignments', 'quizzes', 'midterms', 'finals'].map((k) => (
                      <div key={k}>
                        <label className="block text-[10px] text-[#697386] mb-1 capitalize" htmlFor={`w-${k}`}>{k}</label>
                        <input
                          id={`w-${k}`}
                          type="number"
                          min={0}
                          max={100}
                          className={inputCls}
                          value={form.evaluationWeights[k] ?? 0}
                          onChange={(e) =>
                            setForm({ ...form, evaluationWeights: { ...form.evaluationWeights, [k]: Number(e.target.value) } })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-5">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save {active} settings
            </button>
          </div>
        </form>

        {active === 'retention' && (
          <div className="border-t border-[#edf0f3] p-5 bg-[#f9fafc]">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[12px] font-semibold text-[#344054]">Data retention cleanup</span>
              <button type="button" onClick={previewRetention} className={btnSecondary}>
                <Eye size={14} /> Preview
              </button>
              <button type="button" onClick={runRetention} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#d14545] hover:bg-[#b83939] text-white px-4 py-2 text-[13px] font-medium transition disabled:opacity-50">
                <Trash2 size={14} /> Run cleanup now
              </button>
            </div>
            {retention && (
              <pre className="text-[11px] text-[#465166] bg-white border border-[#e4e7ec] rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(retention.deleted || retention, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
