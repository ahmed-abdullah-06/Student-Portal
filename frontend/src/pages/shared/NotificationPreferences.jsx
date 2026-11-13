import { useEffect, useState } from 'react';
import api, { apiMessage } from '../../services/api';
import { Alert, Card, PageHeader, btnPrimary } from '../../components/ui/UI';

const labels = {
  GRADES: 'Grades and results',
  ASSIGNMENTS: 'Assignments',
  FEES: 'Fees and payments',
  SYSTEM: 'System announcements',
  MESSAGES: 'Messages',
};

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/notifications/preferences')
      .then((res) => setPreferences(res.data.preferences))
      .catch((err) => setMessage({ type: 'error', text: apiMessage(err) }));
  }, []);

  function toggle(category, channel) {
    setPreferences((current) => current.map((item) => (
      item.category === category ? { ...item, [channel]: !item[channel] } : item
    )));
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.put('/notifications/preferences', { preferences });
      setMessage({ type: 'success', text: 'Notification preferences updated' });
    } catch (err) {
      setMessage({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Notification preferences" subtitle="Choose how the portal keeps you informed" />
      {message && <div className="mb-4"><Alert type={message.type}>{message.text}</Alert></div>}
      <Card>
        <form onSubmit={save}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <caption className="sr-only">Notification delivery preferences</caption>
              <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-3">Category</th><th className="px-3 py-3">In-app</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">SMS</th>
              </tr></thead>
              <tbody>
                {preferences.map((item) => (
                  <tr key={item.category} className="border-b border-slate-100">
                    <th scope="row" className="px-3 py-4 text-left text-sm font-medium text-slate-800">{labels[item.category] || item.category}</th>
                    {['inApp', 'email', 'sms'].map((channel) => (
                      <td key={channel} className="px-3 py-4">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                          <input type="checkbox" checked={Boolean(item[channel])} onChange={() => toggle(item.category, channel)} aria-label={`${labels[item.category]} ${channel}`} />
                          <span className="sr-only">{channel}</span>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" disabled={busy} className={`${btnPrimary} mt-5`}>{busy ? 'Saving…' : 'Save preferences'}</button>
        </form>
      </Card>
    </div>
  );
}
