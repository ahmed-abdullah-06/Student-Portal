import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, PageHeader, Tabs, btnPrimary } from '../../components/ui/UI';

const GRADE_SCALE = [
  { min: 85, letter: 'A', points: 4.0 },
  { min: 80, letter: 'A-', points: 3.67 },
  { min: 75, letter: 'B+', points: 3.33 },
  { min: 70, letter: 'B', points: 3.0 },
  { min: 65, letter: 'B-', points: 2.67 },
  { min: 60, letter: 'C+', points: 2.33 },
  { min: 55, letter: 'C', points: 2.0 },
  { min: 50, letter: 'C-', points: 1.67 },
  { min: 45, letter: 'D', points: 1.0 },
  { min: 0, letter: 'F', points: 0.0 },
];

function gradeFromPercentage(pct) {
  return GRADE_SCALE.find((g) => pct >= g.min);
}

export default function Marks() {
  const { profile } = useAuth();
  const [marks, setMarks] = useState(null);
  const [courses, setCourses] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [activeSem, setActiveSem] = useState('All');

  useEffect(() => {
    Promise.all([
      api.get('/student/marks'),
      api.get('/student/courses'),
      api.get('/student/transcript'),
    ])
      .then(([m, c, t]) => {
        setMarks(m.data.marks);
        setCourses(c.data.enrollments);
        setTranscript(t.data);
      })
      .catch(() => setMarks({}));
  }, []);

  async function downloadTranscript(type) {
    setDownloading(true);
    setMsg(null);
    try {
      const res = await api.get(`/student/certificates/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-${profile?.rollNumber || 'certificate'}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setDownloading(false);
    }
  }

  if (!marks || !courses) return <Spinner label="Loading results..." />;

  const semesters = ['All', ...[...new Set(marks.map((m) => `Semester ${m.semester}`))]];
  const filtered = activeSem === 'All' ? marks : marks.filter((m) => `Semester ${m.semester}` === activeSem);

  return (
    <div>
      <PageHeader
        title="Results & Transcript"
        subtitle="Review semester results and academic progress"
        action={
          <button onClick={() => downloadTranscript('transcript')} disabled={downloading} className={btnPrimary}>
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download Transcript
          </button>
        }
      />

      {msg && <div className="mb-4"><div className="border rounded-lg px-4 py-3 text-sm bg-red-50 border-red-200 text-red-700">{msg.text}</div></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {[
          { label: 'Semester GPA', value: transcript?.sgpa?.toFixed(2) ?? '—', sub: activeSem === 'All' ? 'Current' : activeSem, color: '#1e3a8a' },
          { label: 'Cumulative GPA', value: transcript?.cgpa?.toFixed(2) ?? '—', sub: `${transcript?.totalCreditHours || 0} credit hours completed`, color: '#1e3a8a' },
          { label: 'Academic Standing', value: (transcript?.cgpa || 0) >= 2.0 ? 'Good' : 'Probation', sub: (transcript?.cgpa || 0) >= 3.5 ? "Dean's Honour List" : 'Keep working hard', color: (transcript?.cgpa || 0) >= 2.0 ? '#11875d' : '#d14545' },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <span className="block text-[9px] text-[#697386] uppercase tracking-[0.4px]">{s.label}</span>
            <strong className="block text-[22px] mt-1.5 mb-1" style={{ color: s.color }}>{s.value}</strong>
            <small className="block text-[10px] text-[#98a0ae]">{s.sub}</small>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="border-b border-[#e4e7ec]">
          <Tabs tabs={semesters} active={activeSem} onChange={setActiveSem} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                {['Code', 'Course Title', 'Credit Hrs', 'Marks', 'Grade', 'GPA Points'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const pct = m.total ?? 0;
                const band = gradeFromPercentage(pct);
                const course = courses.find((c) => c.sectionId === m.sectionId || c.course?.code === m.courseCode);
                return (
                  <tr key={m.id} className="hover:bg-[#f9fafc]">
                    <td className="px-4 py-3 text-[12px] border-b border-[#edf0f3]">
                      <strong className="text-[#1e3a8a] font-semibold">{m.courseCode}</strong>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">
                      {course?.course?.title || m.courseTitle || '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">{course?.course?.creditHours || '—'}</td>
                    <td className="px-4 py-3 text-[12px] text-[#172033] font-semibold border-b border-[#edf0f3]">{pct}%</td>
                    <td className="px-4 py-3 border-b border-[#edf0f3]">
                      {m.isLocked ? (
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          band.letter === 'F' ? 'bg-[#fde8e8] text-[#d14545] border-[#f5c6c6]'
                          : band.letter.startsWith('A') ? 'bg-[#e9f7f0] text-[#11875d] border-[#c8e8d8]'
                          : band.letter.startsWith('B') ? 'bg-[#edf2ff] text-[#1e3a8a] border-[#c8d4f5]'
                          : 'bg-[#fff6e5] text-[#d18a17] border-[#f1d9a8]'
                        }`}>{band.letter}</span>
                      ) : (
                        <span className="text-[12px] text-[#98a0ae]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">
                      {m.isLocked ? band.points.toFixed(2) : '—'}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#98a0ae]">No results yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
