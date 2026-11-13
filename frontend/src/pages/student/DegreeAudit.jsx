import { useEffect, useState } from 'react';
import { Award, TrendingUp, AlertTriangle, BookOpen } from 'lucide-react';
import api from '../../services/api';
import { Card, Spinner, PageHeader, Badge, StatCard, Alert, tableHead, tableCell } from '../../components/ui/UI';

export default function DegreeAudit() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/student/degree-audit').then((res) => setData(res.data)).catch(() => setData({ error: true }));
  }, []);

  if (!data) return <Spinner label="Computing degree audit..." />;
  if (data.error) return <Alert type="error">Failed to load degree audit</Alert>;

  const pct = Math.min(100, Math.round(((data.creditsCompleted + data.creditsInProgress) / data.totalCredits) * 100));

  return (
    <div>
      <PageHeader title="Degree Audit" subtitle={`${data.student?.name} • ${data.student?.degree} • Batch ${data.student?.batch}`} />

      {data.standing !== 'Good Standing' && (
        <div className="mb-4">
          <Alert type={data.standing.includes('Probation') || data.standing.includes('Warning') ? 'warning' : 'success'}>
            <b>Academic Standing:</b> {data.standing}
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={Award} label="CGPA" value={data.cgpa?.toFixed(2) ?? '—'} tone="blue" />
        <StatCard icon={BookOpen} label="Credits Completed" value={`${data.creditsCompleted}/${data.totalCredits}`} tone="teal" />
        <StatCard icon={TrendingUp} label="In Progress" value={data.creditsInProgress} tone="amber" />
        <StatCard icon={AlertTriangle} label="Remaining" value={data.creditsRemaining} tone="red" />
      </div>

      <Card className="mb-4">
        <div className="flex justify-between text-[11px] mb-2">
          <span className="text-[#697386] font-medium">Overall Progress</span>
          <strong className="text-[#1e3a8a]">{pct}% ({data.creditsCompleted + data.creditsInProgress}/{data.totalCredits} credits)</strong>
        </div>
        <div className="h-3 bg-[#e9edf2] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#1e3a8a] to-[#0f9d8a] rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between mt-3 text-[10px]">
          <span className="text-[#697386]">Completed: <b className="text-[#11875d]">{data.creditsCompleted}</b></span>
          <span className="text-[#697386]">In Progress: <b className="text-[#d18a17]">{data.creditsInProgress}</b></span>
          <span className="text-[#697386]">Remaining: <b className="text-[#d14545]">{data.creditsRemaining}</b></span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={`Completed Courses (${data.completed.length})`} className="p-0 overflow-hidden">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr>
                  <th className={tableHead}>Code</th>
                  <th className={tableHead}>Title</th>
                  <th className={tableHead + ' text-center'}>Cr</th>
                  <th className={tableHead + ' text-center'}>Grade</th>
                  <th className={tableHead + ' text-center'}>Sem</th>
                </tr>
              </thead>
              <tbody>
                {data.completed.map((c, i) => (
                  <tr key={i} className="hover:bg-[#f9fafc]">
                    <td className={tableCell + ' font-mono font-semibold text-[#1e3a8a]'}>{c.courseCode}</td>
                    <td className={tableCell}>{c.title}</td>
                    <td className={tableCell + ' text-center'}>{c.creditHours}</td>
                    <td className={tableCell + ' text-center'}><Badge tone={c.grade === 'F' ? 'red' : 'green'}>{c.grade}</Badge></td>
                    <td className={tableCell + ' text-center'}>{c.semester}</td>
                  </tr>
                ))}
                {data.completed.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-sm text-[#98a0ae]">No completed courses</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title={`In Progress (${data.inProgress.length})`} className="p-0 overflow-hidden">
            <div className="px-[18px] max-h-[180px] overflow-y-auto">
              {data.inProgress.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-[#edf0f3] last:border-0">
                  <div>
                    <strong className="text-[11px] text-[#1e3a8a] font-mono">{c.courseCode}</strong>
                    <span className="text-[11px] text-[#697386] ml-2">{c.title}</span>
                  </div>
                  <span className="text-[10px] text-[#98a0ae]">{c.creditHours} cr · Sem {c.semester}</span>
                </div>
              ))}
              {data.inProgress.length === 0 && <p className="py-4 text-center text-sm text-[#98a0ae]">Nothing in progress</p>}
            </div>
          </Card>

          <Card title={`Suggested Remaining Courses (${data.remainingCourses.length})`} className="p-0 overflow-hidden">
            <div className="px-[18px] max-h-[200px] overflow-y-auto">
              {data.remainingCourses.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-[#edf0f3] last:border-0">
                  <div>
                    <strong className="text-[11px] text-[#465166] font-mono">{c.courseCode}</strong>
                    <span className="text-[11px] text-[#697386] ml-2">{c.title}</span>
                  </div>
                  <span className="text-[10px] text-[#98a0ae]">{c.creditHours} cr</span>
                </div>
              ))}
              {data.remainingCourses.length === 0 && <p className="py-4 text-center text-sm text-[#98a0ae]">All courses completed</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
