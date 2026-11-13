import { useState } from 'react';
import api, { apiMessage } from '../../services/api';
import { Alert, Card, PageHeader, btnSecondary } from '../../components/ui/UI';

export default function PrivacySettings() {
  const [message, setMessage] = useState(null);
  async function exportData() {
    try {
      const response = await api.get('/student/data-export', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student-data-export.json';
      link.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Your data export has been downloaded.' });
    } catch (err) { setMessage({ type: 'error', text: apiMessage(err) }); }
  }
  return (
    <div>
      <PageHeader title="Privacy and data" subtitle="Review your rights and download a copy of your portal data" />
      {message && <div className="mb-4"><Alert type={message.type}>{message.text}</Alert></div>}
      <Card title="Data export">
        <p className="mb-4 text-sm leading-6 text-slate-600">Download your profile, enrollment, results, fee, complaint, and certificate-request data as JSON.</p>
        <button type="button" className={btnSecondary} onClick={exportData}>Download my data</button>
      </Card>
    </div>
  );
}
