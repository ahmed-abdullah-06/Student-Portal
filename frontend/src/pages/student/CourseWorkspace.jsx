import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, ClipboardList,
  Download, FileText, Upload, XCircle,
} from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import {
  Card, Badge, Spinner, Alert, EmptyState, Modal, tableHead, tableCell,
  btnSecondary, btnPrimary, btnGhost,
} from '../../components/ui/UI';

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

const TABS = [
  'Course Notification', 'Attendance', 'Marks Summary', 'Learning Resources',
  'Assignments', 'Quizzes', 'Course Information',
];
const WEIGHTS = [
  { key: 'assignments', label: 'Assignments', weight: 10 },
  { key: 'quizzes', label: 'Quizzes', weight: 10 },
  { key: 'midterms', label: 'Midterms', weight: 20 },
  { key: 'finals', label: 'Finals', weight: 60 },
];

function gradeFromPercentage(pct) {
  return GRADE_SCALE.find((g) => pct >= g.min);
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes) {
  if (!bytes) return '—';
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileExt(task) {
  if (task.fileName?.includes('.')) return task.fileName.split('.').pop().toUpperCase();
  if (task.fileType === 'application/pdf') return 'PDF';
  return 'FILE';
}

async function downloadTask(task) {
  const res = await api.get(`/student/tasks/${task.id}/download`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = task.fileName || 'attachment';
  link.click();
  window.URL.revokeObjectURL(url);
}

function gradeBadgeClass(letter) {
  if (letter === 'F') return 'bg-[#fde8e8] text-[#d14545] border-[#f5c6c6]';
  if (letter.startsWith('A')) return 'bg-[#e9f7f0] text-[#11875d] border-[#c8e8d8]';
  if (letter.startsWith('B')) return 'bg-[#edf2ff] text-[#1e3a8a] border-[#c8d4f5]';
  return 'bg-[#fff6e5] text-[#d18a17] border-[#f1d9a8]';
}

export default function CourseWorkspace() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(TABS[0]);
  const [uploadTask, setUploadTask] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [notice, setNotice] = useState(null);

  function load() {
    return api.get(`/student/courses/${id}`).then((res) => setData(res.data));
  }

  useEffect(() => {
    load().catch((err) => setError(apiMessage(err)));
  }, [id]);

  async function submitFile(e) {
    e.preventDefault();
    if (!file) {
      setUploadMsg({ type: 'error', text: 'Choose a file to upload' });
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/student/tasks/${uploadTask.id}/submit`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await load();
      setUploadTask(null);
      setFile(null);
      setNotice({ type: 'success', text: 'Submission uploaded successfully.' });
    } catch (err) {
      setUploadMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setUploading(false);
    }
  }

  if (error) {
    return (
      <div>
        <Link to="/student" className="inline-flex items-center gap-1.5 text-[12px] text-[#1e3a8a] hover:underline mb-4">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <Alert type="error">{error}</Alert>
      </div>
    );
  }
  if (!data) return <Spinner label="Loading course..." />;

  const { course, enrollment, attendance, materials, notices, evaluation, tasks = [] } = data;
  const lockedGrade = enrollment.isLocked ? gradeFromPercentage(enrollment.totalMarks) : null;

  function renderTaskTable(list, title, emptyText) {
    return (
      <Card title={title} subtitle="Download the task file and upload your submission" className="p-0 overflow-hidden">
        {list.length === 0 ? (
          <EmptyState message={emptyText} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr>
                  {['#', 'Title', 'Start Date', 'Last Date', 'File Size', 'File Type', 'Action', 'Teacher Comments'].map((h) => (
                    <th key={h} className={tableHead}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((t, i) => (
                  <tr key={t.id} className="hover:bg-[#f9fafc]">
                    <td className={tableCell}>{i + 1}</td>
                    <td className={tableCell}>
                      <strong className="text-[#172033] font-semibold">{t.title}</strong>
                      {t.description && <small className="block text-[10px] text-[#697386] mt-0.5">{t.description}</small>}
                    </td>
                    <td className={tableCell}>{formatDateTime(t.startDate)}</td>
                    <td className={tableCell}>{formatDateTime(t.dueDate)}</td>
                    <td className={tableCell}>{formatSize(t.fileSize)}</td>
                    <td className={tableCell}>
                      {t.fileName ? <Badge tone="red">{fileExt(t)}</Badge> : <span className="text-[#98a0ae]">—</span>}
                    </td>
                    <td className={tableCell}>
                      <div className="flex flex-wrap items-center gap-3">
                        {t.fileName && (
                          <button
                            type="button"
                            onClick={() => downloadTask(t).catch((err) => setNotice({ type: 'error', text: apiMessage(err) }))}
                            className="inline-flex items-center gap-1 text-[11px] text-[#1e3a8a] hover:underline bg-transparent border-0 p-0"
                          >
                            <Download size={13} /> Download
                          </button>
                        )}
                        {t.submission ? (
                          <span className="inline-flex items-center gap-2">
                            <Badge tone="green"><CheckCircle2 size={10} className="mr-0.5" /> Submitted</Badge>
                            <button
                              type="button"
                              onClick={() => { setUploadTask(t); setFile(null); setUploadMsg(null); }}
                              className="text-[10px] text-[#697386] underline bg-transparent border-0 p-0"
                            >
                              Replace
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setUploadTask(t); setFile(null); setUploadMsg(null); }}
                            className="inline-flex items-center gap-1 rounded-md border border-[#d8dde6] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1e3a8a] hover:bg-[#f3f5f8]"
                          >
                            <Upload size={12} /> Upload
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={tableCell}>
                      <span className="text-[11px] text-[#697386]">
                        {t.submission?.comment || t.teacherComments || '—'}
                      </span>
                      {t.submission?.marks !== null && t.submission?.marks !== undefined && (
                        <Badge tone="blue">{t.submission.marks} marks</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div>
      <Link to="/student" className="inline-flex items-center gap-1.5 text-[12px] text-[#1e3a8a] hover:underline mb-4">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <div className="rounded-[10px] px-5 sm:px-6 py-5 bg-gradient-to-r from-[#18377f] via-[#294ba5] to-[#23609d] text-white relative overflow-hidden mb-4">
        <div className="absolute w-[250px] h-[250px] rounded-full right-[130px] -top-[170px] border-[50px] border-white/5" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[10px] font-bold tracking-[1.8px] text-[#a8eee4]">{course.code}</span>
            <h1 className="text-[19px] sm:text-[22px] tracking-[-0.4px] mt-1.5 mb-1">{course.title}</h1>
            <p className="text-[11px] text-[#d7e1fa] m-0">
              Credit Hours: {course.creditHours} · Section {course.section} · Teacher: {course.faculty?.name || 'TBD'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={attendance.isDeficient ? 'red' : 'green'}>
              {attendance.percentage}% Attendance
            </Badge>
            <Badge tone={evaluation ? 'blue' : 'amber'}>
              {evaluation ? 'Evaluated' : 'Evaluation pending'}
            </Badge>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap gap-2 mt-5" role="tablist" aria-label="Course sections">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-medium border transition ${
                tab === t
                  ? 'bg-white text-[#18377f] border-white'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {notice && <div className="mb-4"><Alert type={notice.type}>{notice.text}</Alert></div>}

      {tab === 'Course Notification' && (
        <Card title="Course notifications" subtitle="Announcements and notices from the university">
          {notices.length === 0 ? (
            <EmptyState message="No announcements right now." />
          ) : (
            <div className="divide-y divide-[#edf0f3]">
              {notices.map((n) => (
                <div key={n.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="text-[12px] text-[#172033] block">{n.title}</strong>
                      <p className="text-[12px] text-[#697386] mt-1 mb-0 whitespace-pre-line">{n.body}</p>
                    </div>
                    <small className="text-[10px] text-[#98a0ae] shrink-0">{formatDate(n.createdAt)}</small>
                  </div>
                  {n.author?.email && (
                    <small className="text-[10px] text-[#98a0ae] block mt-1.5">Posted by {n.author.email}</small>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'Attendance' && (
        <>
          {attendance.isDeficient && (
            <div className="mb-4">
              <Alert type="warning">
                Attendance is below the required {data.minAttendance}% for this course.
              </Alert>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Lectures', value: attendance.totalLectures },
              { label: 'Present', value: attendance.attendedLectures },
              { label: 'Absent', value: attendance.absentLectures },
              { label: 'Attendance', value: `${attendance.percentage}%` },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <span className="block text-[9px] text-[#697386] uppercase tracking-[0.4px]">{s.label}</span>
                <strong className="block text-[20px] text-[#172033] mt-1">{s.value}</strong>
              </Card>
            ))}
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr>
                    {['Date', 'Lecture', 'Status'].map((h) => (
                      <th key={h} className={tableHead}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.records.map((r) => (
                    <tr key={r.id} className="hover:bg-[#f9fafc]">
                      <td className={tableCell}>{formatDate(r.date)}</td>
                      <td className={tableCell}>Lecture {r.lectureNumber}</td>
                      <td className={tableCell}>
                        {r.status === 'PRESENT' ? (
                          <Badge tone="green"><CheckCircle2 size={10} className="mr-1" /> Present</Badge>
                        ) : (
                          <Badge tone="red"><XCircle size={10} className="mr-1" /> Absent</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {attendance.records.length === 0 && <EmptyState message="No attendance recorded for this course yet." />}
          </Card>
        </>
      )}

      {tab === 'Marks Summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr] gap-4">
          <Card title="Marks breakdown" subtitle="Weighted assessment components" className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead>
                  <tr>
                    {['Component', 'Weight', 'Marks'].map((h) => (
                      <th key={h} className={tableHead}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEIGHTS.map((w) => (
                    <tr key={w.key} className="hover:bg-[#f9fafc]">
                      <td className={tableCell}>{w.label}</td>
                      <td className={tableCell}>{w.weight}%</td>
                      <td className={tableCell}>
                        <strong className="font-semibold">{enrollment[w.key]}</strong>
                        <span className="text-[#98a0ae]"> / 100</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Result" subtitle={`Semester ${enrollment.semester}`}>
            <div className="text-center py-3">
              <span className="block text-[9px] text-[#697386] uppercase tracking-[0.4px]">Weighted Total</span>
              <strong className="block text-[30px] text-[#172033] mt-1">{enrollment.totalMarks}%</strong>
              <div className="mt-3">
                {enrollment.isLocked && lockedGrade ? (
                  <span className={`inline-flex px-3 py-1 rounded text-[12px] font-semibold border ${gradeBadgeClass(lockedGrade.letter)}`}>
                    Grade {lockedGrade.letter} · {lockedGrade.points.toFixed(2)} GP
                  </span>
                ) : (
                  <Badge tone="amber">Result not published yet</Badge>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#edf0f3]">
              {evaluation ? (
                <p className="text-[11px] text-[#697386] m-0">Course evaluation submitted — final result will unlock with the semester result.</p>
              ) : (
                <p className="text-[11px] text-[#697386] m-0">
                  Submit your <Link to="/student/evaluations" className="text-[#1e3a8a] underline">course evaluation</Link> to unlock your final result.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === 'Learning Resources' && (
        <Card title="Learning resources" subtitle="Slides, notes and reference material shared for this course" className="p-0 overflow-hidden">
          {materials.length === 0 ? (
            <EmptyState message="No resources uploaded for this course yet." />
          ) : (
            <div className="divide-y divide-[#edf0f3]">
              {materials.map((m) => (
                <div key={m.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-lg bg-[#edf2ff] text-[#1e3a8a] flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[12px] text-[#172033]">{m.title}</strong>
                      <Badge tone="slate">{m.type}</Badge>
                    </div>
                    {m.content && <p className="text-[11px] text-[#697386] mt-1 mb-0 whitespace-pre-line">{m.content}</p>}
                    <small className="text-[10px] text-[#98a0ae] block mt-1">
                      {m.fileName ? `${m.fileName} · ` : ''}{formatDate(m.createdAt)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'Assignments' && renderTaskTable(
        tasks.filter((t) => t.type === 'ASSIGNMENT'),
        'Assignments',
        'No assignments posted for this course yet.'
      )}

      {tab === 'Quizzes' && renderTaskTable(
        tasks.filter((t) => t.type === 'QUIZ'),
        'Quizzes',
        'No quizzes posted for this course yet.'
      )}

      {tab === 'Course Information' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Course details" subtitle={course.department}>
            <dl className="grid grid-cols-[110px_1fr] gap-y-2.5 text-[12px] m-0">
              <dt className="text-[#697386]">Course code</dt><dd className="text-[#172033] m-0 font-medium">{course.code}</dd>
              <dt className="text-[#697386]">Title</dt><dd className="text-[#172033] m-0 font-medium">{course.title}</dd>
              <dt className="text-[#697386]">Credit hours</dt><dd className="text-[#172033] m-0 font-medium">{course.creditHours}</dd>
              <dt className="text-[#697386]">Section</dt><dd className="text-[#172033] m-0 font-medium">{course.section}</dd>
              <dt className="text-[#697386]">Semester</dt><dd className="text-[#172033] m-0 font-medium">{enrollment.semester} ({enrollment.year})</dd>
              <dt className="text-[#697386]">Department</dt><dd className="text-[#172033] m-0 font-medium">{course.department}</dd>
            </dl>
            {course.description && (
              <p className="text-[12px] text-[#697386] mt-4 mb-0 pt-3 border-t border-[#edf0f3]">{course.description}</p>
            )}
          </Card>
          <div className="space-y-4">
            <Card title="Instructor" subtitle="Course teacher">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#e7f8f5] text-[#0f9d8a] flex items-center justify-center shrink-0">
                  <BookOpen size={18} />
                </div>
                <div>
                  <strong className="text-[12px] text-[#172033] block">{course.faculty?.name || 'To be announced'}</strong>
                  <small className="text-[10px] text-[#697386]">
                    {[course.faculty?.designation, course.faculty?.department].filter(Boolean).join(' · ') || '—'}
                  </small>
                  {course.faculty && (
                    <div className="mt-2 text-[10px] text-slate-600">
                      {course.faculty.officeHours && <div>Office hours: {course.faculty.officeHours}</div>}
                      {course.faculty.phone && <div>Contact: {course.faculty.phone}</div>}
                      {course.faculty.bio && <p className="mt-1">{course.faculty.bio}</p>}
                    </div>
                  )}
                </div>
              </div>
            </Card>
            <Card title="Weekly schedule" subtitle="Class timings and rooms">
              {course.slots.length === 0 ? (
                <EmptyState message="No schedule set for this section." />
              ) : (
                <div className="space-y-2">
                  {course.slots.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#edf0f3] px-3 py-2">
                      <span className="text-[11px] font-medium text-[#172033] flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-[#1e3a8a]" /> {s.day}
                      </span>
                      <span className="text-[11px] text-[#697386] flex items-center gap-1.5">
                        <ClipboardList size={13} className="text-[#98a0ae]" /> {s.startTime} – {s.endTime}
                      </span>
                      <Badge tone="slate">{s.room || 'TBD'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card title="Course evaluation" subtitle="Anonymous teaching feedback">
              <div className="flex items-center justify-between gap-3">
                <Badge tone={evaluation ? 'green' : 'amber'}>
                  {evaluation ? `Submitted ${formatDate(evaluation.submittedAt)}` : 'Not submitted'}
                </Badge>
                <Link to="/student/evaluations" className={btnSecondary}>
                  Open evaluations <ArrowRight size={13} />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}

      {uploadTask && (
        <Modal title={`Upload submission: ${uploadTask.title}`} onClose={() => { setUploadTask(null); setFile(null); }}>
          <form onSubmit={submitFile} className="space-y-4">
            {uploadMsg && <Alert type={uploadMsg.type}>{uploadMsg.text}</Alert>}
            <div>
              <label htmlFor="task-file" className="block text-[12px] font-semibold text-[#344054] mb-2">
                Submission file
              </label>
              <input
                id="task-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-[12px] text-[#465166] file:mr-3 file:rounded-md file:border-0 file:bg-[#edf2ff] file:px-3 file:py-2 file:text-[11px] file:font-medium file:text-[#1e3a8a] hover:file:bg-[#e1e9ff]"
              />
              <p className="text-[10px] text-[#98a0ae] mt-2 mb-0">PDF, image or spreadsheet · max 10 MB</p>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={uploading} className={btnPrimary}>
                {uploading ? 'Uploading...' : 'Submit'}
              </button>
              <button type="button" className={btnGhost} onClick={() => { setUploadTask(null); setFile(null); }}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
