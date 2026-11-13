import { useEffect, useState } from 'react';
import { Plus, Loader2, Award } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, PageHeader, btnPrimary, inputCls, Badge, tableHead, tableCell } from '../../components/ui/UI';

export default function ScholarshipManagement() {
  const [scholarships, setScholarships] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', amount: '', eligibility: '', deadline: '' });

  async function load() {
    const res = await api.get('/admin/scholarships');
    setScholarships(res.data.scholarships);
  }

  useEffect(() => { load().catch(() => setScholarships([])); }, []);

  async function create(e) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api.post('/admin/scholarships', { ...form, amount: Number(form.amount) });
      setMsg({ type: 'success', text: 'Scholarship created' });
      setForm({ title: '', description: '', amount: '', eligibility: '', deadline: '' });
      await load();
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  if (!scholarships) return <Spinner label="Loading scholarships..." />;

  return (
    <div>
      <PageHeader title="Scholarships" subtitle="Create and manage scholarship opportunities" action={<Award size={20} className="text-[#d18a17]" />} />
      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <Card title="Create Scholarship" className="mb-4">
        <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><label className="block text-xs text-slate-600 mb-1">Title *</label><input required className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="block text-xs text-slate-600 mb-1">Amount (PKR) *</label><input type="number" required min={1} className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><label className="block text-xs text-slate-600 mb-1">Deadline *</label><input type="date" required className={inputCls} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          <div className="lg:col-span-3"><label className="block text-xs text-slate-600 mb-1">Description *</label><textarea required rows={2} className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="lg:col-span-2"><label className="block text-xs text-slate-600 mb-1">Eligibility *</label><input required className={inputCls} value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} placeholder="CGPA ≥ 3.5 · No dues" /></div>
          <div className="flex items-end"><button type="submit" disabled={busy} className={btnPrimary + ' w-full justify-center'}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create</button></div>
        </form>
      </Card>

      <Card title={`Scholarships (${scholarships.length})`} className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr>
              <th className={tableHead}>Title</th><th className={tableHead}>Amount</th><th className={tableHead}>Eligibility</th>
              <th className={tableHead}>Deadline</th><th className={tableHead}>Applications</th><th className={tableHead}>Status</th>
            </tr></thead>
            <tbody>
              {scholarships.map((s) => (
                <tr key={s.id} className="hover:bg-[#f9fafc]">
                  <td className={tableCell + ' font-semibold'}>{s.title}</td>
                  <td className={tableCell}>PKR {s.amount?.toLocaleString()}</td>
                  <td className={tableCell + ' text-[11px] text-[#697386]'}>{s.eligibility}</td>
                  <td className={tableCell}>{new Date(s.deadline).toLocaleDateString()}</td>
                  <td className={tableCell}>{s._count?.applications ?? 0}</td>
                  <td className={tableCell}><Badge tone={s.isActive ? 'green' : 'gray'}>{s.isActive ? 'Active' : 'Closed'}</Badge></td>
                </tr>
              ))}
              {scholarships.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-sm text-[#98a0ae]">No scholarships yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
