import { useEffect, useState } from 'react';
import api, { apiMessage } from '../../services/api';
import { Alert, Card, Field, PageHeader, btnPrimary, inputCls } from '../../components/ui/UI';

export default function FacultyProfile() {
  const [form, setForm] = useState({ name: '', phone: '', designation: '', officeHours: '', bio: '' });
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get('/faculty/profile').then((res) => setForm(res.data.faculty)).catch((err) => setMessage({ type: 'error', text: apiMessage(err) }));
  }, []);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await api.put('/faculty/profile', form);
      setForm(res.data.faculty);
      setMessage({ type: 'success', text: res.data.message });
    } catch (err) { setMessage({ type: 'error', text: apiMessage(err) }); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <PageHeader title="Faculty profile" subtitle="Keep your contact details and office hours current" />
      {message && <div className="mb-4"><Alert type={message.type}>{message.text}</Alert></div>}
      <Card>
        <form onSubmit={save} className="max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input className={inputCls} value={form.name || ''} onChange={set('name')} required /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone || ''} onChange={set('phone')} /></Field>
            <Field label="Designation"><input className={inputCls} value={form.designation || ''} onChange={set('designation')} /></Field>
            <Field label="Office hours"><input className={inputCls} value={form.officeHours || ''} onChange={set('officeHours')} placeholder="Mon/Wed 10:00–12:00" /></Field>
          </div>
          <Field label="Bio"><textarea className={inputCls} rows="5" value={form.bio || ''} onChange={set('bio')} maxLength={1000} /></Field>
          <button className={btnPrimary} disabled={busy} type="submit">{busy ? 'Saving…' : 'Save profile'}</button>
        </form>
      </Card>
    </div>
  );
}
