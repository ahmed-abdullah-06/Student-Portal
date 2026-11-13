import { Fragment, useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, BookA, ChevronDown, ChevronRight } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, btnPrimary, btnSecondary, inputCls, tableHead, tableCell } from '../../components/ui/UI';

const labelCls = 'block text-[11px] font-semibold text-[#344054] mb-1';

export default function CourseManagement() {
  const [courses, setCourses] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ courseCode: '', title: '', creditHours: 3, department: 'BSCS', description: '', prerequisiteIds: [] });

  async function load() {
    const res = await api.get('/admin/courses');
    setCourses(res.data.courses);
  }

  useEffect(() => {
    load().catch(() => setCourses([]));
  }, []);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post('/admin/courses', form);
      setMsg({ type: 'success', text: `Course ${res.data.course.courseCode} created` });
      setShowForm(false);
      setForm({ courseCode: '', title: '', creditHours: 3, department: 'BSCS', description: '', prerequisiteIds: [] });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(course) {
    if (!confirm(`Delete ${course.courseCode} — ${course.title}?`)) return;
    setMsg(null);
    try {
      await api.delete(`/admin/courses/${course.id}`);
      setMsg({ type: 'success', text: `${course.courseCode} deleted` });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    }
  }

  async function savePrereqs(course, ids) {
    setMsg(null);
    try {
      await api.put(`/admin/courses/${course.id}`, { prerequisiteIds: ids });
      setMsg({ type: 'success', text: `Prerequisites updated for ${course.courseCode}` });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    }
  }

  if (!courses) return <Spinner label="Loading courses..." />;

  return (
    <div>
      <PageHeader
        title="Course & Curriculum"
        subtitle="Master registry — course codes, credit hours, prerequisites"
        action={
          <button onClick={() => setShowForm((v) => !v)} className={btnPrimary}>
            <Plus size={16} /> New Course
          </button>
        }
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      {showForm && (
        <Card title="Create Course" className="mb-4 p-0 overflow-hidden">
          <form onSubmit={create} className="px-5 pt-4 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Course Code *</label>
              <input required placeholder="CS-401" className={inputCls} value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Title *</label>
              <input required placeholder="Machine Learning" className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Credit Hours *</label>
              <input required type="number" min={1} max={6} className={inputCls} value={form.creditHours} onChange={(e) => setForm({ ...form, creditHours: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <select className={inputCls} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option>BSCS</option>
                <option>BSSE</option>
                <option>BEE</option>
                <option>COMMON</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelCls}>Description</label>
              <input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Course
              </button>
              <button type="button" className={btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Course Registry" subtitle={`${courses.length} courses`} className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className={tableHead}></th>
                <th className={tableHead}>Code</th>
                <th className={tableHead}>Title</th>
                <th className={tableHead + ' text-center'}>Cr. Hrs</th>
                <th className={tableHead}>Department</th>
                <th className={tableHead}>Prerequisites</th>
                <th className={tableHead + ' text-center'}>Sections</th>
                <th className={tableHead + ' text-right'}></th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <Fragment key={c.id}>
                  <tr className="hover:bg-[#f9fafc]">
                    <td className={tableCell}>
                      <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-[#98a0ae] hover:text-[#1e3a8a] bg-transparent border-0">
                        {expanded === c.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                    </td>
                    <td className={tableCell + ' font-semibold text-[#1e3a8a]'}>{c.courseCode}</td>
                    <td className={tableCell}>{c.title}</td>
                    <td className={tableCell + ' text-center'}>{c.creditHours}</td>
                    <td className={tableCell}>{c.department}</td>
                    <td className={tableCell}>
                      {c.prerequisites.length === 0 ? (
                        <span className="text-[11px] text-[#98a0ae]">None</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {c.prerequisites.map((p) => (
                            <Badge key={p.courseCode} tone="blue">{p.courseCode}</Badge>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className={tableCell + ' text-center'}>{c._count.sections}</td>
                    <td className={tableCell + ' text-right'}>
                      <button onClick={() => remove(c)} className="p-1.5 text-[#d14545] hover:bg-[#fde8e8] rounded-lg bg-transparent border-0" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                  {expanded === c.id && (
                    <tr key={c.id + '-prereq'}>
                      <td colSpan={8} className="bg-[#f9fafc] px-6 py-4">
                        <div className="text-[10px] font-semibold text-[#697386] uppercase mb-2 flex items-center gap-1.5">
                          <BookA size={13} /> Edit Prerequisites for {c.courseCode}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {courses
                            .filter((x) => x.id !== c.id)
                            .map((x) => {
                              const checked = c.prerequisites.some((p) => p.courseCode === x.courseCode);
                              return (
                                <label
                                  key={x.id}
                                  className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-[11px] cursor-pointer transition ${
                                    checked ? 'border-[#1e3a8a] bg-[#edf2ff] text-[#1e3a8a]' : 'border-[#d8dde6] bg-white text-[#465166]'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const ids = e.target.checked
                                        ? [...c.prerequisites.map((p) => p.id), x.id]
                                        : c.prerequisites.filter((p) => p.courseCode !== x.courseCode).map((p) => p.id);
                                      savePrereqs(c, ids);
                                    }}
                                    className="accent-[#1e3a8a]"
                                  />
                                  {x.courseCode}
                                </label>
                              );
                            })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
