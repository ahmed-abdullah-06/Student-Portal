import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck, LogOut, Plus, Building2, Users, GraduationCap, RefreshCw, Search, Pencil,
} from 'lucide-react';
import platformApi, { getPlatformToken, setPlatformToken } from '../../services/platformApi';
import {
  Card, StatCard, Badge, Alert, Spinner, EmptyState, Modal, Field,
  tableHead, tableCell, inputCls, btnPrimary, btnSecondary, btnDanger, btnGhost,
} from '../../components/ui/UI';

const statusTone = { ACTIVE: 'green', SUSPENDED: 'red' };

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await platformApi.post('/platform/login', { email, password });
      setPlatformToken(res.data.token);
      onLogin(res.data.admin);
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d2358] grid place-items-center p-5">
      <form onSubmit={submit} className="bg-white rounded-xl w-full max-w-[420px] p-7 shadow-[0_24px_60px_rgba(0,0,0,.35)]">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-[10px] bg-[#1e3a8a] text-white grid place-items-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-[14px] font-bold text-[#172033] leading-tight">Platform Console</div>
            <div className="text-[10px] uppercase tracking-[1.4px] text-[#697386]">SaaS operator access</div>
          </div>
        </div>

        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

        <Field label="Operator email">
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="platform@novastra.edu.pk" />
        </Field>
        <Field label="Password">
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
        </Field>

        <button type="submit" disabled={busy} className={`${btnPrimary} w-full justify-center`}>
          {busy ? 'Signing in...' : 'Sign in to console'}
        </button>
        <p className="text-[10px] text-[#98a0ae] text-center mt-4">
          Platform operators manage universities across the entire deployment.
        </p>
      </form>
    </div>
  );
}

function TenantForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    slug: '', name: '', domain: '', plan: 'standard',
    adminEmail: '', adminPassword: '', maxStudents: '', maxFaculty: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        slug: form.slug.trim().toLowerCase(),
        name: form.name.trim(),
        domain: form.domain.trim() || null,
        plan: form.plan,
        adminEmail: form.adminEmail.trim().toLowerCase(),
        adminPassword: form.adminPassword,
        maxStudents: form.maxStudents === '' ? null : Number(form.maxStudents),
        maxFaculty: form.maxFaculty === '' ? null : Number(form.maxFaculty),
      };
      await platformApi.post('/platform/tenants', payload);
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create tenant');
      setBusy(false);
    }
  }

  return (
    <Modal title="New university" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Slug (subdomain key)">
            <input required value={form.slug} onChange={set('slug')} className={inputCls} placeholder="novastra-north" />
          </Field>
          <Field label="Plan">
            <select value={form.plan} onChange={set('plan')} className={inputCls}>
              <option value="starter">Starter</option>
              <option value="standard">Standard</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </Field>
        </div>
        <Field label="University name">
          <input required value={form.name} onChange={set('name')} className={inputCls} placeholder="Novastra University North Campus" />
        </Field>
        <Field label="Custom domain (optional)" hint="Used for subdomain/custom-domain routing and support email.">
          <input value={form.domain} onChange={set('domain')} className={inputCls} placeholder="vehari.example.edu.pk" />
        </Field>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="First admin email">
            <input type="email" required value={form.adminEmail} onChange={set('adminEmail')} className={inputCls} placeholder="admin@vehari.edu.pk" />
          </Field>
          <Field label="Admin password">
            <input type="text" required minLength={8} value={form.adminPassword} onChange={set('adminPassword')} className={inputCls} placeholder="min. 8 characters" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Max students (optional)" hint="Overrides the plan limit.">
            <input type="number" min="0" value={form.maxStudents} onChange={set('maxStudents')} className={inputCls} placeholder="plan default" />
          </Field>
          <Field label="Max faculty (optional)" hint="Overrides the plan limit.">
            <input type="number" min="0" value={form.maxFaculty} onChange={set('maxFaculty')} className={inputCls} placeholder="plan default" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Creating...' : 'Create university'}</button>
        </div>
      </form>
    </Modal>
  );
}

