import { useEffect, useState } from 'react';
import { Search, Users, Send, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Alert, Card, PageHeader, inputCls, btnPrimary } from '../../components/ui/UI';

export default function AdminQuality() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [activity, setActivity] = useState(null);
  const [notice, setNotice] = useState({ title: '', body: '', department: '', batch: '', role: 'STUDENT' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return undefined; }
    const timer = setTimeout(() => api.get(`/admin/search?q=${encodeURIComponent(query.trim())}`)
      .then((res) => setResults(res.data.results)).catch((err) => setMsg({ type: 'error', text: apiMessage(err) })), 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function loadActivity(id) {
    setBusy(true); setMsg(null);
    try { const res = await api.get(`/admin/students/${id}/activity`); setActivity(res.data); }
    catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); }
    finally { setBusy(false); }
  }

  async function sendNotice(e) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const res = await api.post('/admin/notices/bulk-target', notice);
      setMsg({ type: 'success', text: `Notice sent to ${res.data.recipients} recipients` });
      setNotice({ title: '', body: '', department: '', batch: '', role: 'STUDENT' });
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); }
    finally { setBusy(false); }
  }

  const counts = activity?.activity || {};
  return <div>
    <PageHeader title="Admin operations" subtitle="Search records, review student history and target notices" />
    {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}
    <Card title="Global search" className="mb-4">
      <label className="sr-only" htmlFor="global-search">Search students, faculty, courses and notices</label>
      <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input id="global-search" value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputCls} pl-9`} placeholder="Search by name, roll number, course code or notice..." />
      </div>
      {results && <div className="mt-4 grid gap-3 md:grid-cols-2">
        {Object.entries(results).map(([type, rows]) => <section key={type} aria-labelledby={`search-${type}`}>
          <h3 id={`search-${type}`} className="text-xs font-bold uppercase text-slate-500">{type}</h3>
          {rows.length ? rows.map((row) => <button type="button" key={row.id} onClick={() => type === 'students' && loadActivity(row.id)} className="mt-1 flex w-full min-h-[44px] items-center justify-between rounded border p-2 text-left text-sm hover:bg-slate-50">
            <span>{row.name || row.title || row.courseCode}</span><span className="text-xs text-slate-500">{row.rollNumber || row.employeeId || row.department || ''}</span>
          </button>) : <p className="mt-1 text-xs text-slate-400">No matches</p>}
        </section>)}
      </div>}
    </Card>
    {activity && <Card title={`Activity: ${activity.student.name} (${activity.student.rollNumber})`} className="mb-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Enrollments', counts.enrollments?.length], ['Attendance', counts.attendance?.length],
          ['Marks', counts.records?.length], ['Fees', counts.challans?.length], ['Requests', (counts.complaints?.length || 0) + (counts.withdrawals?.length || 0) + (counts.rechecks?.length || 0) + (counts.freezes?.length || 0)],
        ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold">{value || 0}</div></div>)}
      </div>
      <div className="mt-5 max-h-64 overflow-auto">
        {counts.auditLogs?.map((item) => <div key={item.id} className="flex items-center justify-between border-b py-2 text-sm"><span>{item.action}</span><span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span></div>)}
      </div>
    </Card>}
    <Card title="Targeted notice" className="mb-4">
      <form onSubmit={sendNotice} className="grid gap-3 md:grid-cols-2">
        <input aria-label="Notice title" required className={inputCls} placeholder="Title" value={notice.title} onChange={(e) => setNotice({ ...notice, title: e.target.value })} />
        <select aria-label="Recipient role" className={inputCls} value={notice.role} onChange={(e) => setNotice({ ...notice, role: e.target.value })}><option>STUDENT</option><option>FACULTY</option><option>ALL</option></select>
        <input aria-label="Department filter" className={inputCls} placeholder="Department (optional)" value={notice.department} onChange={(e) => setNotice({ ...notice, department: e.target.value })} />
        <input aria-label="Batch filter" className={inputCls} placeholder="Batch (students only, optional)" value={notice.batch} onChange={(e) => setNotice({ ...notice, batch: e.target.value })} />
        <textarea aria-label="Notice body" required className={`${inputCls} md:col-span-2 min-h-24`} placeholder="Message" value={notice.body} onChange={(e) => setNotice({ ...notice, body: e.target.value })} />
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />} Send notice</button>
      </form>
    </Card>
    {!activity && <p className="text-xs text-slate-500"><Users size={14} className="mr-1 inline" /> Select a student result to open the complete activity dashboard.</p>}
  </div>;
}
