import { useEffect, useState } from 'react';
import { Bus, MapPin, Wallet, CheckCircle2, Loader2, LogOut } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, btnPrimary, btnDanger } from '../../components/ui/UI';

export default function Transport() {
  const [routes, setRoutes] = useState(null);
  const [mine, setMine] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([api.get('/transport/routes'), api.get('/transport/me')]).then(([r, m]) => {
      setRoutes(r.data.routes);
      setMine(m.data.allocation);
    });

  useEffect(() => {
    load().catch(() => setRoutes([]));
  }, []);

  async function enroll(routeId) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post('/transport/enroll', { routeId });
      setMsg({ type: 'success', text: `Enrolled in ${res.data.allocation.route.name}` });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/transport/leave');
      setMsg({ type: 'info', text: 'You have left the transport service' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!routes) return <Spinner label="Loading transport routes..." />;

  const activeMine = mine && mine.status === 'ACTIVE';

  return (
    <div>
      <PageHeader
        title="Transport Service"
        subtitle="University bus routes — monthly charges deducted with fee challan"
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      {activeMine && (
        <Card className="mb-4 p-0 overflow-hidden">
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-[42px] h-[42px] rounded-[10px] bg-[#1e3a8a] text-white grid place-items-center">
                <Bus size={20} />
              </div>
              <div>
                <span className="block text-[9px] text-[#697386] uppercase tracking-[0.4px]">Your Route</span>
                <strong className="block text-[14px] text-[#172033]">{mine.route.name}</strong>
                <small className="block text-[10px] text-[#697386] flex items-center gap-1 mt-0.5">
                  <MapPin size={11} /> {mine.route.stops}
                </small>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="block text-[9px] text-[#697386] uppercase">Monthly Fare</span>
                <strong className="block text-[14px] text-[#1e3a8a]">Rs. {mine.route.fare.toLocaleString()}</strong>
              </div>
              <Badge tone="green"><CheckCircle2 size={10} className="mr-1" /> Enrolled</Badge>
              <button onClick={leave} disabled={busy} className={btnDanger + ' py-1.5 px-3 text-[11px]'}>
                <LogOut size={12} /> Leave
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {routes.map((r) => {
          const myRoute = activeMine && mine.routeId === r.id;
          return (
            <Card key={r.id} className={`p-5 transition ${myRoute ? 'border-[#1e3a8a]' : 'hover:border-[#8da4f0]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-[38px] h-[38px] rounded-[9px] bg-[#edf2ff] text-[#1e3a8a] grid place-items-center shrink-0">
                    <Bus size={17} />
                  </div>
                  <div>
                    <strong className="block text-[13px] text-[#172033]">{r.name}</strong>
                    <small className="block text-[10px] text-[#98a0ae]">{r.vehicleNo || 'Vehicle TBA'}</small>
                  </div>
                </div>
                <Badge tone="blue">{r._count?.allocations || 0} riders</Badge>
              </div>

              <div className="mt-3 text-[11px] text-[#697386] flex items-start gap-1.5">
                <MapPin size={12} className="text-[#d18a17] shrink-0 mt-0.5" />
                {r.stops}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#1e3a8a]">
                  <Wallet size={14} /> Rs. {r.fare.toLocaleString()}
                  <span className="text-[10px] font-normal text-[#98a0ae]">/month</span>
                </div>
                {myRoute ? (
                  <span className="text-[11px] text-[#1e3a8a] font-medium">Current route</span>
                ) : (
                  <button
                    onClick={() => enroll(r.id)}
                    disabled={busy || activeMine}
                    className={btnPrimary + ' py-1.5 px-3 text-[11px]'}
                    title={activeMine ? 'Leave your current route first' : ''}
                  >
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Bus size={12} />}
                    {activeMine ? 'Enrolled elsewhere' : 'Enroll'}
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {!activeMine && (
        <p className="text-[10px] text-[#98a0ae] mt-3">
          Note: only one route can be active at a time. Enrolling updates your monthly transport charges.
        </p>
      )}
    </div>
  );
}
