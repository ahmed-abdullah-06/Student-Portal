import { useEffect, useState } from 'react';
import { Wallet, CheckCircle2, Clock, Loader2, FileDown, Settings2, Save } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, btnPrimary, btnSecondary, inputCls, tableHead, tableCell } from '../../components/ui/UI';
import Avatar from '../../components/shared/Avatar';

const labelCls = 'block text-[10px] font-semibold text-[#697386] uppercase tracking-[0.3px] mb-1';

function StatTile({ icon: Icon, label, value, tone }) {
  const tones = {
    teal: { bg: '#e7f8f5', fg: '#0f9d8a' },
    amber: { bg: '#fff5e3', fg: '#d18a17' },
    red: { bg: '#fde8e8', fg: '#d14545' },
  };
  const t = tones[tone] || tones.teal;
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className="w-[38px] h-[38px] rounded-[9px] grid place-items-center shrink-0" style={{ background: t.bg, color: t.fg }}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="block text-[9px] text-[#697386] uppercase tracking-[0.3px]">{label}</span>
        <strong className="block text-[15px] mt-0.5 text-[#172033] truncate">{value}</strong>
      </div>
    </Card>
  );
}

export default function FeeManagement() {
  const [challans, setChallans] = useState(null);
  const [structures, setStructures] = useState([]);
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('UNPAID');
  const [genSem, setGenSem] = useState(5);
  const [structForm, setStructForm] = useState({ semester: 5, perCreditHour: 21500, labFee: 6000, libraryFee: 3000, admissionFee: 0, otherFee: 1500 });
  const [showStruct, setShowStruct] = useState(false);

  async function load() {
    const [c, s, st] = await Promise.all([
      api.get(`/admin/challans${filter ? `?status=${filter}` : ''}`),
      api.get('/admin/fee-structures'),
      api.get('/admin/stats'),
    ]);
    setChallans(c.data.challans);
    setStructures(s.data.structures);
    setStats(st.data.stats);
  }

  useEffect(() => {
    api.get(`/admin/challans${filter ? `?status=${filter}` : ''}`).then((res) => setChallans(res.data.challans));
  }, [filter]);

  useEffect(() => {
    Promise.all([api.get('/admin/fee-structures'), api.get('/admin/stats')]).then(([s, st]) => {
      setStructures(s.data.structures);
      setStats(st.data.stats);
    });
  }, []);

  async function togglePaid(c) {
    setMsg(null);
    try {
      await api.post(`/admin/challans/${c.id}/pay`, { paid: c.status !== 'PAID' });
      setMsg({ type: 'success', text: `${c.voucherId} marked ${c.status === 'PAID' ? 'UNPAID' : 'PAID'}` });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    }
  }

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post('/admin/challans/generate', { semester: Number(genSem) });
      setMsg({ type: 'success', text: res.data.message });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function saveStructure(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.put('/admin/fee-structures', structForm);
      setMsg({ type: 'success', text: `Fee structure saved for semester ${structForm.semester}` });
      await load();
      setShowStruct(false);
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!challans || !stats) return <Spinner label="Loading fee data..." />;

  const totalUnpaid = challans.filter((c) => c.status === 'UNPAID').reduce((s, c) => s + c.totalAmount, 0);
  const totalPaid = challans.filter((c) => c.status === 'PAID').reduce((s, c) => s + c.totalAmount, 0);

  return (
    <div>
      <PageHeader
        title="Fee Management"
        subtitle="Generate challans, reconcile payments, manage fee structures"
        action={
          <button onClick={() => setShowStruct((v) => !v)} className={btnSecondary}>
            <Settings2 size={15} /> Fee Structure
          </button>
        }
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatTile icon={CheckCircle2} label="Collected (visible)" value={`Rs. ${totalPaid.toLocaleString()}`} tone="teal" />
        <StatTile icon={Clock} label="Pending (visible)" value={`Rs. ${totalUnpaid.toLocaleString()}`} tone="red" />
        <StatTile icon={Wallet} label="Total Collected (all)" value={`Rs. ${stats.collectedFees.toLocaleString()}`} tone="amber" />
      </div>

      {showStruct && (
        <Card title="Fee Structure" subtitle="Per-semester rates used for challan generation" className="mb-4 p-0 overflow-hidden">
          <form onSubmit={saveStructure} className="px-5 pt-4 pb-5 grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label className={labelCls}>Semester</label>
              <input type="number" min={1} max={8} className={inputCls} value={structForm.semester} onChange={(e) => setStructForm({ ...structForm, semester: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Per Credit Hour</label>
              <input type="number" className={inputCls} value={structForm.perCreditHour} onChange={(e) => setStructForm({ ...structForm, perCreditHour: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Lab Fee</label>
              <input type="number" className={inputCls} value={structForm.labFee} onChange={(e) => setStructForm({ ...structForm, labFee: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Library</label>
              <input type="number" className={inputCls} value={structForm.libraryFee} onChange={(e) => setStructForm({ ...structForm, libraryFee: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Other</label>
              <input type="number" className={inputCls} value={structForm.otherFee} onChange={(e) => setStructForm({ ...structForm, otherFee: Number(e.target.value) })} />
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
            </button>
          </form>
          <div className="px-5 pb-4 text-[10px] text-[#697386]">
            Defined semesters: {structures.map((s) => `Sem ${s.semester} (Rs. ${s.perCreditHour}/cr)`).join(' · ')}
          </div>
        </Card>
      )}

      <Card
        title="Challans"
        subtitle={`${challans.length} records`}
        className="p-0 overflow-hidden"
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[#d8dde6] overflow-hidden text-[11px]">
              {['UNPAID', 'PAID', ''].map((f) => (
                <button
                  key={f || 'all'}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1.5 transition border-0 ${filter === f ? 'bg-[#1e3a8a] text-white' : 'bg-white text-[#465166] hover:bg-[#f6f8fc]'}`}
                >
                  {f || 'All'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <input type="number" min={1} max={8} value={genSem} onChange={(e) => setGenSem(e.target.value)} className={inputCls + ' w-14 py-1.5 text-[11px]'} />
              <button onClick={generate} disabled={busy} className={btnPrimary + ' py-1.5 text-[11px]'}>
                {busy ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Generate
              </button>
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr>
                <th className={tableHead}>Voucher</th>
                <th className={tableHead}>Student</th>
                <th className={tableHead}>Sem</th>
                <th className={tableHead + ' text-right'}>Cr.</th>
                <th className={tableHead + ' text-right'}>Amount</th>
                <th className={tableHead}>Due</th>
                <th className={tableHead + ' text-center'}>Status</th>
                <th className={tableHead + ' text-right'}>Action</th>
              </tr>
            </thead>
            <tbody>
              {challans.map((c) => (
                <tr key={c.id} className="hover:bg-[#f9fafc]">
                  <td className={tableCell + ' font-mono text-[11px]'}>{c.voucherId}</td>
                  <td className={tableCell}>
                    <div className="flex items-center gap-2">
                      <Avatar name={c.student?.name || 'Student'} src={c.student?.photoUrl} size="h-7 w-7" />
                      <div className="text-[12px] font-medium">{c.student?.name}</div>
                    </div>
                    <div className="text-[10px] text-[#98a0ae] font-mono">{c.student?.rollNumber}</div>
                  </td>
                  <td className={tableCell}>{c.semester}</td>
                  <td className={tableCell + ' text-right'}>{c.creditHours}</td>
                  <td className={tableCell + ' text-right font-semibold'}>Rs. {c.totalAmount.toLocaleString()}</td>
                  <td className={tableCell + ' text-[11px]'}>{new Date(c.dueDate).toLocaleDateString()}</td>
                  <td className={tableCell + ' text-center'}>
                    {c.status === 'PAID' ? (
                      <Badge tone="green"><CheckCircle2 size={10} className="mr-1" /> Paid</Badge>
                    ) : (
                      <Badge tone="red"><Clock size={10} className="mr-1" /> Unpaid</Badge>
                    )}
                  </td>
                  <td className={tableCell + ' text-right'}>
                    <button
                      onClick={() => togglePaid(c)}
                      className={`py-1.5 px-2.5 text-[11px] rounded-lg border transition ${
                        c.status === 'PAID'
                          ? 'border-[#d8dde6] text-[#465166] hover:bg-[#f6f8fc]'
                          : 'border-[#c8e8d8] text-[#11875d] hover:bg-[#e9f7f0]'
                      }`}
                    >
                      {c.status === 'PAID' ? 'Mark Unpaid' : 'Mark Paid'}
                    </button>
                  </td>
                </tr>
              ))}
              {challans.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-[12px] text-[#98a0ae] py-8">No challans match this filter</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
