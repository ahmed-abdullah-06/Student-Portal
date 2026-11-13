import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, CalendarDays } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, btnPrimary, btnSecondary, btnDanger, inputCls, tableHead, tableCell } from '../../components/ui/UI';

export default function SemesterManagement() {
  const [semesters, setSemesters] = useState(null);
  const [exams, setExams] = useState(null);
  const [sections, setSections] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showSem, setShowSem] = useState(false);
  const [showExam, setShowExam] = useState(false);
  const [semForm, setSemForm] = useState({ name: '', year: 2026, term: 'FALL', registrationOpen: '', registrationClose: '', evaluationOpen: '', evaluationClose: '', resultPublishDate: '', feeDueDate: '' });
  const [examForm, setExamForm] = useState({ sectionId: '', semesterId: '', type: 'MIDTERM', date: '', startTime: '09:00', endTime: '12:00', room: '' });

  async function load() {
    const [s, e, sec] = await Promise.all([
      api.get('/admin/semesters'),
      api.get('/admin/exams'),
      api.get('/admin/sections'),
    ]);
    setSemesters(s.data.semesters);
    setExams(e.data.exams);
    setSections(sec.data.sections || []);
  }

  useEffect(() => { load().catch(() => { setSemesters([]); setExams([]); }); }, []);

  async function createSem(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.post('/admin/semesters', semForm);
      setMsg({ type: 'success', text: 'Semester created' });
      setShowSem(false);
      setSemForm({ name: '', year: 2026, term: 'FALL', registrationOpen: '', registrationClose: '', evaluationOpen: '', evaluationClose: '', resultPublishDate: '', feeDueDate: '' });
      await load();
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  async function setCurrent(id) {
    try {
      await api.put(`/admin/semesters/${id}`, { isCurrent: true });
      await load();
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); }
  }

  async function removeSem(id) {
    if (!confirm('Delete this semester?')) return;
    try { await api.delete(`/admin/semesters/${id}`); await load(); } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); }
  }

  async function createExam(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.post('/admin/exams', examForm);
      setMsg({ type: 'success', text: 'Exam scheduled' });
      setShowExam(false);
      await load();
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  async function removeExam(id) {
    if (!confirm('Remove this exam?')) return;
    try { await api.delete(`/admin/exams/${id}`); await load(); } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); }
  }

  if (!semesters) return <Spinner label="Loading semesters..." />;

  return (
    <div>
      <PageHeader
        title="Semesters & Exams"
        subtitle="Manage academic terms, key dates and examination schedules"
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowSem((v) => !v)} className={btnPrimary}><Plus size={15} /> New Semester</button>
            <button onClick={() => setShowExam((v) => !v)} className={btnSecondary}><CalendarDays size={15} /> Schedule Exam</button>
          </div>
        }
      />
      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      {showSem && (
        <Card title="Create Semester" className="mb-4">
          <form onSubmit={createSem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><label className="block text-xs text-slate-600 mb-1">Name</label><input required className={inputCls} value={semForm.name} onChange={(e) => setSemForm({ ...semForm, name: e.target.value })} placeholder="Fall 2027" /></div>
            <div><label className="block text-xs text-slate-600 mb-1">Year</label><input type="number" className={inputCls} value={semForm.year} onChange={(e) => setSemForm({ ...semForm, year: Number(e.target.value) })} /></div>
            <div><label className="block text-xs text-slate-600 mb-1">Term</label><select className={inputCls} value={semForm.term} onChange={(e) => setSemForm({ ...semForm, term: e.target.value })}><option>FALL</option><option>SPRING</option><option>SUMMER</option></select></div>
            <div><label className="block text-xs text-slate-600 mb-1">Reg. Open</label><input type="date" className={inputCls} value={semForm.registrationOpen} onChange={(e) => setSemForm({ ...semForm, registrationOpen: e.target.value })} /></div>
            <div><label className="block text-xs text-slate-600 mb-1">Reg. Close</label><input type="date" className={inputCls} value={semForm.registrationClose} onChange={(e) => setSemForm({ ...semForm, registrationClose: e.target.value })} /></div>
            <div><label className="block text-xs text-slate-600 mb-1">Fee Due</label><input type="date" className={inputCls} value={semForm.feeDueDate} onChange={(e) => setSemForm({ ...semForm, feeDueDate: e.target.value })} /></div>
            <div><label className="block text-xs text-slate-600 mb-1">Eval. Open</label><input type="date" className={inputCls} value={semForm.evaluationOpen} onChange={(e) => setSemForm({ ...semForm, evaluationOpen: e.target.value })} /></div>
            <div><label className="block text-xs text-slate-600 mb-1">Eval. Close</label><input type="date" className={inputCls} value={semForm.evaluationClose} onChange={(e) => setSemForm({ ...semForm, evaluationClose: e.target.value })} /></div>
            <div className="lg:col-span-4"><button type="submit" disabled={busy} className={btnPrimary}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create</button></div>
          </form>
        </Card>
      )}

      {showExam && (
        <Card title="Schedule Exam" className="mb-4">
          <form onSubmit={createExam} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><label className="block text-xs text-slate-600 mb-1">Section</label>
              <select required className={inputCls} value={examForm.sectionId} onChange={(e) => setExamForm({ ...examForm, sectionId: e.target.value })}>
                <option value="">Select section</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.course?.courseCode} — {s.name} (Sem {s.semester})</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-600 mb-1">Semester</label>
              <select required className={inputCls} value={examForm.semesterId} onChange={(e) => setExamForm({ ...examForm, semesterId: e.target.value })}>
                <option value="">Select semester</option>
                {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-600 mb-1">Type</label><select className={inputCls} value={examForm.type} onChange={(e) => setExamForm({ ...examForm, type: e.target.value })}><option>MIDTERM</option><option>FINAL</option></select></div>
            <div><label className="block text-xs text-slate-600 mb-1">Date</label><input type="date" required className={inputCls} value={examForm.date} onChange={(e) => setExamForm({ ...examForm, date: e.target.value })} /></div>
            <div><label className="block text-xs text-slate-600 mb-1">Start</label><input type="time" required className={inputCls} value={examForm.startTime} onChange={(e) => setExamForm({ ...examForm, startTime: e.target.value })} /></div>
            <div><label className="block text-xs text-slate-600 mb-1">End</label><input type="time" required className={inputCls} value={examForm.endTime} onChange={(e) => setExamForm({ ...examForm, endTime: e.target.value })} /></div>
            <div className="lg:col-span-3"><button type="submit" disabled={busy} className={btnPrimary}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Schedule</button></div>
          </form>
        </Card>
      )}

      <Card title="Semesters" className="mb-4 p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr>
              <th className={tableHead}>Name</th><th className={tableHead}>Term</th><th className={tableHead}>Reg. Window</th>
              <th className={tableHead}>Fee Due</th><th className={tableHead}>Current</th><th className={tableHead}>Actions</th>
            </tr></thead>
            <tbody>
              {semesters.map((s) => (
                <tr key={s.id} className="hover:bg-[#f9fafc]">
                  <td className={tableCell + ' font-semibold'}>{s.name}</td>
                  <td className={tableCell}>{s.term} {s.year}</td>
                  <td className={tableCell}>{s.registrationOpen ? new Date(s.registrationOpen).toLocaleDateString() : '—'} → {s.registrationClose ? new Date(s.registrationClose).toLocaleDateString() : '—'}</td>
                  <td className={tableCell}>{s.feeDueDate ? new Date(s.feeDueDate).toLocaleDateString() : '—'}</td>
                  <td className={tableCell}>{s.isCurrent ? <Badge tone="green">Current</Badge> : <Badge tone="gray">Past</Badge>}</td>
                  <td className={tableCell}>
                    <div className="flex gap-1.5">
                      {!s.isCurrent && <button onClick={() => setCurrent(s.id)} className={btnSecondary + ' py-1 px-2 text-[10px]'}>Set Current</button>}
                      <button onClick={() => removeSem(s.id)} className={btnDanger + ' py-1 px-2 text-[10px]'}><Trash2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Exam Schedule" className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr>
              <th className={tableHead}>Date</th><th className={tableHead}>Type</th><th className={tableHead}>Course</th>
              <th className={tableHead}>Section</th><th className={tableHead}>Time</th><th className={tableHead}>Room</th><th className={tableHead}></th>
            </tr></thead>
            <tbody>
              {(exams || []).map((e) => (
                <tr key={e.id} className="hover:bg-[#f9fafc]">
                  <td className={tableCell}>{new Date(e.date).toLocaleDateString()}</td>
                  <td className={tableCell}><Badge tone={e.type === 'MIDTERM' ? 'amber' : 'red'}>{e.type}</Badge></td>
                  <td className={tableCell + ' font-mono font-semibold text-[#1e3a8a]'}>{e.section?.course?.courseCode}</td>
                  <td className={tableCell}>{e.section?.name}</td>
                  <td className={tableCell}>{e.startTime}–{e.endTime}</td>
                  <td className={tableCell}>{e.room || 'TBA'}</td>
                  <td className={tableCell}><button onClick={() => removeExam(e.id)} className={btnDanger + ' py-1 px-2 text-[10px]'}><Trash2 size={11} /></button></td>
                </tr>
              ))}
              {(!exams || exams.length === 0) && <tr><td colSpan={7} className="text-center py-6 text-sm text-[#98a0ae]">No exams scheduled</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