function LimitsForm({ tenant, onClose, onSaved }) {
  const [plan, setPlan] = useState(tenant.plan);
  const [maxStudents, setMaxStudents] = useState(tenant.usage?.limits?.maxStudents ?? '');
  const [maxFaculty, setMaxFaculty] = useState(tenant.usage?.limits?.maxFaculty ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await platformApi.patch(`/platform/tenants/${tenant.id}`, {
        plan,
        maxStudents: maxStudents === '' ? null : Number(maxStudents),
        maxFaculty: maxFaculty === '' ? null : Number(maxFaculty),
      });
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update');
      setBusy(false);
    }
  }

  return (
    <Modal title={`Plan & limits — ${tenant.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <Field label="Plan">
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls}>
            <option value="starter">Starter</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Max students" hint="Empty = plan default">
            <input type="number" min="0" value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Max faculty" hint="Empty = plan default">
            <input type="number" min="0" value={maxFaculty} onChange={(e) => setMaxFaculty(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function PlatformConsole() {
  const [admin, setAdmin] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState({});
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editLimits, setEditLimits] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [me, s, t] = await Promise.all([
        platformApi.get('/platform/me'),
        platformApi.get('/platform/stats'),
        platformApi.get('/platform/tenants', { params: search ? { search, limit: 100 } : { limit: 100 } }),
      ]);
      setAdmin(me.data.admin);
      setStats(s.data.stats);
      setPlans(s.data.plans || {});
      setTenants(t.data.tenants || []);
    } catch (err) {
      if (err.response?.status !== 401) setError(err?.response?.data?.message || 'Failed to load platform data');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const onUnauthorized = () => { setAdmin(null); setAuthChecked(true); };
    window.addEventListener('platform:unauthorized', onUnauthorized);
    return () => window.removeEventListener('platform:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (!getPlatformToken()) {
      setAuthChecked(true);
      return;
    }
    load().finally(() => setAuthChecked(true));
  }, [load]);

  function logout() {
    setPlatformToken(null);
    setAdmin(null);
  }

  async function toggleStatus(tenant) {
    const status = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (status === 'SUSPENDED' && !window.confirm(`Suspend ${tenant.name}? Its users will be locked out immediately.`)) return;
    try {
      await platformApi.patch(`/platform/tenants/${tenant.id}`, { status });
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update status');
    }
  }

  if (!getPlatformToken() && !admin) {
    return <LoginScreen onLogin={(a) => { setAdmin(a); setAuthChecked(true); load(); }} />;
  }
  if (!authChecked && !admin) return <Spinner label="Checking platform session..." />;

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <header className="bg-[#0d2358] text-white">
        <div className="max-w-[1200px] mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[9px] bg-white/10 grid place-items-center">
              <ShieldCheck size={17} />
            </div>
            <div>
              <div className="text-[14px] font-bold leading-tight">Platform Console</div>
              <div className="text-[10px] text-white/60">{admin?.email || 'operator'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-lg hover:bg-white/10" aria-label="Refresh" title="Refresh">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-lg hover:bg-white/10">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-5 py-6 space-y-5">
        {error && <Alert type="error">{error}</Alert>}

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Universities" value={stats.tenants} icon={Building2} meta={`${stats.activeTenants} active · ${stats.suspendedTenants} suspended`} />
            <StatCard label="Users" value={stats.users} icon={Users} tone="teal" />
            <StatCard label="Students" value={stats.students} icon={GraduationCap} />
            <StatCard label="Faculty" value={stats.faculty} icon={Users} tone="teal" />
            <StatCard
              label="By plan"
              value={Object.entries(stats.tenantsByPlan).map(([p, n]) => `${p}: ${n}`).join(' · ') || '—'}
              icon={Building2}
              tone="slate"
            />
          </div>
        )}

        <Card
          title="Universities"
          subtitle="Create, suspend and manage tenants across the platform"
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#98a0ae]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or slug"
                  className={`${inputCls} pl-8 w-[200px] py-2`}
                />
              </div>
              <button onClick={() => setShowCreate(true)} className={btnPrimary}>
                <Plus size={14} /> New university
              </button>
            </div>
          }
        >
          {tenants.length === 0 && !loading ? (
            <EmptyState message="No tenants found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={tableHead}>University</th>
                    <th className={tableHead}>Status</th>
                    <th className={tableHead}>Plan</th>
                    <th className={tableHead}>Usage</th>
                    <th className={tableHead}>Limits</th>
                    <th className={tableHead}>Created</th>
                    <th className={tableHead}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id}>
                      <td className={tableCell}>
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-[11px] text-[#98a0ae] font-mono">{t.slug}{t.domain ? ` · ${t.domain}` : ''}</div>
                      </td>
                      <td className={tableCell}><Badge tone={statusTone[t.status] || 'gray'}>{t.status}</Badge></td>
                      <td className={tableCell}>{plans[t.plan]?.label || t.plan}</td>
                      <td className={tableCell}>
                        <div className="text-[11px]">{t.usage.students} students · {t.usage.faculty} faculty</div>
                        <div className="text-[11px] text-[#98a0ae]">{t.usage.users} users</div>
                      </td>
                      <td className={tableCell}>
                        <div className="text-[11px]">
                          {t.usage.limits.maxStudents == null ? '∞' : t.usage.limits.maxStudents} students
                        </div>
                        <div className="text-[11px] text-[#98a0ae]">
                          {t.usage.limits.maxFaculty == null ? '∞' : t.usage.limits.maxFaculty} faculty
                        </div>
                      </td>
                      <td className={tableCell}>{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td className={tableCell}>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setEditLimits(t)} className={`${btnGhost} px-2.5 py-1.5`} title="Plan & limits">
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => toggleStatus(t)}
                            className={`${t.status === 'ACTIVE' ? btnDanger : btnSecondary} px-2.5 py-1.5`}
                          >
                            {t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>

      {showCreate && (
        <TenantForm
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
      {editLimits && (
        <LimitsForm
          tenant={editLimits}
          onClose={() => setEditLimits(null)}
          onSaved={() => { setEditLimits(null); load(); }}
        />
      )}
    </div>
  );
}
