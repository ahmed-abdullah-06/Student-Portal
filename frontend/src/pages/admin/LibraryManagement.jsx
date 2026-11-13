import { useEffect, useState } from 'react';
import { Plus, Search, BookOpen, RotateCcw, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import {
  Card, Spinner, Alert, Badge, PageHeader, tableHead, tableCell, inputCls, btnPrimary, btnGhost
} from '../../components/ui/UI';
import Avatar from '../../components/shared/Avatar';

const initialForm = { title: '', author: '', isbn: '', category: 'Computer Science', copiesTotal: 1 };

export default function LibraryManagement() {
  const [books, setBooks] = useState(null);
  const [issues, setIssues] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([api.get('/library/books'), api.get('/library/issues')]).then(([b, i]) => {
      setBooks(b.data.books);
      setIssues(i.data.issues);
    });

  useEffect(() => {
    load().catch(() => {
      setBooks([]);
      setIssues([]);
    });
  }, []);

  async function addBook(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/library/books', form);
      setMsg({ type: 'success', text: 'Book added to catalogue' });
      setForm(initialForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function markReturned(issueId) {
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/library/issues/${issueId}/return`);
      setMsg({ type: 'success', text: 'Book returned & fine calculated if overdue' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!books) return <Spinner label="Loading library management..." />;

  const filtered = books.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()) ||
      b.isbn.includes(search)
  );

  const activeIssues = issues.filter((i) => i.status === 'ISSUED');

  return (
    <div>
      <PageHeader
        title="Library Management"
        subtitle="Manage catalogue, issue/return books, track fines"
        action={
          <button onClick={() => setShowForm(!showForm)} className={btnPrimary}>
            <Plus size={15} /> Add Book
          </button>
        }
      />

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      {showForm && (
        <Card title="Add New Book">
          <form onSubmit={addBook} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Title</label>
              <input required className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Author</label>
              <input required className={inputCls} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">ISBN</label>
              <input required className={inputCls} value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Copies</label>
              <input type="number" min="1" required className={inputCls} value={form.copiesTotal} onChange={(e) => setForm({ ...form, copiesTotal: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="md:col-span-5 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Save Book
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          title="Active Issues"
          subtitle={`${activeIssues.length} currently issued`}
          className="lg:col-span-1"
        >
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {activeIssues.length === 0 && <p className="text-sm text-slate-400">No active issues</p>}
            {activeIssues.map((i) => (
              <div key={i.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{i.book.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-2"><Avatar name={i.student?.name || 'Student'} src={i.student?.photoUrl} size="h-6 w-6" />{i.student?.name} · {i.student?.rollNumber}</span>
                    </div>
                  </div>
                  <Badge tone={i.overdue ? 'red' : 'blue'}>{i.overdue ? 'Overdue' : 'Issued'}</Badge>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                  <span>Due {new Date(i.dueDate).toLocaleDateString()}</span>
                  {i.overdue && <span className="text-red-500 font-medium">Fine Rs. {i.fine || 0}</span>}
                </div>
                <button
                  onClick={() => markReturned(i.id)}
                  disabled={busy}
                  className={btnGhost + ' w-full mt-2 py-1 text-xs'}
                >
                  <RotateCcw size={13} /> Mark Returned
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Book Catalogue"
          subtitle={`${filtered.length} titles`}
          className="lg:col-span-2"
          action={
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search catalogue"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputCls + ' pl-8 py-1.5 text-xs w-48'}
              />
            </div>
          }
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={tableHead}>Title</th>
                  <th className={tableHead}>Author</th>
                  <th className={tableHead}>ISBN</th>
                  <th className={tableHead + ' text-center'}>Available</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className={tableCell}>
                      <span className="flex items-center gap-2 font-medium">
                        <BookOpen size={14} className="text-brand-600 dark:text-green-400 shrink-0" />
                        {b.title}
                      </span>
                    </td>
                    <td className={tableCell + ' text-xs'}>{b.author}</td>
                    <td className={tableCell + ' font-mono text-xs'}>{b.isbn}</td>
                    <td className={tableCell + ' text-center'}>
                      {b.copiesAvailable > 0 ? (
                        <Badge tone="green">{b.copiesAvailable}/{b.copiesTotal}</Badge>
                      ) : (
                        <Badge tone="red">0/{b.copiesTotal}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-sm text-slate-400 py-6">No books match</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
