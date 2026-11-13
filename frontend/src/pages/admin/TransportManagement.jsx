import { useEffect, useState } from 'react';
import { Bus, MapPin, Wallet, Plus, Trash2, Search, Loader2, Users } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import {
  Card, Spinner, Alert, Badge, PageHeader, tableHead, tableCell, inputCls, btnPrimary, btnGhost
} from '../../components/ui/UI';
import Avatar from '../../components/shared/Avatar';

const initialForm = { name: '', stops: '', fare: 5000, vehicleNo: '' };

export default function TransportManagement() {
  const [routes, setRoutes] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([api.get('/transport/routes'), api.get('/transport/allocations')]).then(([r, a]) => {
      setRoutes(r.data.routes);
      setAllocations(a.data.allocations);
    });

  useEffect(() => {
    load().catch(() => {
      setRoutes([]);
      setAllocations([]);
    });
  }, []);

  async function addRoute(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/transport/routes', form);
      setMsg({ type: 'success', text: 'Transport route created' });
      setForm(initialForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function deleteRoute(id) {
    setBusy(true);
    setMsg(null);
    try {
      await api.delete(`/transport/routes/${id}`);
      setMsg({ type: 'success', text: 'Route deleted' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function removeAllocation(id) {
    setBusy(true);
    setMsg(null);
    try {
      await api.delete(`/transport/allocations/${id}`);
      setMsg({ type: 'success', text: 'Student removed from transport' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!routes) return <Spinner label="Loading transport management..." />;

  const filtered = routes.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.stops.toLowerCase().includes(search.toLowerCase())
  );

  const activeAlloc = allocations.filter((a) => a.status === 'ACTIVE');
  const totalRevenue = activeAlloc.reduce((sum, a) => sum + (a.route?.fare || 0), 0);

  return (
    <div>
      <PageHeader
        title="Transport Management"
        subtitle="Manage bus routes, fares, and student enrollments"
        action={
          <button onClick={() => setShowForm(!showForm)} className={btnPrimary}>
            <Plus size={15} /> Add Route
          </button>
        }
      />

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      {showForm && (
        <Card title="Add New Route">
          <form onSubmit={addRoute} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Route Name</label>
              <input required placeholder="e.g. Route A: City Center" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Stops (comma-separated)</label>
              <input required placeholder="e.g. Faqerpur, Wah Cantt, Main Campus" className={inputCls} value={form.stops} onChange={(e) => setForm({ ...form, stops: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Monthly Fare (Rs)</label>
              <input type="number" min="0" required className={inputCls} value={form.fare} onChange={(e) => setForm({ ...form, fare: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Vehicle No.</label>
              <input placeholder="e.g. ICT-1234" className={inputCls} value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} />
            </div>
            <div className="md:col-span-2 flex gap-2 justify-end items-end">
              <button type="button" onClick={() => setShowForm(false)} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Save Route
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          title="Routes"
          subtitle={`${filtered.length} routes`}
          className="lg:col-span-2"
          action={
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search routes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputCls + ' pl-8 py-1.5 text-xs w-40'}
              />
            </div>
          }
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={tableHead}>Route</th>
                  <th className={tableHead}>Stops</th>
                  <th className={tableHead}>Fare (Rs/mo)</th>
                  <th className={tableHead + ' text-center'}>Riders</th>
                  <th className={tableHead + ' text-right'}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const riders = activeAlloc.filter((a) => a.routeId === r.id).length;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className={tableCell}>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                            <Bus size={15} />
                          </div>
                          <div>
                            <div className="font-medium">{r.name}</div>
                            <div className="text-[11px] text-slate-400">{r.vehicleNo || 'Vehicle TBA'}</div>
                          </div>
                        </div>
                      </td>
                      <td className={tableCell}>
                        <span className="flex items-center gap-1 text-xs">
                          <MapPin size={12} className="text-gold-500 shrink-0" />
                          {r.stops}
                        </span>
                      </td>
                      <td className={tableCell}>
                        <span className="flex items-center gap-1 font-medium">
                          <Wallet size={13} className="text-brand-600 dark:text-green-400" />
                          {r.fare.toLocaleString()}
                        </span>
                      </td>
                      <td className={tableCell + ' text-center'}>
                        <Badge tone="blue">
                          <Users size={11} className="mr-1" />
                          {riders}
                        </Badge>
                      </td>
                      <td className={tableCell + ' text-right'}>
                        <button
                          onClick={() => deleteRoute(r.id)}
                          disabled={busy || riders > 0}
                          className={btnGhost + ' text-red-600 dark:text-red-400 py-1 px-2 text-xs'}
                          title={riders > 0 ? 'Cannot delete route with active riders' : 'Delete route'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-sm text-slate-400 py-6">No routes found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Active Enrollments" subtitle={`${activeAlloc.length} students`}>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {activeAlloc.length === 0 && <p className="text-sm text-slate-400">No active enrollments</p>}
            {activeAlloc.map((a) => (
              <div key={a.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2"><Avatar name={a.student?.name || 'Student'} src={a.student?.photoUrl} size="h-7 w-7" /><div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.student?.name}</div></div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{a.student?.rollNumber}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Bus size={11} /> {a.route?.name}
                    </div>
                  </div>
                  <button
                    onClick={() => removeAllocation(a.id)}
                    disabled={busy}
                    className={btnGhost + ' text-red-600 dark:text-red-400 py-1 px-2 text-xs'}
                    title="Remove enrollment"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-400">Monthly Transport Revenue (Active)</div>
            <div className="text-2xl font-bold text-brand-700 dark:text-green-400 mt-1">
              Rs. {totalRevenue.toLocaleString()}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
