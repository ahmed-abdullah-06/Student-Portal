import { useEffect, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Badge, Spinner, Alert, PageHeader, Tabs, Field, inputCls, btnPrimary } from '../../components/ui/UI';

function StatusBadge({ status }) {
  const tone = ['APPROVED', 'VERIFIED', 'ISSUED', 'COMPLETED'].includes(status) ? 'green' : status === 'REJECTED' ? 'red' : 'amber';
  return <Badge tone={tone}>{status}</Badge>;
}

function RequestForm({ title, fields, submitLabel, onSubmit }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handle(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await onSubmit(form);
      setMsg({ type: 'success', text: res.data.message || 'Request submitted' });
      setForm({});
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4">
      <h2 className="text-sm font-semibold text-[#172033] mb-3">{title}</h2>
      {msg && <div className="mb-3"><Alert type={msg.type}>{msg.text}</Alert></div>}
      <form onSubmit={handle}>
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.type === 'select' ? (
              <select className={inputCls} required value={form[f.key] || ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                <option value="">Select...</option>
                {f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea className={inputCls + ' resize-y'} rows={3} required value={form[f.key] || ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            ) : (
              <input type={f.type || 'text'} className={inputCls} required value={form[f.key] || ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            )}
          </Field>
        ))}
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {submitLabel}
        </button>
      </form>
    </Card>
  );
}

