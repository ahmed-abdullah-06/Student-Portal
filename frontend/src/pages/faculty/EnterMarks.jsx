import { useEffect, useState } from 'react';
import { Save, Lock, Unlock, Loader2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, btnPrimary, btnSecondary, tableHead, tableCell } from '../../components/ui/UI';
import { SectionPicker } from './MarkAttendance';

const COMPONENTS = [
  { key: 'assignments', label: 'Assignments', weight: '10%', color: '#1e3a8a' },
  { key: 'quizzes', label: 'Quizzes', weight: '10%', color: '#0f9d8a' },
  { key: 'midterms', label: 'Midterms (OHT)', weight: '20%', color: '#d18a17' },
  { key: 'finals', label: 'Final Term', weight: '60%', color: '#7854ad' },
];

export default function EnterMarks() {
  const [sections, setSections] = useState(null);
  const [section, setSection] = useState(null);
  const [roster, setRoster] = useState(null);
  const [component, setComponent] = useState('quizzes');
  const [values, setValues] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [freezing, setFreezing] = useState(false);

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
    const init = {};
    res.data.students.forEach((st) => (init[st.enrollmentId] = String(st[component])));
    setValues(init);
  }

  function changeComponent(key) {
    setComponent(key);
    if (roster) {
      const init = {};
      roster.students.forEach((st) => (init[st.enrollmentId] = String(st[key])));
      setValues(init);
    }
  }

  if (!sections) return <Spinner label="Loading..." />;

  const anyLocked = roster?.students.some((s) => s.isLocked);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const marks = Object.entries(values).map(([enrollmentId, value]) => ({
        enrollmentId,
        value: Number(value),
      }));
      const res = await api.post(`/faculty/sections/${section.id}/marks`, { component, marks });
      setMsg({ type: 'success', text: res.data.message });
      await pick(section);
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleFreeze() {
    setFreezing(true);
    setMsg(null);
    try {
      const freeze = !anyLocked;
      const res = await api.post(`/faculty/sections/${section.id}/freeze`, { freeze });
      setMsg({ type: 'success', text: res.data.message });
      await pick(section);
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setFreezing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Enter Marks"
        subtitle="Marks are 0–100 per component · Final grade = Assign 10% + Quiz 10% + Mid 20% + Final 60%"
      />

      <SectionPicker sections={sections} value={section} onChange={pick} />

      {msg && <div className="mt-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      {section && roster && (
        <Card
          title={`${section.course.courseCode} — Section ${section.name}`}
          subtitle={`${roster.students.length} students · any change recomputes totals and grades`}
          className="mt-4 p-0 overflow-hidden"
          action={
            <button
              onClick={toggleFreeze}
              disabled={freezing}
              className={anyLocked ? 'inline-flex items-center gap-2 rounded-lg bg-[#d18a17] hover:bg-[#b57412] text-white px-3 py-1.5 text-[11px] font-medium transition border-0' : btnSecondary + ' py-1.5 px-3 text-[11px]'}
            >
              {freezing ? <Loader2 size={12} className="animate-spin" /> : anyLocked ? <Unlock size={12} /> : <Lock size={12} />}
              {anyLocked ? 'Unlock Result' : 'Freeze Result'}
            </button>
          }
        >
          <div className="flex flex-wrap gap-2 px-[18px] pt-3 pb-2">
            {COMPONENTS.map((c) => (
              <button
                key={c.key}
                onClick={() => changeComponent(c.key)}
                className={`rounded-lg border px-3.5 py-1.5 text-[11px] font-medium transition ${
                  component === c.key
                    ? 'border-[#1e3a8a] bg-[#1e3a8a] text-white'
                    : 'bg-white border-[#d8dde6] text-[#465166] hover:border-[#8da4f0]'
                }`}
              >
                {c.label} <span className={component === c.key ? 'text-[#b8c9f7]' : 'text-[#98a0ae]'}>({c.weight})</span>
              </button>
            ))}
          </div>

          {anyLocked && (
            <div className="px-[18px] pb-2">
              <Alert type="warning">Result is frozen — unlock it before making further edits.</Alert>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className={tableHead}>#</th>
                  <th className={tableHead}>Roll No</th>
                  <th className={tableHead}>Name</th>
                  <th className={tableHead + ' text-center'}>{COMPONENTS.find((c) => c.key === component).label}</th>
                  <th className={tableHead + ' text-right'}>Weighted Total</th>
                  <th className={tableHead + ' text-center'}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {roster.students.map((s, i) => (
                  <tr key={s.enrollmentId} className="hover:bg-[#f9fafc]">
                    <td className={tableCell + ' text-[#98a0ae]'}>{i + 1}</td>
                    <td className={tableCell + ' font-mono text-[11px]'}>{s.rollNumber}</td>
                    <td className={tableCell + ' font-medium'}>{s.name}</td>
                    <td className={tableCell}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={values[s.enrollmentId] ?? ''}
                        disabled={s.isLocked}
                        onChange={(e) => setValues((p) => ({ ...p, [s.enrollmentId]: e.target.value }))}
                        className="w-20 mx-auto block rounded-lg border border-[#d8dde6] px-2.5 py-1.5 text-[12px] text-center focus:outline-none focus:border-[#1e3a8a] disabled:bg-[#f3f4f6] disabled:text-[#98a0ae]"
                      />
                    </td>
                    <td className={tableCell + ' text-right font-semibold'}>{s.totalMarks}</td>
                    <td className={tableCell + ' text-center'}>
                      {s.gradeLetter ? <Badge tone="green">{s.gradeLetter}</Badge> : <span className="text-[#d8dde6]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end px-[18px] py-3.5 border-t border-[#edf0f3]">
            <button onClick={save} disabled={busy || anyLocked} className={btnPrimary}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {busy ? 'Saving...' : `Save ${COMPONENTS.find((c) => c.key === component).label} Marks`}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
