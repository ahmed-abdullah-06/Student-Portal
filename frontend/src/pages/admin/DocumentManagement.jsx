import { useEffect, useState } from 'react';
import { Upload, Trash2, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, PageHeader, btnPrimary, btnDanger, inputCls, Badge, tableHead, tableCell } from '../../components/ui/UI';

export default function DocumentManagement() {
  const [docs, setDocs] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', category: 'Academic', description: '' });

  async function load() {
    const res = await api.get('/documents');
    setDocs(res.data.documents);
  }

  useEffect(() => { load().catch(() => setDocs([])); }, []);

  async function upload(e) {
    e.preventDefault();
    if (!file) { setMsg({ type: 'error', text: 'Choose a file first' }); return; }
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title);
      fd.append('category', form.category);
      fd.append('description', form.description);
      await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg({ type: 'success', text: 'Document uploaded' });
      setForm({ title: '', category: 'Academic', description: '' });
      setFile(null);
      e.target.reset();
      await load();
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm('Delete this document?')) return;
    try { await api.delete(`/documents/${id}`); await load(); } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); }
  }

  if (!docs) return <Spinner label="Loading documents..." />;

  return (
    <div>
      <PageHeader title="Document Manager" subtitle="Upload and manage downloadable files for students" />
      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <Card title="Upload Document" className="mb-4">
        <form onSubmit={upload} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div><label className="block text-xs text-slate-600 mb-1">Title *</label><input required className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="block text-xs text-slate-600 mb-1">Category</label>
            <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option>Academic</option><option>Forms</option><option>Policies</option><option>Fees</option><option>Hostel</option><option>Other</option>
            </select>
          </div>
          <div><label className="block text-xs text-slate-600 mb-1">File *</label>
            <input type="file" accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" required onChange={(e) => setFile(e.target.files[0])} className={inputCls + ' text-[11px]'} />
          </div>
          <div><button type="submit" disabled={busy} className={btnPrimary + ' w-full justify-center'}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload</button></div>
        </form>
      </Card>

      <Card title={`Documents (${docs.length})`} className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr>
              <th className={tableHead}>Title</th><th className={tableHead}>Category</th><th className={tableHead}>File</th>
              <th className={tableHead}>Size</th><th className={tableHead}>Uploaded</th><th className={tableHead}></th>
            </tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-[#f9fafc]">
                  <td className={tableCell + ' font-semibold'}>{d.title}</td>
                  <td className={tableCell}><Badge tone="blue">{d.category}</Badge></td>
                  <td className={tableCell + ' text-[11px] text-[#697386]'}>
                    {/^image\//.test(d.mimeType || '') && d.url ? <img src={d.url} alt={`${d.title} preview`} className="h-8 w-8 rounded object-cover inline-block mr-2" loading="lazy" /> : null}
                    {d.fileName}
                  </td>
                  <td className={tableCell}>{Math.round((d.sizeBytes || 0) / 1024)} KB</td>
                  <td className={tableCell}>{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td className={tableCell}><button onClick={() => remove(d.id)} className={btnDanger + ' py-1 px-2 text-[10px]'}><Trash2 size={11} /></button></td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-sm text-[#98a0ae]">No documents uploaded</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
