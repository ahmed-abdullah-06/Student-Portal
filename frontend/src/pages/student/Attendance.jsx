import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Card, Badge, Spinner, PageHeader, Modal, EmptyState } from '../../components/ui/UI';

export default function Attendance() {
  const [courses, setCourses] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api
      .get('/student/attendance')
      .then((res) => setCourses(res.data.courses))
      .catch(() => setCourses([]));
  }, []);

  if (!courses) return <Spinner label="Loading attendance..." />;

  const heatmap = courses.flatMap((course) => (course.records || []).map((record) => ({
    ...record,
    courseCode: course.courseCode,
  }))).reduce((days, record) => {
    const key = new Date(record.date).toISOString().slice(0, 10);
    if (!days[key]) days[key] = { present: 0, absent: 0, courses: [] };
    days[key][record.status === 'PRESENT' ? 'present' : 'absent'] += 1;
    if (!days[key].courses.includes(record.courseCode)) days[key].courses.push(record.courseCode);
    return days;
  }, {});

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Course-wise attendance summary for Fall 2026"
        action={<Badge tone="amber">Minimum required: 75%</Badge>}
      />
      <Card title="Attendance activity" subtitle="Daily attendance across all enrolled courses" className="mb-4">
        <div className="flex flex-wrap gap-1.5" aria-label="Attendance heatmap">
          {Object.keys(heatmap).length === 0 && <EmptyState message="Attendance activity will appear after lectures are recorded." />}
          {Object.entries(heatmap).sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => {
            const total = value.present + value.absent;
            const tone = value.absent > value.present ? 'bg-red-500' : value.present ? 'bg-emerald-500' : 'bg-slate-200';
            return <span key={day} title={`${day}: ${value.present} present, ${value.absent} absent (${value.courses.join(', ')})`} className={`h-5 w-5 rounded-sm ${tone} opacity-${Math.min(100, 40 + total * 20)}`} aria-label={`${day}: ${value.present} present, ${value.absent} absent`} />;
          })}
        </div>
        <div className="mt-3 flex gap-4 text-[11px] text-slate-500"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />Present</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />Absent-heavy</span></div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr>
                {['Course', 'Total Lectures', 'Present', 'Absent', 'Attendance', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetail(c)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetail(c); } }}
                  className="hover:bg-[#f9fafc] cursor-pointer"
                >
                  <td className="px-4 py-3 border-b border-[#edf0f3]">
                    <strong className="text-[12px] text-[#1e3a8a] font-semibold block">{c.courseCode}</strong>
                    <small className="text-[10px] text-[#697386]">{c.title}</small>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">{c.totalLectures}</td>
                  <td className="px-4 py-3 text-[12px] text-[#11875d] font-medium border-b border-[#edf0f3]">{c.attendedLectures}</td>
                  <td className="px-4 py-3 text-[12px] text-[#d14545] font-medium border-b border-[#edf0f3]">{c.totalLectures - c.attendedLectures}</td>
                  <td className="px-4 py-3 border-b border-[#edf0f3]">
                    <div className="flex items-center gap-3">
                      <strong className="text-[12px] text-[#172033] min-w-[36px]">{c.percentage}%</strong>
                      <div className="h-1.5 bg-[#e9edf2] rounded-full overflow-hidden flex-1 min-w-[60px]">
                        <div
                          className={`h-full rounded-full ${c.percentage < 75 ? 'bg-[#d14545]' : 'bg-[#0f9d8a]'}`}
                          style={{ width: `${c.percentage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-[#edf0f3]">
                    {c.isDeficient ? <Badge tone="red">Below 75%</Badge> : <Badge tone="green">On track</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {courses.length === 0 && <EmptyState message="No attendance records yet" />}
      </Card>

      {detail && (
        <Modal title={`${detail.courseCode} — Attendance detail`} onClose={() => setDetail(null)}>
          <div>
            {['03 Oct 2026', '05 Oct 2026', '10 Oct 2026', '12 Oct 2026'].map((d, i) => (
              <div key={d} className="flex justify-between items-center py-3 border-b border-[#e4e7ec] last:border-0">
                <span className="text-[11px] text-[#172033]">
                  {d}
                  <small className="block text-[8px] text-[#697386] mt-1">
                    {i % 2 ? '10:00 AM • Lecture' : '09:00 AM • Lab'}
                  </small>
                </span>
                <Badge tone={i === 2 ? 'red' : 'green'}>{i === 2 ? 'Absent' : 'Present'}</Badge>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
