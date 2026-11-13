import { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, btnPrimary, btnSecondary, inputCls } from '../../components/ui/UI';

export default function Notices() {
  const [notices, setNotices] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });

  const load = () => api.get('/admin/notices').then((res) => setNotices(res.data.notices));

  useEffect(() => {
    load().catch(() => setNotices([]));
  }, []);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/admin/notices', form);
      setMsg({ type: 'success', text: 'Notice published to all portal users' });
      setForm({ title: '', body: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this notice?')) return;
    setMsg(null);
    try {
      await api.delete(`/admin/notices/${id}`);
      setMsg({ type: 'success', text: 'Notice deleted' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    }
  }

  if (!notices) return <Spinner label="Loading notices..." />;

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Publish notices shown on every student dashboard"
        action={
          <button onClick={() => setShowForm((v) => !v)} className={btnPrimary}>
            <Plus size={16} /> New Notice
          </button>
        }
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      {showForm && (
        <Card title="Publish Notice" className="mb-4 p-0 overflow-hidden">
          <form onSubmit={create} className="px-5 pt-4 pb-5 space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#344054] mb-1">Title *</label>
              <input required className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Midterm Examinations Fall 2026" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#344054] mb-1">Body *</label>
              <textarea required rows={4} className={inputCls + ' resize-none'} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Notice details..." />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />} Publish
              </button>
              <button type="button" className={btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </Card>
      )}

      <Card title={`Published Notices (${notices.length})`} className="p-0 overflow-hidden">
        <div className="px-[18px]">
          {notices.map((n) => (
            <div key={n.id} className="py-4 flex items-start justify-between gap-4 border-b border-[#e4e7ec] last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-[13px] text-[#172033]">{n.title}</h3>
                  <Badge tone="slate">{new Date(n.createdAt).toLocaleString()}</Badge>
                </div>
                <p className="text-[12px] text-[#697386] mt-1 whitespace-pre-wrap">{n.body}</p>
                <div className="text-[10px] text-[#98a0ae] mt-1">by {n.author?.email}</div>
              </div>
              <button onClick={() => remove(n.id)} className="p-2 text-[#d14545] hover:bg-[#fde8e8] rounded-lg shrink-0 border-0 bg-transparent" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {notices.length === 0 && <p className="text-[12px] text-[#98a0ae] text-center py-8">No notices published</p>}
        </div>
      </Card>
    </div>
  );
}
