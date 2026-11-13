import { useEffect, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Badge, Spinner, Alert, PageHeader, Field, inputCls, btnPrimary } from '../../components/ui/UI';

export default function Complaints() {
  const [tickets, setTickets] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ category: 'Academic', subject: '', description: '' });

  function load() {
    return api.get('/complaints').then((res) => setTickets(res.data.complaints));
  }

  useEffect(() => {
    load().catch(() => setTickets([]));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/complaints', form);
      setMsg({ type: 'success', text: 'Ticket created successfully' });
      setForm({ category: 'Academic', subject: '', description: '' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!tickets) return <Spinner label="Loading tickets..." />;

  return (
    <div>
      <PageHeader
        title="Complaints & Help Desk"
        subtitle="Raise and track a campus support request"
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 items-start">
        <Card className="p-0 overflow-hidden">
          <div className="px-[18px] pt-4 pb-3 border-b border-[#edf0f3]">
            <h2 className="text-sm font-semibold text-[#172033] m-0">New Request</h2>
            <p className="text-[10px] text-[#697386] mt-1 m-0">Please complete all required fields</p>
          </div>
          <form onSubmit={handleSubmit} className="px-5 pt-4 pb-5">
            <Field label="Category">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                <option>Academic</option>
                <option>IT Services</option>
                <option>Finance & Fees</option>
                <option>Campus Facilities</option>
                <option>Transport</option>
                <option>Hostel</option>
              </select>
            </Field>
            <Field label="Subject">
              <input
                required
                placeholder="Brief summary of your issue"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Description">
              <textarea
                required
                placeholder="Describe your request in detail..."
                rows={5}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputCls + ' resize-y'}
              />
            </Field>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Create support ticket
            </button>
          </form>
        </Card>

        <Card title="Your Tickets" className="p-0 overflow-hidden">
          <div className="px-[18px]">
            {tickets.length === 0 && (
              <p className="text-[12px] text-[#98a0ae] text-center py-8">No tickets yet</p>
            )}
            {tickets.map((t) => (
              <div key={t.id} className="flex justify-between items-center py-3.5 border-b border-[#e4e7ec] last:border-0">
                <span>
                  <strong className="text-[11px] text-[#172033] block">{t.subject}</strong>
                  <small className="text-[9px] text-[#697386] block mt-1">
                    {t.category} • {new Date(t.createdAt).toLocaleDateString()}
                  </small>
                </span>
                <Badge tone={t.status === 'RESOLVED' ? 'green' : 'amber'}>{t.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
