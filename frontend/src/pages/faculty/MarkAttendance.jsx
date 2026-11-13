import { useEffect, useState } from 'react';
import { Check, X, CalendarCheck, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, btnPrimary, inputCls, tableHead, tableCell } from '../../components/ui/UI';
import { useI18n } from '../../i18n/index.jsx';

export function SectionPicker({ sections, value, onChange, loading }) {
  const { t } = useI18n();
  if (loading) return <Spinner label={t('common.loadingSections')} />;
  return (
    <div className="flex flex-wrap gap-3">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s)}
          className={`rounded-xl border px-4 py-3 text-left transition min-w-56 ${
            value?.id === s.id
              ? 'border-[#1e3a8a] bg-[#edf2ff]'
              : 'border-[#e4e7ec] bg-white hover:border-[#8da4f0]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#1e3a8a] text-[12px]">{s.course.courseCode}</span>
            <Badge tone="blue">{s.name}</Badge>
          </div>
          <div className="text-[11px] text-[#465166] mt-1">{s.course.title}</div>
          <div className="text-[10px] text-[#98a0ae] mt-1">{s._count?.enrollments || 0} {t('common.students')}</div>
        </button>
      ))}
      {sections.length === 0 && <Alert type="info">{t('faculty.noSections')}</Alert>}
    </div>
  );
}

export default function MarkAttendance() {
  const { t } = useI18n();
  const [sections, setSections] = useState(null);
  const [section, setSection] = useState(null);
  const [roster, setRoster] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lecture, setLecture] = useState('');
  const [status, setStatus] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/faculty/sections').then((res) => {
      setSections(res.data.sections);
      if (res.data.sections.length) pick(res.data.sections[0]);
    });
  }, []);

  async function pick(s) {
    setSection(s);
    setRoster(null);
    setMsg(null);
    const res = await api.get(`/faculty/sections/${s.id}/students`);
    setRoster(res.data);
    setLecture(String(res.data.lectures + 1));
    const init = {};
    res.data.students.forEach((st) => (init[st.enrollmentId] = 'PRESENT'));
    setStatus(init);
  }

  if (!sections) return <Spinner label={t('common.loading')} />;

  const counts = roster
    ? {
        present: Object.values(status).filter((v) => v === 'PRESENT').length,
        absent: Object.values(status).filter((v) => v === 'ABSENT').length,
      }
    : { present: 0, absent: 0 };

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const records = Object.entries(status).map(([enrollmentId, st]) => ({ enrollmentId, status: st }));
      const res = await api.post(`/faculty/sections/${section.id}/attendance`, {
        date,
        lectureNumber: Number(lecture),
        records,
      });
      setMsg({ type: 'success', text: `${res.data.message} for ${res.data.marked} students` });
      await pick(section);
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('faculty.markAttendance')}
        subtitle={t('faculty.attendanceSubtitle')}
      />

      <SectionPicker sections={sections} value={section} onChange={pick} />

      {msg && <div className="mt-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      {section && roster && (
        <Card
          title={`${section.course.courseCode} — Section ${section.name}`}
          subtitle={`${section.course.title} · ${roster.students.length} enrolled students`}
          className="mt-4 p-0 overflow-hidden"
          action={
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls + ' w-36 py-1.5 text-[11px]'}
              />
              <input
                type="number"
                min="1"
                value={lecture}
                onChange={(e) => setLecture(e.target.value)}
                className={inputCls + ' w-16 py-1.5 text-[11px]'}
                title="Lecture number"
              />
            </div>
          }
        >
          <div className="flex items-center gap-3 px-[18px] pt-3 pb-2">
            <Badge tone="green">{t('common.present')}: {counts.present}</Badge>
            <Badge tone="red">{t('common.absent')}: {counts.absent}</Badge>
            <button
              onClick={() => setStatus(Object.fromEntries(roster.students.map((s) => [s.enrollmentId, 'PRESENT'])))}
              className="text-[11px] text-[#1e3a8a] hover:underline bg-transparent border-0"
            >
              {t('common.markAllPresent')}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={tableHead}>#</th>
                  <th className={tableHead}>{t('common.rollNo')}</th>
                  <th className={tableHead}>{t('common.studentName')}</th>
                  <th className={tableHead + ' text-center'}>{t('common.attendancePercent')}</th>
                  <th className={tableHead + ' text-center'}>{t('common.today')}</th>
                </tr>
              </thead>
              <tbody>
                {roster.students.map((s, i) => (
                  <tr key={s.enrollmentId} className="hover:bg-[#f9fafc]">
                    <td className={tableCell + ' text-[#98a0ae]'}>{i + 1}</td>
                    <td className={tableCell + ' font-mono text-[11px]'}>{s.rollNumber}</td>
                    <td className={tableCell + ' font-medium'}>{s.name}</td>
                    <td className={tableCell + ' text-center'}>
                      <span className={s.percentage < 75 ? 'text-[#d14545] font-semibold' : 'text-[#465166]'}>
                        {s.percentage}%
                      </span>
                    </td>
                    <td className={tableCell}>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setStatus((p) => ({ ...p, [s.enrollmentId]: 'PRESENT' }))}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center border transition ${
                            status[s.enrollmentId] === 'PRESENT'
                              ? 'bg-[#11875d] border-[#11875d] text-white'
                              : 'bg-white border-[#d8dde6] text-[#98a0ae] hover:border-[#11875d]'
                          }`}
                          title="Present"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setStatus((p) => ({ ...p, [s.enrollmentId]: 'ABSENT' }))}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center border transition ${
                            status[s.enrollmentId] === 'ABSENT'
                              ? 'bg-[#d14545] border-[#d14545] text-white'
                              : 'bg-white border-[#d8dde6] text-[#98a0ae] hover:border-[#d14545]'
                          }`}
                          title="Absent"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-[18px] py-3.5 border-t border-[#edf0f3]">
            <span className="text-[10px] text-[#98a0ae]">
              <CalendarCheck size={12} className="inline mr-1" />
              Lecture #{lecture || '?'} · {date}
            </span>
            <button onClick={save} disabled={busy} className={btnPrimary}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {busy ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
