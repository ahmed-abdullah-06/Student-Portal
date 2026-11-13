import { useEffect, useState } from 'react';
import { BookOpen, Search, BookMarked, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, tableHead, tableCell, inputCls } from '../../components/ui/UI';

export default function Library() {
  const [books, setBooks] = useState(null);
  const [issues, setIssues] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([api.get('/library/books'), api.get('/library/my')])
      .then(([b, m]) => {
        setBooks(b.data.books);
        setIssues(m.data.issues);
      })
      .catch(() => setBooks([]));
  }, []);

  if (!books) return <Spinner label="Loading library..." />;

  const filtered = books.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()) ||
      b.isbn.includes(search)
  );

  const active = issues.filter((i) => i.status === 'ISSUED');
  const overdue = active.filter((i) => i.overdue);

  return (
    <div>
      <PageHeader
        title="Central Library"
        subtitle="Browse the catalogue and track your issued books · max 3 books at a time"
      />

      {overdue.length > 0 && (
        <div className="mb-4">
          <Alert type="warning">
            <AlertTriangle size={13} className="inline mr-1" />
            <b>{overdue.length}</b> overdue book(s) — fine Rs. 50/day applies. Return ASAP.
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="My Issued Books" subtitle={`${active.length} active / 3 allowed`} className="lg:col-span-1 p-0 overflow-hidden">
          <div className="px-[18px] py-2 max-h-[420px] overflow-y-auto">
            {issues.length === 0 && <p className="text-[12px] text-[#98a0ae] text-center py-6">No books issued yet</p>}
            {issues.map((i) => (
              <div key={i.id} className="border border-[#e4e7ec] rounded-xl p-3 mb-2.5 last:mb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[12px] font-semibold text-[#172033]">{i.book.title}</div>
                  <Badge tone={i.status === 'RETURNED' ? 'green' : i.overdue ? 'red' : 'blue'}>
                    {i.status === 'RETURNED' ? 'Returned' : i.overdue ? 'Overdue' : 'Issued'}
                  </Badge>
                </div>
                <div className="text-[10px] text-[#697386] mt-1">{i.book.author}</div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-[#98a0ae]">
                  <span className="flex items-center gap-1">
                    <Clock size={10} /> Due {new Date(i.dueDate).toLocaleDateString()}
                  </span>
                  {i.status === 'RETURNED' && (
                    <span className="flex items-center gap-1 text-[#11875d]">
                      <CheckCircle2 size={10} /> {new Date(i.returnDate).toLocaleDateString()}
                    </span>
                  )}
                  {i.fine > 0 && <span className="text-[#d14545] font-medium">Fine Rs. {i.fine}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Book Catalogue"
          subtitle={`${filtered.length} titles`}
          className="lg:col-span-2 p-0 overflow-hidden"
          action={
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a0ae]" />
              <input
                placeholder="Search title / author / ISBN"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputCls + ' pl-8 py-1.5 text-[11px] w-48'}
              />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={tableHead}>Title</th>
                  <th className={tableHead}>Author</th>
                  <th className={tableHead}>Category</th>
                  <th className={tableHead}>ISBN</th>
                  <th className={tableHead + ' text-center'}>Available</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-[#f9fafc]">
                    <td className={tableCell}>
                      <span className="flex items-center gap-2 font-medium">
                        <BookOpen size={13} className="text-[#1e3a8a] shrink-0" />
                        {b.title}
                      </span>
                    </td>
                    <td className={tableCell + ' text-[11px]'}>{b.author}</td>
                    <td className={tableCell}>
                      <Badge tone="slate">{b.category}</Badge>
                    </td>
                    <td className={tableCell + ' font-mono text-[11px]'}>{b.isbn}</td>
                    <td className={tableCell + ' text-center'}>
                      {b.copiesAvailable > 0 ? (
                        <Badge tone="green">
                          <BookMarked size={10} className="mr-1" />
                          {b.copiesAvailable}/{b.copiesTotal}
                        </Badge>
                      ) : (
                        <Badge tone="red">All issued</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-[12px] text-[#98a0ae] py-8">No books match your search</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-[18px] py-3 border-t border-[#edf0f3] text-[10px] text-[#98a0ae]">
            Visit the circulation desk with your student ID card to borrow books · Loan period 14 days
          </p>
        </Card>
      </div>
    </div>
  );
}
