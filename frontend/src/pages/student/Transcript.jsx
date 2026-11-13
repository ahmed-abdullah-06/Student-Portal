import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, tableHead, tableCell, btnPrimary, btnGhost } from '../../components/ui/UI';

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

function gradeFromPercentage(percentage) {
  const band = GRADE_SCALE.find((g) => percentage >= g.min);
  return { letter: band.letter, points: band.points };
}

function computeWeightedPercentage({ assignments = 0, quizzes = 0, midterms = 0, finals = 0 }) {
  return assignments * 0.1 + quizzes * 0.1 + midterms * 0.2 + finals * 0.6;
}

function StatTile({ label, value, color }) {
  return (
    <Card className="p-5 text-center">
      <strong className="block text-[22px] mt-1" style={{ color: color || '#1e3a8a' }}>{value}</strong>
      <span className="block text-[9px] text-[#697386] uppercase tracking-[0.4px] mt-1">{label}</span>
    </Card>
  );
}

export default function Transcript() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [marks, setMarks] = useState({});
  const [msg, setMsg] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/student/enrolled-courses'),
      api.get('/student/attendance'),
      api.get('/student/marks'),
    ])
      .then(([c, a, m]) => {
        setCourses(c.data.courses);
        setAttendance(a.data.attendance);
        setMarks(m.data.marks);
      })
      .catch(() => setCourses([]));
  }, []);

  async function downloadCertificate(type) {
    setDownloading(type);
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
      setDownloading(null);
    }
  }

  if (!courses) return <Spinner label="Loading transcript..." />;

  const completed = [];
  const inProgress = [];
  let totalQP = 0;
  let totalCH = 0;
  let currentSemQP = 0;
  let currentSemCH = 0;

  for (const c of courses) {
    const m = marks[c.id];
    const att = attendance[c.id] || 0;
    if (m != null && att >= 75) {
      const pct = computeWeightedPercentage(m);
      const { letter, points } = gradeFromPercentage(pct);
      const qp = points * c.creditHours;
      completed.push({ ...c, marks: Math.round(pct), grade: letter, gradePoints: points, qualityPoints: qp });
      totalQP += qp;
      totalCH += c.creditHours;
    } else {
      inProgress.push({ ...c, attendance: att, progress: m != null ? Math.round(computeWeightedPercentage(m)) : null });
    }
  }

  for (const c of courses) {
    const m = marks[c.id];
    const att = attendance[c.id] || 0;
    if (m != null && att >= 75) {
      const pct = computeWeightedPercentage(m);
      const { points } = gradeFromPercentage(pct);
      currentSemQP += points * c.creditHours;
      currentSemCH += c.creditHours;
    }
  }

  const cgpa = totalCH > 0 ? totalQP / totalCH : 0;
  const currentSemesterGPA = currentSemCH > 0 ? currentSemQP / currentSemCH : 0;

  const gpaData = {
    cgpa,
    currentSemesterGPA,
    creditsCompleted: totalCH,
    creditsInProgress: inProgress.reduce((s, c) => s + c.creditHours, 0),
    totalQualityPoints: totalQP,
  };

  return (
    <div>
      <PageHeader
        title="Transcript / CGPA"
        subtitle={`${profile?.name} · ${profile?.rollNumber} · ${profile?.program} · Batch ${profile?.batch}`}
        action={
          <div className="flex gap-2">
            <button onClick={() => downloadCertificate('transcript')} disabled={downloading} className={btnPrimary}>
              {downloading === 'transcript' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Transcript PDF
            </button>
            <button onClick={() => downloadCertificate('domicile')} disabled={downloading} className={btnGhost}>
              {downloading === 'domicile' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Domicile Certificate
            </button>
          </div>
        }
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <StatTile label="CGPA" value={gpaData.cgpa.toFixed(2)} color="#1e3a8a" />
        <StatTile label="Credits Completed" value={gpaData.creditsCompleted} color="#172033" />
        <StatTile label="Current Semester GPA" value={gpaData.currentSemesterGPA.toFixed(2)} color="#0f9d8a" />
        <StatTile label="In-Progress Credits" value={gpaData.creditsInProgress} color="#d18a17" />
      </div>

      <Card title="Completed Courses" subtitle={`${completed.length} courses with final grades`} className="mb-4 p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className={tableHead}>Code</th>
                <th className={tableHead}>Course</th>
                <th className={tableHead + ' text-center'}>Credit Hours</th>
                <th className={tableHead + ' text-center'}>Marks</th>
                <th className={tableHead + ' text-center'}>Grade</th>
                <th className={tableHead + ' text-center'}>Grade Points</th>
                <th className={tableHead + ' text-center'}>Quality Points</th>
              </tr>
            </thead>
            <tbody>
              {completed.map((c) => (
                <tr key={c.id} className="hover:bg-[#f9fafc]">
                  <td className={tableCell + ' font-mono text-[11px] font-semibold text-[#1e3a8a]'}>{c.code}</td>
                  <td className={tableCell}>{c.title}</td>
                  <td className={tableCell + ' text-center'}>{c.creditHours}</td>
                  <td className={tableCell + ' text-center font-semibold'}>{c.marks}%</td>
                  <td className={tableCell + ' text-center'}>
                    <Badge tone={c.grade === 'F' ? 'red' : c.grade.startsWith('A') ? 'green' : 'blue'}>
                      {c.grade}
                    </Badge>
                  </td>
                  <td className={tableCell + ' text-center font-semibold'}>{c.gradePoints.toFixed(2)}</td>
                  <td className={tableCell + ' text-center font-bold text-[#1e3a8a]'}>
                    {c.qualityPoints.toFixed(2)}
                  </td>
                </tr>
              ))}
              {completed.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-[12px] text-[#98a0ae] py-8">No completed courses yet</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#e4e7ec]">
                <td colSpan={3} className="px-4 py-3 text-right font-semibold text-[#465166] text-[12px]">Total</td>
                <td className="px-4 py-3 text-center font-bold text-[#172033] text-[12px]">
                  {gpaData.creditsCompleted} CH
                </td>
                <td className="px-4 py-3 text-center font-bold text-[#172033] text-[12px]">
                  {gpaData.cgpa.toFixed(2)} CGPA
                </td>
                <td colSpan={2} className="px-4 py-3 text-center font-bold text-[#1e3a8a] text-[12px]">
                  {gpaData.totalQualityPoints.toFixed(2)} QP
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {inProgress.length > 0 && (
        <Card title="In-Progress Courses" subtitle={`${inProgress.length} courses this semester`} className="mb-4 p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={tableHead}>Code</th>
                  <th className={tableHead}>Course</th>
                  <th className={tableHead + ' text-center'}>Credit Hours</th>
                  <th className={tableHead + ' text-center'}>Attendance</th>
                  <th className={tableHead + ' text-center'}>Current Progress</th>
                </tr>
              </thead>
              <tbody>
                {inProgress.map((c) => (
                  <tr key={c.id} className="hover:bg-[#f9fafc]">
                    <td className={tableCell + ' font-mono text-[11px] font-semibold text-[#1e3a8a]'}>{c.code}</td>
                    <td className={tableCell}>{c.title}</td>
                    <td className={tableCell + ' text-center'}>{c.creditHours}</td>
                    <td className={tableCell + ' text-center'}>
                      <Badge tone={attendance[c.id] >= 75 ? 'green' : 'red'}>{attendance[c.id] || 0}%</Badge>
                    </td>
                    <td className={tableCell + ' text-center'}>
                      <Badge tone="amber">{marks[c.id] ? `${marks[c.id]}%` : 'Pending'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Grading Scale" className="p-0 overflow-hidden">
        <div className="px-[18px] py-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
            {[
              { grade: 'A', points: '4.00', tone: 'green' },
              { grade: 'A-', points: '3.67', tone: 'green' },
              { grade: 'B+', points: '3.33', tone: 'blue' },
              { grade: 'B', points: '3.00', tone: 'blue' },
              { grade: 'B-', points: '2.67', tone: 'blue' },
              { grade: 'C+', points: '2.33', tone: 'amber' },
              { grade: 'C', points: '2.00', tone: 'amber' },
              { grade: 'C-', points: '1.67', tone: 'amber' },
              { grade: 'D', points: '1.00', tone: 'red' },
              { grade: 'F', points: '0.00', tone: 'red' },
            ].map((g) => (
              <div key={g.grade} className="flex items-center gap-2 bg-[#f9fafc] rounded-lg px-3 py-2 border border-[#edf0f3]">
                <Badge tone={g.tone}>{g.grade}</Badge>
                <span className="text-[#465166]">{g.points}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-[#98a0ae]">
            Transcript shows courses with final grades only. In-progress courses will appear once marks are submitted.
            Minimum attendance required: 75%.
          </p>
        </div>
      </Card>
    </div>
  );
}
