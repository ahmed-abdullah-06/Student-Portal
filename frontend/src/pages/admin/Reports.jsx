import { Download, FileBarChart } from 'lucide-react';
import { Card, PageHeader, btnSecondary } from '../../components/ui/UI';

const reports = [
  { key: 'attendance', title: 'Attendance Report', desc: 'All enrollments with attendance % and deficiency flags', endpoint: '/admin/reports/attendance' },
  { key: 'fee-defaulters', title: 'Fee Defaulters', desc: 'Unpaid challans past their due date with days overdue', endpoint: '/admin/reports/fee-defaulters' },
  { key: 'result-gazette', title: 'Result Gazette', desc: 'All completed courses with grades — filter by semester via API', endpoint: '/admin/reports/result-gazette' },
  { key: 'enrollment', title: 'Enrollment per Course', desc: 'Section-wise enrollment counts against capacity', endpoint: '/admin/reports/enrollment' },
];

function download(endpoint, filename) {
  const token = localStorage.getItem('token');
  fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((r) => r.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    })
    .catch(() => {});
}

export default function Reports() {
  return (
    <div>
      <PageHeader title="Reports & Exports" subtitle="Download CSV reports for analysis and printing" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <Card key={r.key} className="p-5">
            <div className="flex items-start gap-3.5">
              <div className="w-[42px] h-[42px] rounded-[10px] bg-[#edf2ff] text-[#1e3a8a] grid place-items-center shrink-0">
                <FileBarChart size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <strong className="block text-[13px] text-[#172033]">{r.title}</strong>
                <small className="block text-[10px] text-[#697386] mt-0.5">{r.desc}</small>
              </div>
            </div>
            <button onClick={() => download(r.endpoint, `${r.key}.csv`)} className={btnSecondary + ' mt-4 w-full justify-center'}>
              <Download size={14} /> Download CSV
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
