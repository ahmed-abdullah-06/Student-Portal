import { useEffect, useState } from 'react';
import api, { apiMessage } from '../../services/api';
import { Alert, Card, EmptyState, Field, PageHeader, btnDanger, btnPrimary, inputCls } from '../../components/ui/UI';

const blank = { title: '', description: '', eventType: 'ACADEMIC', startsAt: '', endsAt: '', allDay: true };

export default function CalendarManagement() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/admin/calendar').then((res) => setEvents(res.data.events)).catch((err) => setMessage({ type: 'error', text: apiMessage(err) }));
  useEffect(() => { load(); }, []);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value });
  async function add(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/admin/calendar', form);
      setForm(blank);
      setMessage({ type: 'success', text: 'Calendar event added' });
      await load();
    } catch (err) { setMessage({ type: 'error', text: apiMessage(err) }); }
    finally { setBusy(false); }
  }
  async function remove(id) {
    try { await api.delete(`/admin/calendar/${id}`); await load(); }
    catch (err) { setMessage({ type: 'error', text: apiMessage(err) }); }
  }
  return (
    <div>
      <PageHeader title="Academic calendar" subtitle="Manage university-wide dates and events" />
      {message && <div className="mb-4"><Alert type={message.type}>{message.text}</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card title="Add event">
          <form onSubmit={add}>
            <Field label="Title"><input className={inputCls} value={form.title} onChange={set('title')} required maxLength={120} /></Field>
            <Field label="Description"><textarea className={inputCls} rows="3" value={form.description} onChange={set('description')} maxLength={500} /></Field>
            <Field label="Type"><select className={inputCls} value={form.eventType} onChange={set('eventType')}><option>ACADEMIC</option><option>EXAM</option><option>HOLIDAY</option><option>ADMIN</option></select></Field>
            <Field label="Start"><input className={inputCls} type="datetime-local" value={form.startsAt} onChange={set('startsAt')} required /></Field>
            <Field label="End (optional)"><input className={inputCls} type="datetime-local" value={form.endsAt} onChange={set('endsAt')} /></Field>
            <label className="mb-4 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.allDay} onChange={set('allDay')} /> All-day event</label>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Adding…' : 'Add event'}</button>
          </form>
        </Card>
        <Card title="Scheduled events">
          {events.length === 0 ? <EmptyState message="No calendar events yet." /> : (
            <div className="space-y-2">
              {events.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                <div><h2 className="text-sm font-semibold text-slate-800">{item.title}</h2><p className="text-xs text-slate-500">{new Date(item.startsAt).toLocaleString()} · {item.eventType}</p></div>
                <button type="button" className={btnDanger} onClick={() => remove(item.id)}>Delete</button>
              </div>)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
