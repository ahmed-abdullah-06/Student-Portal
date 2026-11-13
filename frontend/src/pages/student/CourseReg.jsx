import { useEffect, useState } from 'react';
import { CheckCircle2, Lock, Send, Loader2, Trash2 } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Badge, Spinner, Alert, PageHeader, Modal, btnPrimary, btnGhost } from '../../components/ui/UI';

export default function CourseReg() {
  const [available, setAvailable] = useState(null);
  const [registered, setRegistered] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmModal, setConfirmModal] = useState(false);

  const MAX_CR = 21;

  async function load() {
    const [av, reg] = await Promise.all([
      api.get('/student/courses/available'),
      api.get('/student/courses'),
    ]);
    setAvailable(av.data.courses);
    setRegistered(reg.data.enrollments);
  }

  useEffect(() => {
    load().catch(() => {
      setAvailable([]);
      setRegistered([]);
    });
  }, []);

  if (!available) return <Spinner label="Loading courses..." />;

  const usedCr = registered.reduce((s, e) => s + (e.section?.course?.creditHours || 0), 0);
  const selectedCr = selected.reduce((s, id) => {
    const c = available.find((x) => x.id === id);
    return s + (c?.creditHours || 0);
  }, 0);

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submitRegistration() {
    setBusy(true);
    setMsg(null);
    try {
      for (const sectionId of selected) {
        await api.post('/student/courses/register', { sectionId });
      }
      setMsg({ type: 'success', text: `Registered for ${selected.length} course(s)` });
      setSelected([]);
      setConfirmModal(false);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function dropCourse(enrollmentId) {
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/student/courses/drop/${enrollmentId}`);
      setMsg({ type: 'success', text: 'Course dropped' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Course Registration"
        subtitle={`Select courses for Fall 2026 • Registration closes 18 October`}
        action={
          <div className="flex gap-2">
            <Badge tone={usedCr + selectedCr > MAX_CR ? 'red' : 'green'}>{usedCr + selectedCr} / {MAX_CR} Credit Hours</Badge>
            <Badge tone="blue">{registered.length} Registered</Badge>
          </div>
        }
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        <div className="space-y-4">
          <Card title="Registered Courses" subtitle="Current semester enrollment" className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    {['Course', 'Title', 'Cr. Hrs', 'Section', 'Timings', ''].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registered.map((e) => (
                    <tr key={e.id} className="hover:bg-[#f9fafc]">
                      <td className="px-4 py-3 text-[12px] border-b border-[#edf0f3]">
                        <strong className="text-[#1e3a8a] font-semibold">{e.section?.course?.code}</strong>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">{e.section?.course?.title}</td>
                      <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">{e.section?.course?.creditHours}</td>
                      <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">{e.section?.name}</td>
                      <td className="px-4 py-3 text-[10px] text-[#697386] border-b border-[#edf0f3]">
                        {e.section?.timetable?.map((t) => `${t.day} ${t.startTime}–${t.endTime} (${t.room})`).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 border-b border-[#edf0f3] text-right">
                        {e.isLocked ? (
                          <Badge tone="slate"><Lock size={10} className="mr-1" /> Locked</Badge>
                        ) : (
                          <button
                            onClick={() => dropCourse(e.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-[#f5c6c6] text-[#d14545] hover:bg-[#fde8e8] transition bg-transparent"
                          >
                            <Trash2 size={12} /> Drop
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {registered.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#98a0ae]">No registered courses</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Available Courses" subtitle="Maximum allowed: 21 credit hours" className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px]">
                <thead>
                  <tr>
                    {['', 'Course', 'Title', 'Cr.', 'Faculty', 'Capacity', 'Prerequisites', ''].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {available.map((c) => {
                    const alreadyReg = c.hasCode;
                    const full = c.full || c.enrolledCount >= c.capacity;
                    const crExceeded = usedCr + selectedCr + c.creditHours > MAX_CR;
                    const canAdd = !busy && !full && c.prerequisitesMet && !alreadyReg && !crExceeded && !selected.includes(c.id);
                    return (
                      <tr key={c.id} className="hover:bg-[#f9fafc]">
                        <td className="px-4 py-3 border-b border-[#edf0f3]">
                          <input
                            type="checkbox"
                            checked={selected.includes(c.id)}
                            onChange={() => toggle(c.id)}
                            disabled={alreadyReg || full || !c.prerequisitesMet || crExceeded}
                            className="accent-[#1e3a8a] w-4 h-4"
                          />
                        </td>
                        <td className="px-4 py-3 text-[12px] border-b border-[#edf0f3]">
                          <strong className="text-[#1e3a8a] font-semibold">{c.code}</strong>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">{c.title}</td>
                        <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">{c.creditHours}</td>
                        <td className="px-4 py-3 text-[11px] text-[#172033] border-b border-[#edf0f3]">{c.facultyName || 'TBD'}</td>
                        <td className="px-4 py-3 text-[11px] border-b border-[#edf0f3]">
                          <span className={full ? 'text-[#d14545] font-semibold' : 'text-[#172033]'}>
                            {c.enrolledCount || 0}/{c.capacity}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-[#edf0f3]">
                          {c.prerequisitesMet ? (
                            c.prerequisites?.length ? (
                              <Badge tone="green"><CheckCircle2 size={10} className="mr-1" /> Met</Badge>
                            ) : (
                              <Badge tone="slate">None</Badge>
                            )
                          ) : (
                            <Badge tone="red"><Lock size={10} className="mr-1" /> Not met</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 border-b border-[#edf0f3] text-right">
                          {alreadyReg ? (
                            <Badge tone="blue">Registered</Badge>
                          ) : (
                            <button
                              onClick={() => toggle(c.id)}
                              disabled={!canAdd && !selected.includes(c.id)}
                              className={btnPrimary + ' py-1 px-2.5 text-[11px]'}
                            >
                              {selected.includes(c.id) ? 'Selected' : 'Add'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {available.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[#98a0ae]">No available courses</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden lg:sticky lg:top-[92px]">
          <div className="px-[18px] pt-4 pb-3 border-b border-[#edf0f3]">
            <h2 className="text-sm font-semibold text-[#172033] m-0">Your Selection</h2>
            <p className="text-[10px] text-[#697386] mt-1 m-0">{selected.length} courses selected</p>
          </div>
          <div className="p-4">
            <div className="space-y-2 mb-4">
              {selected.map((id) => {
                const c = available.find((x) => x.id === id);
                return (
                  <div key={id} className="flex items-center justify-between bg-[#f6f8fc] rounded-lg px-3 py-2">
                    <span>
                      <strong className="text-[11px] text-[#172033] block">{c?.code}</strong>
                      <small className="text-[9px] text-[#697386]">{c?.title}</small>
                    </span>
                    <button onClick={() => toggle(id)} className="border-0 bg-transparent text-[#d14545] text-lg leading-none p-1">
                      ×
                    </button>
                  </div>
                );
              })}
              {selected.length === 0 && (
                <p className="text-sm text-[#98a0ae] text-center py-4">No courses selected yet</p>
              )}
            </div>
            <div className="flex justify-between text-[12px] mb-4 pt-3 border-t border-[#edf0f3]">
              <span className="text-[#697386]">Total credit hours</span>
              <strong className="text-[#172033]">{usedCr + selectedCr} / {MAX_CR}</strong>
            </div>
            <button
              onClick={() => setConfirmModal(true)}
              disabled={!selected.length || busy}
              className={btnPrimary + ' w-full justify-center'}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit Registration
            </button>
            <p className="text-[9px] text-[#98a0ae] mt-3 text-center">Course registration is subject to advisor approval.</p>
          </div>
        </Card>
      </div>

      {confirmModal && (
        <Modal title="Confirm course registration" onClose={() => setConfirmModal(false)}>
          <p className="text-[12px] leading-relaxed text-[#697386]">
            You are registering for <strong>{selected.length} courses ({selectedCr} credit hours)</strong> in Fall 2026.
            You cannot change this selection after advisor approval.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setConfirmModal(false)} className={btnGhost}>Go back</button>
            <button onClick={submitRegistration} disabled={busy} className={btnPrimary}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : 'Confirm registration'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
