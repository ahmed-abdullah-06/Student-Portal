import { useEffect, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Badge, Spinner, Alert, PageHeader, Field, inputCls, btnPrimary } from '../../components/ui/UI';

export default function CourseWithdraw() {
  const [enrollments, setEnrollments] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ sectionId: '', reason: 'Academic workload', comments: '' });

  function load() {
    return Promise.all([
      api.get('/student/courses'),
      api.get('/withdrawals'),
    ]).then(([c, w]) => {
      setEnrollments(c.data.enrollments);
      setWithdrawals(w.data.withdrawals);
    });
  }

  useEffect(() => {
    load().catch(() => {
      setEnrollments([]);
      setWithdrawals([]);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/withdrawals', form);
      setMsg({ type: 'success', text: 'Withdrawal request submitted successfully' });
      setForm({ sectionId: '', reason: 'Academic workload', comments: '' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!enrollments) return <Spinner label="Loading withdrawals..." />;

  const eligible = enrollments.filter((e) => e.status === 'REGISTERED' && !e.isLocked);
  const pendingIds = withdrawals.filter((w) => w.status === 'PENDING').map((w) => w.sectionId);

  return (
    <div>
      <PageHeader
        title="Course Withdraw"
        subtitle="Submit a course withdrawal request before 30 October 2026"
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 items-start">
        <Card className="p-0 overflow-hidden">
          <div className="px-[18px] pt-4 pb-3 border-b border-[#edf0f3]">
            <h2 className="text-sm font-semibold text-[#172033] m-0">New Request</h2>
            <p className="text-[10px] text-[#697386] mt-1 m-0">Please complete all required fields</p>
          </div>
          <form onSubmit={handleSubmit} className="px-5 pt-4 pb-5">
            <Field label="Select course">
              <select
                required
                value={form.sectionId}
                onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                className={inputCls}
              >
                <option value="">Choose a course...</option>
                {eligible.map((e) => (
                  <option key={e.id} value={e.sectionId} disabled={pendingIds.includes(e.sectionId)}>
                    {e.section?.course?.code} — {e.section?.course?.title}
                    {pendingIds.includes(e.sectionId) ? ' (pending)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reason for withdrawal">
              <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={inputCls}>
                <option>Academic workload</option>
                <option>Medical reason</option>
                <option>Schedule conflict</option>
                <option>Change of program</option>
              </select>
            </Field>
            <Field label="Additional comments">
              <textarea
                placeholder="Provide details for your academic advisor..."
                rows={5}
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
                className={inputCls + ' resize-y'}
              />
            </Field>
            <button type="submit" disabled={busy || !form.sectionId} className={btnPrimary}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit withdrawal request
            </button>
          </form>
        </Card>

        <Card title="Previous Requests" className="p-0 overflow-hidden">
          <div className="px-[18px]">
            {withdrawals.length === 0 && (
              <p className="text-[12px] text-[#98a0ae] text-center py-8">No withdrawal requests yet</p>
            )}
            {withdrawals.map((r) => (
              <div key={r.id} className="flex justify-between items-center py-3.5 border-b border-[#e4e7ec] last:border-0">
                <span>
                  <strong className="text-[11px] text-[#172033] block">{r.section?.course?.courseCode}</strong>
                  <small className="text-[9px] text-[#697386] block mt-1">
                    {r.section?.course?.title} • Sem {r.semester} {r.year} • {r.reason}
                  </small>
                </span>
                <Badge tone={r.status === 'REJECTED' ? 'red' : r.status === 'APPROVED' ? 'green' : 'amber'}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
