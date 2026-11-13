import { useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, PageHeader, Tabs, btnPrimary, inputCls, Badge, tableHead, tableCell } from '../../components/ui/UI';

export default function MasterData() {
  const [tab, setTab] = useState('Campuses');
  const [data, setData] = useState({ campuses: [], departments: [], programs: [] });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [campusForm, setCampusForm] = useState({ name: '', city: '', address: '' });
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [progForm, setProgForm] = useState({ name: '', code: '', degreeLevel: 'BS', totalCredits: 133, campusId: '', departmentId: '' });

  async function load() {
    setLoading(true);
    try {
      const [c, d, p] = await Promise.all([
        api.get('/admin/campuses'),
        api.get('/admin/departments'),
        api.get('/admin/programs'),
      ]);
      setData({ campuses: c.data.campuses || [], departments: d.data.departments || [], programs: p.data.programs || [] });
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function createCampus(e) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { await api.post('/admin/campuses', campusForm); setMsg({ type: 'success', text: 'Campus created' }); setCampusForm({ name: '', city: '', address: '' }); await load(); }
    catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  async function createDept(e) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { await api.post('/admin/departments', deptForm); setMsg({ type: 'success', text: 'Department created' }); setDeptForm({ name: '', code: '' }); await load(); }
    catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  async function createProg(e) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api.post('/admin/programs', { ...progForm, totalCredits: Number(progForm.totalCredits), campusId: progForm.campusId || null, departmentId: progForm.departmentId || null });
      setMsg({ type: 'success', text: 'Program created' });
      setProgForm({ name: '', code: '', degreeLevel: 'BS', totalCredits: 133, campusId: '', departmentId: '' });
      await load();
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  if (loading) return <Spinner label="Loading master data..." />;

  return (
    <div>
      <PageHeader title="Master Data" subtitle="Campuses, departments and degree programs" />
      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <Card className="p-0 overflow-hidden">
        <Tabs tabs={['Campuses', 'Departments', 'Programs']} active={tab} onChange={setTab} />
        <div className="p-5">
          {tab === 'Campuses' && (
            <>
              <form onSubmit={createCampus} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
                <input required placeholder="Campus name" className={inputCls} value={campusForm.name} onChange={(e) => setCampusForm({ ...campusForm, name: e.target.value })} />
                <input required placeholder="City" className={inputCls} value={campusForm.city} onChange={(e) => setCampusForm({ ...campusForm, city: e.target.value })} />
                <input placeholder="Address" className={inputCls} value={campusForm.address} onChange={(e) => setCampusForm({ ...campusForm, address: e.target.value })} />
                <button type="submit" disabled={busy} className={btnPrimary + ' justify-center'}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add</button>
              </form>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead><tr><th className={tableHead}>Name</th><th className={tableHead}>City</th><th className={tableHead}>Address</th><th className={tableHead}>Status</th></tr></thead>
                  <tbody>{data.campuses.map((c) => (
                    <tr key={c.id} className="hover:bg-[#f9fafc]"><td className={tableCell + ' font-semibold'}>{c.name}</td><td className={tableCell}>{c.city}</td><td className={tableCell}>{c.address || '—'}</td><td className={tableCell}><Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Active' : 'Inactive'}</Badge></td></tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'Departments' && (
            <>
              <form onSubmit={createDept} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <input required placeholder="Department name" className={inputCls} value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
                <input required placeholder="Code (e.g. BSCS)" className={inputCls} value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })} />
                <button type="submit" disabled={busy} className={btnPrimary + ' justify-center'}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add</button>
              </form>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead><tr><th className={tableHead}>Name</th><th className={tableHead}>Code</th><th className={tableHead}>Status</th></tr></thead>
                  <tbody>{data.departments.map((d) => (
                    <tr key={d.id} className="hover:bg-[#f9fafc]"><td className={tableCell + ' font-semibold'}>{d.name}</td><td className={tableCell + ' font-mono'}>{d.code}</td><td className={tableCell}><Badge tone={d.isActive ? 'green' : 'gray'}>{d.isActive ? 'Active' : 'Inactive'}</Badge></td></tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'Programs' && (
            <>
              <form onSubmit={createProg} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                <input required placeholder="Program name" className={inputCls} value={progForm.name} onChange={(e) => setProgForm({ ...progForm, name: e.target.value })} />
                <input required placeholder="Code (BS-CS)" className={inputCls} value={progForm.code} onChange={(e) => setProgForm({ ...progForm, code: e.target.value.toUpperCase() })} />
                <select className={inputCls} value={progForm.degreeLevel} onChange={(e) => setProgForm({ ...progForm, degreeLevel: e.target.value })}><option>BS</option><option>MS</option><option>PHD</option><option>MPhil</option></select>
                <input type="number" placeholder="Credits" className={inputCls} value={progForm.totalCredits} onChange={(e) => setProgForm({ ...progForm, totalCredits: e.target.value })} />
                <select className={inputCls} value={progForm.campusId} onChange={(e) => setProgForm({ ...progForm, campusId: e.target.value })}><option value="">Campus</option>{data.campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <button type="submit" disabled={busy} className={btnPrimary + ' justify-center col-span-full sm:col-span-1'}>{busy ? <Loader2 size={14} /> : <Plus size={14} />}</button>
              </form>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead><tr><th className={tableHead}>Name</th><th className={tableHead}>Code</th><th className={tableHead}>Level</th><th className={tableHead}>Credits</th><th className={tableHead}>Campus</th></tr></thead>
                  <tbody>{data.programs.map((p) => (
                    <tr key={p.id} className="hover:bg-[#f9fafc]"><td className={tableCell + ' font-semibold'}>{p.name}</td><td className={tableCell + ' font-mono'}>{p.code}</td><td className={tableCell}>{p.degreeLevel}</td><td className={tableCell}>{p.totalCredits}</td><td className={tableCell}>{p.campus?.name || '—'}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