function HistoryTable({ rows, cols }) {
  if (!rows?.length) return <p className="py-6 text-center text-sm text-[#98a0ae]">No requests yet</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr>{cols.map((c) => <th key={c} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-[#f9fafc]">
              {cols.map((c) => (
                <td key={c} className="px-3 py-2.5 text-[12px] text-[#172033] border-b border-[#edf0f3]">
                  {c === 'Status' ? <StatusBadge status={r.status} /> : r[c] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Requests() {
  const [tab, setTab] = useState('Re-check');
  const [data, setData] = useState({ rechecks: [], freezes: [], installments: [], refunds: [], scholarships: [], apps: [], certs: [], proofs: [], courses: [], challans: [], openScholarships: [] });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [re, fr, ins, ref, sch, apps, cert, proofs, courses, challans, openSch] = await Promise.all([
        api.get('/student/rechecks').catch(() => ({ data: { rechecks: [] } })),
        api.get('/student/freezes').catch(() => ({ data: { freezes: [] } })),
        api.get('/student/installments').catch(() => ({ data: { requests: [] } })),
        api.get('/student/refunds').catch(() => ({ data: { requests: [] } })),
        api.get('/student/scholarships').catch(() => ({ data: { scholarships: [] } })),
        api.get('/student/scholarships/my').catch(() => ({ data: { applications: [] } })),
        api.get('/student/cert-requests').catch(() => ({ data: { requests: [] } })),
        api.get('/student/bank-proofs').catch(() => ({ data: { proofs: [] } })),
        api.get('/student/courses').catch(() => ({ data: { enrollments: [] } })),
        api.get('/student/challans').catch(() => ({ data: { challans: [] } })),
        api.get('/student/scholarships').catch(() => ({ data: { scholarships: [] } })),
      ]);
      setData({
        rechecks: re.data.rechecks || [],
        freezes: fr.data.freezes || [],
        installments: ins.data.requests || [],
        refunds: ref.data.requests || [],
        scholarships: sch.data.scholarships || [],
        apps: apps.data.applications || [],
        certs: cert.data.requests || [],
        proofs: proofs.data.proofs || [],
        courses: courses.data.enrollments || [],
        challans: challans.data.challans || [],
        openScholarships: openSch.data.scholarships || [],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <Spinner label="Loading requests..." />;

  const completedCourses = data.courses.filter((c) => c.status === 'COMPLETED');
  const unpaidChallans = data.challans.filter((c) => c.status === 'UNPAID');
  const paidChallans = data.challans.filter((c) => c.status === 'PAID');

  const tabs = ['Re-check', 'Freeze', 'Installments', 'Refunds', 'Scholarships', 'Certificates', 'Bank Proof'];

  return (
    <div>
      <PageHeader title="Requests & Services" subtitle="Re-checks, freezes, installments, refunds, scholarships and certificates" />
      <Card className="p-0 overflow-hidden">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <div className="p-5">
          {tab === 'Re-check' && (
            <>
              <RequestForm
                title="Request Result Re-check"
                submitLabel="Submit re-check"
                fields={[
                  { key: 'enrollmentId', label: 'Course', type: 'select', options: completedCourses.map((c) => ({ value: c.id, label: `${c.section?.course?.courseCode} — ${c.section?.course?.title} (${c.gradeLetter})` })) },
                  { key: 'reason', label: 'Reason', type: 'textarea' },
                ]}
                onSubmit={(f) => api.post('/student/rechecks', f)}
              />
              <HistoryTable rows={data.rechecks.map((r) => ({ ...r, Course: r.enrollment?.section?.course?.courseCode, Reason: r.reason, Fee: `PKR ${r.feeAmount}`, Status: r.status }))} cols={['Course', 'Reason', 'Fee', 'Status']} />
            </>
          )}

          {tab === 'Freeze' && (
            <>
              <RequestForm
                title="Request Semester Freeze"
                submitLabel="Submit freeze request"
                fields={[
                  { key: 'semester', label: 'Semester', type: 'number' },
                  { key: 'year', label: 'Year', type: 'number' },
                  { key: 'reason', label: 'Reason', type: 'textarea' },
                ]}
                onSubmit={(f) => api.post('/student/freezes', { ...f, semester: Number(f.semester), year: Number(f.year) })}
              />
              <HistoryTable rows={data.freezes.map((r) => ({ ...r, Semester: `Sem ${r.semester} (${r.year})`, Reason: r.reason, Status: r.status }))} cols={['Semester', 'Reason', 'Status']} />
            </>
          )}

          {tab === 'Installments' && (
            <>
              <RequestForm
                title="Request Fee Installment Plan"
                submitLabel="Submit request"
                fields={[
                  { key: 'challanId', label: 'Unpaid Challan', type: 'select', options: unpaidChallans.map((c) => ({ value: c.id, label: `${c.voucherId} — PKR ${c.totalAmount}` })) },
                  { key: 'plan', label: 'Plan', type: 'select', options: ['2_PARTS', '3_PARTS'] },
                  { key: 'reason', label: 'Reason', type: 'textarea' },
                ]}
                onSubmit={(f) => api.post('/student/installments', f)}
              />
              <HistoryTable rows={data.installments.map((r) => ({ ...r, Voucher: r.challan?.voucherId, Plan: r.plan, Reason: r.reason, Status: r.status }))} cols={['Voucher', 'Plan', 'Reason', 'Status']} />
            </>
          )}

          {tab === 'Refunds' && (
            <>
              <RequestForm
                title="Request Fee Refund"
                submitLabel="Submit refund request"
                fields={[
                  { key: 'challanId', label: 'Paid Challan', type: 'select', options: paidChallans.map((c) => ({ value: c.id, label: `${c.voucherId} — PKR ${c.totalAmount}` })) },
                  { key: 'amount', label: 'Amount (PKR)', type: 'number' },
                  { key: 'reason', label: 'Reason', type: 'textarea' },
                ]}
                onSubmit={(f) => api.post('/student/refunds', { ...f, amount: Number(f.amount) })}
              />
              <HistoryTable rows={data.refunds.map((r) => ({ ...r, Voucher: r.challan?.voucherId, Amount: `PKR ${r.amount}`, Reason: r.reason, Status: r.status }))} cols={['Voucher', 'Amount', 'Reason', 'Status']} />
            </>
          )}

          {tab === 'Scholarships' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {data.openScholarships.map((s) => (
                  <Card key={s.id} className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <strong className="text-[13px] text-[#172033] block">{s.title}</strong>
                        <small className="text-[10px] text-[#697386] block mt-0.5">Deadline: {new Date(s.deadline).toLocaleDateString()}</small>
                      </div>
                      <Badge tone="green">PKR {s.amount?.toLocaleString()}</Badge>
                    </div>
                    <p className="text-[11px] text-[#697386] mt-2">{s.description}</p>
                    <p className="text-[10px] text-[#98a0ae] mt-1"><b>Eligibility:</b> {s.eligibility}</p>
                  </Card>
                ))}
                {data.openScholarships.length === 0 && <p className="col-span-2 py-4 text-center text-sm text-[#98a0ae]">No open scholarships</p>}
              </div>

              {data.openScholarships.map((s) => (
                <RequestForm
                  key={s.id}
                  title={`Apply: ${s.title}`}
                  submitLabel="Apply now"
                  fields={[{ key: `statement_${s.id}`, label: 'Personal Statement', type: 'textarea' }]}
                  onSubmit={(f) => api.post(`/student/scholarships/${s.id}/apply`, { statement: f[`statement_${s.id}`] })}
                />
              ))}

              <h3 className="text-sm font-semibold text-[#172033] mb-2">My Applications</h3>
              <HistoryTable rows={data.apps.map((a) => ({ ...a, Scholarship: a.scholarship?.title, CGPA: a.cgpa, Status: a.status }))} cols={['Scholarship', 'CGPA', 'Status']} />
            </>
          )}

          {tab === 'Certificates' && (
            <>
              <RequestForm
                title="Request a Certificate"
                submitLabel="Submit request (PKR 500 fee)"
                fields={[
                  { key: 'type', label: 'Certificate Type', type: 'select', options: [
                    { value: 'TRANSCRIPT', label: 'Official Transcript' },
                    { value: 'DEGREE', label: 'Degree Certificate' },
                    { value: 'NOC', label: 'No Objection Certificate (NOC)' },
                    { value: 'CHARACTER', label: 'Character Certificate' },
                  ]},
                ]}
                onSubmit={(f) => api.post('/student/cert-requests', f)}
              />
              <HistoryTable rows={data.certs.map((c) => ({ ...c, Type: c.type, Fee: `PKR ${c.feeAmount}`, Status: c.status }))} cols={['Type', 'Fee', 'Status']} />
            </>
          )}

          {tab === 'Bank Proof' && (
            <>
              <RequestForm
                title="Submit Bank Payment Proof"
                submitLabel="Submit proof"
                fields={[
                  { key: 'challanId', label: 'Challan', type: 'select', options: unpaidChallans.map((c) => ({ value: c.id, label: `${c.voucherId} — PKR ${c.totalAmount}` })) },
                  { key: 'reference', label: 'Bank Transaction Reference', type: 'text' },
                ]}
                onSubmit={(f) => api.post('/student/bank-proofs', f)}
              />
              <HistoryTable rows={data.proofs.map((p) => ({ ...p, Voucher: p.challan?.voucherId, Reference: p.reference, Status: p.status }))} cols={['Voucher', 'Reference', 'Status']} />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
