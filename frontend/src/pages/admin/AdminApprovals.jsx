import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, Tabs, btnPrimary, btnDanger, inputCls } from '../../components/ui/UI';

function ApproveRow({ item, cols, onResolve }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function resolve(status) {
    setBusy(true);
    try {
      await onResolve(item.id, status, note);
    } catch (err) {
      alert(apiMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3 border-b border-[#edf0f3] last:border-0">
      <div className="flex-1 min-w-[200px]">
        {cols.map(({ key, label }) => (
          <div key={key} className="text-[11px]">
            <span className="text-[#697386]">{label}: </span>
            <strong className="text-[#172033]">{item[key] ?? '—'}</strong>
          </div>
        ))}
        {item.status && <div className="mt-1"><Badge tone={item.status === 'PENDING' || item.status === 'OPEN' ? 'amber' : item.status === 'REJECTED' ? 'red' : 'green'}>{item.status}</Badge></div>}
      </div>
      {item.status === 'PENDING' || item.status === 'OPEN' ? (
        <div className="flex items-center gap-2">
          <input placeholder="Admin note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className={inputCls + ' w-44 text-[11px] py-1.5'} />
          <button onClick={() => resolve('APPROVED')} disabled={busy} className={btnPrimary + ' py-1.5 px-2.5 text-[11px]'}><Check size={13} /> Approve</button>
          <button onClick={() => resolve('REJECTED')} disabled={busy} className={btnDanger + ' py-1.5 px-2.5 text-[11px]'}><X size={13} /> Reject</button>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminApprovals() {
  const [tab, setTab] = useState('Re-checks');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [re, fr, ins, ref, apps, cert, proofs] = await Promise.all([
        api.get('/admin/rechecks').catch(() => ({ data: { rechecks: [] } })),
        api.get('/admin/freezes').catch(() => ({ data: { freezes: [] } })),
        api.get('/admin/installments').catch(() => ({ data: { requests: [] } })),
        api.get('/admin/refunds').catch(() => ({ data: { requests: [] } })),
        api.get('/admin/scholarship-apps').catch(() => ({ data: { applications: [] } })),
        api.get('/admin/cert-requests').catch(() => ({ data: { requests: [] } })),
        api.get('/admin/bank-proofs').catch(() => ({ data: { proofs: [] } })),
      ]);
      setData({
        rechecks: re.data.rechecks || [],
        freezes: fr.data.freezes || [],
        installments: ins.data.requests || [],
        refunds: ref.data.requests || [],
        apps: apps.data.applications || [],
        certs: cert.data.requests || [],
        proofs: proofs.data.proofs || [],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <Spinner label="Loading approvals..." />;

  const counts = {
    'Re-checks': data.rechecks.filter((x) => x.status === 'PENDING').length,
    'Freezes': data.freezes.filter((x) => x.status === 'PENDING').length,
    'Installments': data.installments.filter((x) => x.status === 'PENDING').length,
    'Refunds': data.refunds.filter((x) => x.status === 'PENDING').length,
    'Scholarships': data.apps.filter((x) => x.status === 'PENDING').length,
    'Certificates': data.certs.filter((x) => x.status === 'PENDING').length,
    'Bank Proofs': data.proofs.filter((x) => x.status === 'PENDING').length,
  };

  const tabs = ['Re-checks', 'Freezes', 'Installments', 'Refunds', 'Scholarships', 'Certificates', 'Bank Proofs']
    .map((t) => counts[t] ? `${t} (${counts[t]})` : t);

  const tabBase = tab.replace(/ \(\d+\)$/, '');

  async function resolve(endpoint, id, status, adminNote) {
    await api.put(`${endpoint}/${id}`, { status, adminNote });
    setMsg({ type: 'success', text: `Request ${status.toLowerCase()}` });
    await load();
  }

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Process student requests: re-checks, freezes, installments, refunds, scholarships, certificates and bank payments" />
      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <Card className="p-0 overflow-hidden">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <div className="p-5">
          {tabBase === 'Re-checks' && (data.rechecks.length ? data.rechecks.map((r) => (
            <ApproveRow key={r.id} item={{ ...r, student: r.student?.name, roll: r.student?.rollNumber, course: r.enrollment?.section?.course?.courseCode }}
              cols={[{ key: 'student', label: 'Student' }, { key: 'roll', label: 'Roll' }, { key: 'course', label: 'Course' }, { key: 'reason', label: 'Reason' }]}
              onResolve={(id, s, n) => resolve('/admin/rechecks', id, s, n)} />
          )) : <p className="py-6 text-center text-sm text-[#98a0ae]">No re-check requests</p>)}

          {tabBase === 'Freezes' && (data.freezes.length ? data.freezes.map((r) => (
            <ApproveRow key={r.id} item={{ ...r, student: r.student?.name, roll: r.student?.rollNumber, sem: `Sem ${r.semester} (${r.year})` }}
              cols={[{ key: 'student', label: 'Student' }, { key: 'roll', label: 'Roll' }, { key: 'sem', label: 'Semester' }, { key: 'reason', label: 'Reason' }]}
              onResolve={(id, s, n) => resolve('/admin/freezes', id, s, n)} />
          )) : <p className="py-6 text-center text-sm text-[#98a0ae]">No freeze requests</p>)}

          {tabBase === 'Installments' && (data.installments.length ? data.installments.map((r) => (
            <ApproveRow key={r.id} item={{ ...r, student: r.student?.name, roll: r.student?.rollNumber, voucher: r.challan?.voucherId, amount: r.challan?.totalAmount, plan: r.plan }}
              cols={[{ key: 'student', label: 'Student' }, { key: 'roll', label: 'Roll' }, { key: 'voucher', label: 'Voucher' }, { key: 'amount', label: 'Amount' }, { key: 'plan', label: 'Plan' }]}
              onResolve={(id, s, n) => resolve('/admin/installments', id, s, n)} />
          )) : <p className="py-6 text-center text-sm text-[#98a0ae]">No installment requests</p>)}

          {tabBase === 'Refunds' && (data.refunds.length ? data.refunds.map((r) => (
            <ApproveRow key={r.id} item={{ ...r, student: r.student?.name, roll: r.student?.rollNumber, voucher: r.challan?.voucherId, amount: r.amount }}
              cols={[{ key: 'student', label: 'Student' }, { key: 'roll', label: 'Roll' }, { key: 'voucher', label: 'Voucher' }, { key: 'amount', label: 'Amount' }, { key: 'reason', label: 'Reason' }]}
              onResolve={(id, s, n) => resolve('/admin/refunds', id, s, n)} />
          )) : <p className="py-6 text-center text-sm text-[#98a0ae]">No refund requests</p>)}

          {tabBase === 'Scholarships' && (data.apps.length ? data.apps.map((r) => (
            <ApproveRow key={r.id} item={{ ...r, student: r.student?.name, roll: r.student?.rollNumber, scholarship: r.scholarship?.title, cgpa: r.cgpa }}
              cols={[{ key: 'student', label: 'Student' }, { key: 'roll', label: 'Roll' }, { key: 'scholarship', label: 'Scholarship' }, { key: 'cgpa', label: 'CGPA' }]}
              onResolve={(id, s, n) => resolve('/admin/scholarship-apps', id, s, n)} />
          )) : <p className="py-6 text-center text-sm text-[#98a0ae]">No scholarship applications</p>)}

          {tabBase === 'Certificates' && (data.certs.length ? data.certs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 py-3 border-b border-[#edf0f3] last:border-0">
              <div className="flex-1 min-w-[200px]">
                <div className="text-[11px]"><span className="text-[#697386]">Student: </span><strong>{r.student?.name}</strong> ({r.student?.rollNumber})</div>
                <div className="text-[11px]"><span className="text-[#697386]">Type: </span><strong>{r.type}</strong> · Fee: PKR {r.feeAmount}</div>
                <div className="mt-1"><Badge tone={r.status === 'PENDING' ? 'amber' : r.status === 'REJECTED' ? 'red' : 'green'}>{r.status}</Badge></div>
              </div>
              {r.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button onClick={() => resolve('/admin/cert-requests', r.id, 'APPROVED')} className={btnPrimary + ' py-1.5 px-2.5 text-[11px]'}><Check size={13} /> Approve</button>
                  <button onClick={() => resolve('/admin/cert-requests', r.id, 'ISSUED')} className={btnPrimary + ' py-1.5 px-2.5 text-[11px] bg-[#0f9d8a]'}>Mark Issued</button>
                  <button onClick={() => resolve('/admin/cert-requests', r.id, 'REJECTED')} className={btnDanger + ' py-1.5 px-2.5 text-[11px]'}><X size={13} /> Reject</button>
                </div>
              )}
            </div>
          )) : <p className="py-6 text-center text-sm text-[#98a0ae]">No certificate requests</p>)}

          {tabBase === 'Bank Proofs' && (data.proofs.length ? data.proofs.map((r) => (
            <ApproveRow key={r.id} item={{ ...r, student: r.student?.name, roll: r.student?.rollNumber, voucher: r.challan?.voucherId, reference: r.reference }}
              cols={[{ key: 'student', label: 'Student' }, { key: 'roll', label: 'Roll' }, { key: 'voucher', label: 'Voucher' }, { key: 'reference', label: 'Reference' }]}
              onResolve={(id, s, n) => resolve('/admin/bank-proofs', id, s === 'APPROVED' ? 'VERIFIED' : s, n)} />
          )) : <p className="py-6 text-center text-sm text-[#98a0ae]">No bank proofs</p>)}
        </div>
      </Card>
    </div>
  );
}
