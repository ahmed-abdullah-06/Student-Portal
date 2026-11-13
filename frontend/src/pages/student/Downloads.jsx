import { useEffect, useState } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import api from '../../services/api';
import { Card, Spinner, PageHeader, Badge, inputCls, btnSecondary } from '../../components/ui/UI';

export default function Downloads() {
  const [docs, setDocs] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    api.get('/documents').then((res) => setDocs(res.data.documents)).catch(() => setDocs([]));
  }, []);

  if (!docs) return <Spinner label="Loading documents..." />;

  const categories = ['All', ...new Set(docs.map((d) => d.category))];
  const filtered = docs.filter(
    (d) =>
      (category === 'All' || d.category === category) &&
      (d.title.toLowerCase().includes(search.toLowerCase()) || d.fileName.toLowerCase().includes(search.toLowerCase()))
  );

  function download(doc) {
    const token = localStorage.getItem('token');
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => {});
  }

  return (
    <div>
      <PageHeader title="Downloads" subtitle="Academic forms, policies and student resources" />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a0ae]" />
          <input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls + ' pl-9'} />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls + ' w-auto'}>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5">
          {filtered.map((f) => (
            <div key={f.id} className="flex items-center gap-3.5 py-3.5 border-b border-[#e4e7ec] last:border-0">
              <div className="w-[39px] h-[39px] rounded-[7px] bg-[#edf2ff] text-[#1e3a8a] grid place-items-center shrink-0">
                <FileText size={18} />
              </div>
              <span className="flex-1 min-w-0">
                <strong className="text-[12px] text-[#172033] block truncate">{f.title}</strong>
                <small className="text-[10px] text-[#98a0ae] block mt-0.5">
                  {f.category} • {f.fileName} • {Math.round((f.sizeBytes || 0) / 1024)} KB
                </small>
              </span>
              <Badge tone="blue">{f.category}</Badge>
              <button onClick={() => download(f)} className={btnSecondary + ' py-1.5 px-3 text-[11px]'}>
                <Download size={14} /> Download
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-[#98a0ae]">No documents found</p>
          )}
        </div>
      </Card>
    </div>
  );
}
