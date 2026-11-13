import { useEffect, useState } from 'react';
import { Building2, DoorOpen, UtensilsCrossed, CheckCircle2, XCircle, Search } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import {
  Card, Spinner, Alert, Badge, PageHeader, tableHead, tableCell, inputCls, btnPrimary, btnGhost
} from '../../components/ui/UI';
import Avatar from '../../components/shared/Avatar';

export default function HostelManagement() {
  const [allocations, setAllocations] = useState(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api.get('/hostel/all').then((res) => setAllocations(res.data.allocations));

  useEffect(() => {
    load().catch(() => setAllocations([]));
  }, []);

  async function approve(id) {
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/hostel/allocations/${id}/approve`);
      setMsg({ type: 'success', text: 'Hostel application approved' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function release(id) {
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/hostel/allocations/${id}/release`);
      setMsg({ type: 'success', text: 'Room released' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!allocations) return <Spinner label="Loading hostel allocations..." />;

  const filtered = allocations.filter(
    (a) =>
      a.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.student?.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
      a.block?.toLowerCase().includes(search.toLowerCase()) ||
      a.roomNo?.toLowerCase().includes(search.toLowerCase())
  );

  const pending = allocations.filter((a) => a.status === 'REQUESTED');
  const active = allocations.filter((a) => a.status === 'ACTIVE');

  return (
    <div>
      <PageHeader
        title="Hostel Management"
        subtitle="Approve applications, manage room allocations & release rooms"
      />

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          title="All Allocations"
          subtitle={`${active.length} active · ${pending.length} pending`}
          className="lg:col-span-2"
          action={
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search student / block / room"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputCls + ' pl-8 py-1.5 text-xs w-48'}
              />
            </div>
          }
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className={tableHead}>Student</th>
                  <th className={tableHead}>Block</th>
                  <th className={tableHead}>Room</th>
                  <th className={tableHead}>Mess (Rs/mo)</th>
                  <th className={tableHead}>Status</th>
                  <th className={tableHead + ' text-right'}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className={tableCell}>
                      <div className="flex items-center gap-2"><Avatar name={a.student?.name || 'Student'} src={a.student?.photoUrl} size="h-7 w-7" /><div className="font-medium">{a.student?.name}</div></div>
                      <div className="text-[11px] text-slate-400">{a.student?.rollNumber}</div>
                    </td>
                    <td className={tableCell}>
                      <span className="flex items-center gap-1">
                        <Building2 size={13} className="text-brand-600 dark:text-green-400" />
                        {a.block}
                      </span>
                    </td>
                    <td className={tableCell}>
                      <span className="flex items-center gap-1">
                        <DoorOpen size={13} className="text-blue-500" />
                        {a.roomNo}
                      </span>
                    </td>
                    <td className={tableCell}>
                      <span className="flex items-center gap-1">
                        <UtensilsCrossed size={13} className="text-amber-500" />
                        {a.messCharges.toLocaleString()}
                      </span>
                    </td>
                    <td className={tableCell}>
                      <Badge tone={a.status === 'ACTIVE' ? 'green' : a.status === 'REQUESTED' ? 'amber' : 'slate'}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className={tableCell + ' text-right'}>
                      <div className="flex gap-1 justify-end">
                        {a.status === 'REQUESTED' && (
                          <button onClick={() => approve(a.id)} disabled={busy} className={btnPrimary + ' py-1 px-2 text-xs'}>
                            <CheckCircle2 size={12} /> Approve
                          </button>
                        )}
                        {a.status === 'ACTIVE' && (
                          <button onClick={() => release(a.id)} disabled={busy} className={btnGhost + ' text-red-600 dark:text-red-400 py-1 px-2 text-xs'}>
                            <XCircle size={12} /> Release
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-sm text-slate-400 py-6">No allocations found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Summary">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 dark:bg-slate-800 border border-green-100 dark:border-slate-700 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{active.length}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Active Residents</div>
            </div>
            <div className="bg-amber-50 dark:bg-slate-800 border border-amber-100 dark:border-slate-700 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{pending.length}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pending Requests</div>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Occupied Blocks</h3>
            {['Hostel-A', 'Hostel-B', 'Hostel-C', 'Hostel-D'].map((block) => {
              const count = active.filter((a) => a.block === block).length;
              const total = allocations.filter((a) => a.block === block).length;
              return (
                <div key={block} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{block}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{count} / {total || '—'}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-xs text-slate-400">
            Mess charges are bundled into monthly fee challans. Approving a request sends a confirmation notification to the student.
          </p>
        </Card>
      </div>
    </div>
  );
}
