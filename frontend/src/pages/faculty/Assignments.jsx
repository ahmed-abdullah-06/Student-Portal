import { useEffect, useState } from 'react';
import { Download, Loader2, Plus, Upload } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import {
  Card, Badge, Spinner, Alert, EmptyState, Modal, PageHeader,
  tableHead, tableCell, btnPrimary, btnGhost, btnSecondary, inputCls, Field,
} from '../../components/ui/UI';
import { SectionPicker } from './MarkAttendance';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

async function downloadBlob(url, name) {
  const res = await api.get(url, { responseType: 'blob' });
  const href = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
  window.URL.revokeObjectURL(href);
}

const blankForm = { type: 'ASSIGNMENT', title: '', description: '', startDate: '', dueDate: '' };

export default function FacultyAssignments() {
  const [sections, setSections] = useState(null);
  const [section, setSection] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [rosterCount, setRosterCount] = useState(0);
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [grades, setGrades] = useState({});

  useEffect(() => {
    api.get('/faculty/sections').then((res) => {
      setSections(res.data.sections);
      if (res.data.sections.length) pick(res.data.sections[0]);
    });
  }, []);

  async function pick(s) {
    setSection(s);
    setTasks(null);
    setMsg(null);
    const res = await api.get(`/faculty/sections/${s.id}/tasks`);
    setTasks(res.data.tasks);
    setRosterCount(res.data.rosterCount);
    const g = {};
    res.data.tasks.forEach((t) => t.submissions.forEach((sub) => {
      g[sub.id] = { comment: sub.comment || '', marks: sub.marks ?? '' };
    }));
    setGrades(g);
  }

  async function reload() {
    if (!section) return;
    const res = await api.get(`/faculty/sections/${section.id}/tasks`);
    setTasks(res.data.tasks);
    setRosterCount(res.data.rosterCount);
    const g = {};
    res.data.tasks.forEach((t) => t.submissions.forEach((sub) => {
      g[sub.id] = { comment: sub.comment || '', marks: sub.marks ?? '' };
    }));
    setGrades(g);
  }

  async function createTask(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('type', form.type);
      fd.append('title', form.title);
      fd.append('description', form.description);
      if (form.startDate) fd.append('startDate', new Date(form.startDate).toISOString());
      if (form.dueDate) fd.append('dueDate', new Date(form.dueDate).toISOString());
      if (file) fd.append('file', file);
      await api.post(`/faculty/sections/${section.id}/tasks`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setOpen(false);
      setForm(blankForm);
      setFile(null);
      await reload();
      setMsg({ type: 'success', text: 'Task created.' });
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function saveGrade(sub) {
    setMsg(null);
    try {
      const g = grades[sub.id] || {};
      await api.patch(`/faculty/submissions/${sub.id}`, {
        comment: g.comment,
        marks: g.marks === '' ? null : g.marks,
      });
      await reload();
      setMsg({ type: 'success', text: 'Submission updated.' });
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    }
  }

  return (
    <div>
      <PageHeader
        title="Assignments & Quizzes"
        subtitle="Post tasks, share files and review student submissions"
        action={
          <button onClick={() => setOpen(true)} disabled={!section} className={btnPrimary}>
            <Plus size={15} /> New task
          </button>
        }
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <div className="mb-4">
        <SectionPicker sections={sections || []} value={section} onChange={pick} loading={!sections} />
      </div>

      {tasks === null ? (
        <Spinner label="Loading tasks..." />
      ) : tasks.length === 0 ? (
        <Card><EmptyState message="No assignments or quizzes posted for this course yet." /></Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((t) => (
            <Card key={t.id} className="p-0 overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 border-b border-[#edf0f3] bg-[#f9fafc]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={t.type === 'QUIZ' ? 'amber' : 'blue'}>{t.type === 'QUIZ' ? 'Quiz' : 'Assignment'}</Badge>
                    <strong className="text-[13px] text-[#172033]">{t.title}</strong>
                    <Badge tone={t.submissions.length >= rosterCount && rosterCount > 0 ? 'green' : 'slate'}>
                      {t.submissions.length}/{rosterCount} submitted
                    </Badge>
                  </div>
                  <small className="block text-[10px] text-[#697386] mt-1">
                    Start: {formatDateTime(t.startDate)} · Due: {formatDateTime(t.dueDate)}
                  </small>
                  {t.description && <p className="text-[11px] text-[#697386] mt-1 mb-0">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {t.fileName && (
                    <button
                      type="button"
                      onClick={() => downloadBlob(`/faculty/tasks/${t.id}/download`, t.fileName).catch((err) => setMsg({ type: 'error', text: apiMessage(err) }))}
                      className={btnSecondary}
                    >
                      <Download size={13} /> {t.fileName}
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr>
                      {['Student', 'Submitted', 'File', 'Marks', 'Comment', ''].map((h) => (
                        <th key={h} className={tableHead}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-[#f9fafc]">
                        <td className={tableCell}>
                          <strong className="text-[#1e3a8a] font-semibold">{sub.student.rollNumber}</strong>
                          <small className="block text-[10px] text-[#697386]">{sub.student.name}</small>
                        </td>
                        <td className={tableCell}>{formatDateTime(sub.submittedAt)}</td>
                        <td className={tableCell}>
                          <button
                            type="button"
                            onClick={() => downloadBlob(`/faculty/submissions/${sub.id}/download`, sub.fileName).catch((err) => setMsg({ type: 'error', text: apiMessage(err) }))}
                            className="inline-flex items-center gap-1 text-[11px] text-[#1e3a8a] hover:underline bg-transparent border-0 p-0"
                          >
                            <Download size={12} /> {sub.fileName}
                          </button>
                        </td>
                        <td className={tableCell}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={grades[sub.id]?.marks ?? ''}
                            onChange={(e) => setGrades({ ...grades, [sub.id]: { ...(grades[sub.id] || {}), marks: e.target.value } })}
                            className="w-20 rounded-md border border-[#d8dde6] px-2 py-1 text-[12px]"
                          />
                        </td>
                        <td className={tableCell}>
                          <input
                            type="text"
                            placeholder="Comment..."
                            value={grades[sub.id]?.comment || ''}
                            onChange={(e) => setGrades({ ...grades, [sub.id]: { ...(grades[sub.id] || {}), comment: e.target.value } })}
                            className="w-full min-w-[160px] rounded-md border border-[#d8dde6] px-2 py-1 text-[12px]"
                          />
                        </td>
                        <td className={tableCell}>
                          <button type="button" onClick={() => saveGrade(sub)} className={btnGhost}>Save</button>
                        </td>
                      </tr>
                    ))}
                    {t.submissions.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-[12px] text-[#98a0ae]">No submissions yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <Modal title="Create assignment / quiz" onClose={() => setOpen(false)}>
          <form onSubmit={createTask} className="space-y-3.5">
            <div>
              <label className="block text-[12px] font-semibold text-[#344054] mb-2">Type</label>
              <div className="flex gap-2">
                {['ASSIGNMENT', 'QUIZ'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
                      form.type === t ? 'border-[#1e3a8a] bg-[#edf2ff] text-[#1e3a8a]' : 'border-[#d8dde6] text-[#465166]'
                    }`}
                  >
                    {t === 'QUIZ' ? 'Quiz' : 'Assignment'}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Title">
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputCls}
                placeholder="e.g. Assignment 1 — Linked Lists"
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputCls + ' resize-y'}
                placeholder="Instructions for students..."
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Due date">
                <input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div>
              <label htmlFor="task-attachment" className="block text-[12px] font-semibold text-[#344054] mb-2">Attachment (optional)</label>
              <input
                id="task-attachment"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-[12px] text-[#465166] file:mr-3 file:rounded-md file:border-0 file:bg-[#edf2ff] file:px-3 file:py-2 file:text-[11px] file:font-medium file:text-[#1e3a8a] hover:file:bg-[#e1e9ff]"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {saving ? 'Creating...' : 'Create task'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
