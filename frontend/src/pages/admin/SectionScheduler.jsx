import { useEffect, useState } from 'react';
import { Plus, CalendarClock, Loader2, Save, Users } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, btnPrimary, btnSecondary, inputCls, tableHead, tableCell } from '../../components/ui/UI';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SectionScheduler() {
  const [sections, setSections] = useState(null);
  const [courses, setCourses] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(null);
  const [slots, setSlots] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ courseId: '', facultyId: '', name: 'A', semester: 5, year: 2026, capacity: 60 });

  async function load() {
    const [s, c, f, t] = await Promise.all([
      api.get('/admin/sections'),
      api.get('/admin/courses'),
      api.get('/admin/faculty'),
      api.get('/admin/timetable'),
    ]);
    setSections(s.data.sections);
    setCourses(c.data.courses);
    setFacultyList(f.data.faculty);
    setTimetable(t.data.entries);
  }

  useEffect(() => {
    load().catch(() => setSections([]));
  }, []);

  async function createSection(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post('/admin/sections', form);
      setMsg({ type: 'success', text: `Section created for ${res.data.section.course?.courseCode || 'course'}` });
      setShowForm(false);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  function openTimetable(section) {
    setActive(section);
    setSlots(section.slots.length ? section.slots.map((s) => ({ day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room || '' })) : [{ day: 'Monday', startTime: '09:00', endTime: '10:20', room: '' }]);
    setMsg(null);
  }

  async function saveTimetable() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.put(`/admin/sections/${active.id}/timetable`, { slots });
      setMsg({ type: 'success', text: `Timetable saved (${res.data.slots.length} slots)` });
      await load();
      setActive(null);
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!sections) return <Spinner label="Loading sections..." />;

  return (
    <div>
      <PageHeader
        title="Sections & Timetable"
        subtitle="Create sections, assign faculty, schedule rooms with conflict detection"
        action={
          <button onClick={() => setShowForm((v) => !v)} className={btnPrimary}>
            <Plus size={16} /> New Section
          </button>
        }
      />

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      {showForm && (
        <Card title="Create Section">
          <form onSubmit={createSection} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Course *</label>
              <select required className={inputCls} value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                <option value="">Select course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.courseCode} — {c.title}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Faculty</label>
              <select className={inputCls} value={form.facultyId} onChange={(e) => setForm({ ...form, facultyId: e.target.value })}>
                <option value="">Unassigned</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.designation})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Section</label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Capacity</label>
              <input type="number" min={1} className={inputCls} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Semester</label>
              <input type="number" min={1} max={8} className={inputCls} value={form.semester} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
              <input type="number" className={inputCls} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </div>
            <div className="lg:col-span-2 flex gap-2">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create
              </button>
              <button type="button" className={btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Sections" subtitle={`${sections.length} total`}>
          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {sections.map((s) => (
              <div key={s.id} className="border border-slate-200 rounded-xl p-4 hover:border-brand-400 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-brand-700">{s.course.courseCode}</span>
                  <div className="flex gap-2">
                    <Badge tone="blue">Sec {s.name}</Badge>
                    <Badge tone="slate">Sem {s.semester} · {s.year}</Badge>
                  </div>
                </div>
                <div className="text-sm text-slate-700">{s.course.title}</div>
                <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                  <span>{s.faculty ? `${s.faculty.name} (${s.faculty.employeeId})` : 'Unassigned'}</span>
                  <span className="flex items-center gap-1">
                    <Users size={13} /> {s._count.enrollments}/{s.capacity}
                    {!s.isActive && <Badge tone="red">Inactive</Badge>}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {s.slots.length} timetable slot{s.slots.length !== 1 ? 's' : ''}
                  </span>
                  <button onClick={() => openTimetable(s)} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                    <CalendarClock size={13} /> Edit Timetable
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          {active && (
            <Card
              title={`Timetable — ${active.course.courseCode} Section ${active.name}`}
              subtitle="Assign day, time, and room (room conflicts are blocked)"
            >
              <div className="space-y-3">
                {slots.map((s, i) => (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 mb-1">Day</label>
                      <select
                        className={inputCls + ' py-1.5 text-xs'}
                        value={s.day}
                        onChange={(e) => setSlots((p) => p.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)))}
                      >
                        {DAYS.map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 mb-1">Start</label>
                      <input type="time" className={inputCls + ' py-1.5 text-xs'} value={s.startTime} onChange={(e) => setSlots((p) => p.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))} />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 mb-1">End</label>
                      <input type="time" className={inputCls + ' py-1.5 text-xs'} value={s.endTime} onChange={(e) => setSlots((p) => p.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)))} />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 mb-1">Room</label>
                      <input placeholder="W-201" className={inputCls + ' py-1.5 text-xs'} value={s.room} onChange={(e) => setSlots((p) => p.map((x, j) => (j === i ? { ...x, room: e.target.value } : x)))} />
                    </div>
                    <div className="flex">
                      <button
                        onClick={() => setSlots((p) => p.filter((_, j) => j !== i))}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setSlots((p) => [...p, { day: 'Monday', startTime: '09:00', endTime: '10:20', room: '' }])} className={btnSecondary}>
                  <Plus size={14} /> Add Slot
                </button>
                <button onClick={saveTimetable} disabled={busy} className={btnPrimary}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save Timetable
                </button>
                <button onClick={() => setActive(null)} className="text-sm text-slate-500 hover:text-slate-700 px-3">
                  Close
                </button>
              </div>
            </Card>
          )}

          <Card title="Weekly Schedule" subtitle="All sections combined">
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr>
                    <th className={tableHead}>Day</th>
                    <th className={tableHead}>Time</th>
                    <th className={tableHead}>Course</th>
                    <th className={tableHead}>Room</th>
                    <th className={tableHead}>Faculty</th>
                  </tr>
                </thead>
                <tbody>
                  {timetable.map((e, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className={tableCell}>{e.day}</td>
                      <td className={tableCell + ' text-xs'}>{e.startTime}–{e.endTime}</td>
                      <td className={tableCell}>
                        <span className="font-semibold text-brand-700">{e.courseCode}</span>{' '}
                        <span className="text-xs text-slate-400">Sec {e.section}</span>
                      </td>
                      <td className={tableCell}>{e.room || '—'}</td>
                      <td className={tableCell + ' text-xs'}>{e.faculty}</td>
                    </tr>
                  ))}
                  {timetable.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-sm text-slate-400 py-5">No slots scheduled</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
