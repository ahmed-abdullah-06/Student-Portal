import { useEffect, useState } from 'react';
import { UserPlus, Search, KeyRound, Loader2, Ban, CheckCircle2, Pencil, Upload, ShieldCheck, Download } from 'lucide-react';
import api, { apiMessage } from '../../services/api';
import { Card, Spinner, Alert, Badge, PageHeader, Modal, Pagination, btnPrimary, btnSecondary, inputCls, tableHead, tableCell } from '../../components/ui/UI';
import Avatar from '../../components/shared/Avatar';

const labelCls = 'block text-[11px] font-semibold text-[#344054] mb-1';

const TEMPLATE_CSV = 'email,rollNumber,name,department,batch,degree,currentSemester\nstudent1@student.novastra.edu.pk,SP26-BSCS-001,Test Student,BSCS,SP26,BS Computer Science,1\n';

export default function UserManagement({ role }) {
  const isStudent = role === 'STUDENT';
  const [list, setList] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [permUser, setPermUser] = useState(null);
  const [permForm, setPermForm] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({
    email: '', password: '', name: '',
    ...(isStudent
      ? { rollNumber: '', department: 'BSCS', batch: 'SP23', currentSemester: 5 }
      : { employeeId: '', designation: 'Assistant Professor', department: 'BSCS' }),
  });

  async function load() {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    const res = await api.get(isStudent ? `/admin/students?${params}` : `/admin/faculty?${params}`);
    setList(isStudent ? res.data.students : res.data.faculty);
    setPagination(res.data.pagination || { page, limit, total: 0, totalPages: 1 });
  }

  useEffect(() => {
    load().catch(() => setList([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, limit]);

  useEffect(() => { setPage(1); }, [search]);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post(isStudent ? '/admin/students' : '/admin/faculty', form);
      setMsg({ type: 'success', text: `${isStudent ? 'Student' : 'Faculty'} ${res.data.student?.rollNumber || res.data.faculty?.employeeId} created` });
      setShowForm(false);
      setForm({
        email: '', password: '', name: '',
        ...(isStudent
          ? { rollNumber: '', department: 'BSCS', batch: 'SP23', currentSemester: 5 }
          : { employeeId: '', designation: 'Assistant Professor', department: 'BSCS' }),
      });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u) {
    setMsg(null);
    try {
      await api.put(`/admin/users/${u.id}`, { isActive: !u.isActive });
      setMsg({ type: 'success', text: `Account ${u.isActive ? 'deactivated' : 'activated'}` });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    }
  }

  function openEdit(r) {
    setEditing(r);
    setEditForm(
      isStudent
        ? { name: r.name, rollNumber: r.rollNumber, department: r.department, batch: r.batch, currentSemester: r.currentSemester ?? r.semester }
        : { name: r.name, employeeId: r.employeeId, designation: r.designation, department: r.department }
    );
  }

  async function saveEdit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.put(isStudent ? `/admin/students/${editing.id}` : `/admin/faculty/${editing.id}`, editForm);
      setMsg({ type: 'success', text: `${isStudent ? 'Student' : 'Faculty'} updated` });
      setEditing(null);
      setEditForm(null);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(u) {
    const pw = prompt(`New password for ${u.email}:`);
    if (!pw) return;
    setMsg(null);
    try {
      const res = await api.post(`/admin/users/${u.id}/reset-password`, { password: pw });
      setMsg({ type: 'success', text: res.data.message });
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    }

  }

  async function bulkStatus(isActive) {
    if (!selected.length) return;
    setBusy(true); setMsg(null);
    try {
      const res = await api.post('/admin/users/bulk-status', { userIds: selected, isActive });
      setMsg({ type: 'success', text: `${res.data.updated} account(s) updated` }); setSelected([]); await load();
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  async function bulkReset() {
    if (!selected.length) return;
    const password = prompt('Temporary password (leave blank to generate one):');
    if (password === null) return;
    setBusy(true); setMsg(null);
    try {
      const res = await api.post('/admin/users/bulk-reset-password', { userIds: selected, ...(password ? { password } : {}) });
      setMsg({ type: 'success', text: `${res.data.updated} password(s) reset. Temporary password: ${res.data.temporaryPassword}` }); setSelected([]);
    } catch (err) { setMsg({ type: 'error', text: apiMessage(err) }); } finally { setBusy(false); }
  }

  async function openPermissions(r) {
    setMsg(null);
    try {
      if (!catalog) {
        const res = await api.get('/admin/permission-catalog');
        setCatalog(res.data.permissions);
      }
      setPermForm(r.user?.permissions || []);
      setPermUser({ id: r.userId, email: r.user?.email, name: r.name });
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    }
  }

  async function savePermissions(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.put(`/admin/users/${permUser.id}/permissions`, { permissions: permForm });
      setMsg({ type: 'success', text: `Permissions updated for ${permUser.email}` });
      setPermUser(null);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function importCsv(e) {
    e.preventDefault();
    if (!importFile) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await api.post('/admin/students/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(res.data);
      setImportFile(null);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!list) return <Spinner label={`Loading ${isStudent ? 'students' : 'faculty'}...`} />;

  return (
    <div>
      <PageHeader
        title={`${isStudent ? 'Students' : 'Faculty'} Management`}
        subtitle="Onboard accounts, bulk import, permissions, reset passwords, deactivate access"
        action={
          <div className="flex flex-wrap gap-2">
            {isStudent && (
              <>
                <button onClick={downloadTemplate} className={btnSecondary}><Download size={15} /> Template</button>
                <button onClick={() => { setImportOpen((v) => !v); setImportResult(null); }} className={btnSecondary}>
                  <Upload size={15} /> Import CSV
                </button>
              </>
            )}
            <button onClick={() => setShowForm((v) => !v)} className={btnPrimary}>
              <UserPlus size={16} /> Add {isStudent ? 'Student' : 'Faculty'}
            </button>
          </div>
        }
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      {importOpen && isStudent && (
        <Card title="Bulk import students (CSV)" className="mb-4">
          <p className="text-[11px] text-[#697386] mt-0 mb-3">
            Required columns: <code>email, rollNumber, name, department, batch</code>. Optional:{' '}
            <code>password, degree, currentSemester, cnic, guardianName, phone, address</code>. Rows without a password get{' '}
            <strong>Welcome123</strong> and must change it at first login.
          </p>
          <form onSubmit={importCsv} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="text-[12px] text-[#465166]"
              aria-label="CSV file to import"
            />
            <button type="submit" disabled={busy || !importFile} className={btnPrimary}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload & import
            </button>
            <button type="button" onClick={() => setImportOpen(false)} className={btnSecondary}>Close</button>
          </form>
          {importResult && (
            <div className="mt-3">
              <Alert type={importResult.skipped?.length ? 'warning' : 'success'}>
                Imported {importResult.created} of {importResult.total} rows.
                {importResult.skipped?.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-[11px]">
                    {importResult.skipped.slice(0, 8).map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}
                  </ul>
                )}
              </Alert>
            </div>
          )}
        </Card>
      )}

      {showForm && (
        <Card title={`New ${isStudent ? 'Student' : 'Faculty'} Account`} className="mb-4 p-0 overflow-hidden">
          <form onSubmit={create} className="px-5 pt-4 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Password *</label>
              <input required type="password" minLength={6} className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            {isStudent ? (
              <>
                <div>
                  <label className={labelCls}>Roll Number *</label>
                  <input required placeholder="SP24-BSCS-011" className={inputCls} value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Batch</label>
                  <input className={inputCls} value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Current Semester</label>
                  <input type="number" min={1} max={8} className={inputCls} value={form.currentSemester} onChange={(e) => setForm({ ...form, currentSemester: Number(e.target.value) })} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelCls}>Employee ID *</label>
                  <input required placeholder="FAC-004" className={inputCls} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Designation</label>
                  <select className={inputCls} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}>
                    <option>Professor</option>
                    <option>Associate Professor</option>
                    <option>Assistant Professor</option>
                    <option>Lecturer</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className={labelCls}>Department</label>
              <select className={inputCls} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option>BSCS</option>
                <option>BSSE</option>
                <option>BEE</option>
                <option>COMMON</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-2 pt-1">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Create Account
              </button>
              <button type="button" onClick={() => setShowForm(false)} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title={`All ${isStudent ? 'Students' : 'Faculty'}`}
        subtitle={`${pagination.total} records`}
        className="p-0 overflow-hidden"
        action={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a0ae]" />
            <input
              placeholder="Search name / ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search records"
              className={inputCls + ' pl-9 py-1.5 text-[11px] w-48'}
            />
          </div>
        }
      >
        {selected.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-[#edf0f3] bg-[#f8fafc] px-4 py-3" role="toolbar" aria-label="Bulk user operations">
          <span className="text-xs font-semibold text-[#344054]">{selected.length} selected</span>
          <button type="button" disabled={busy} onClick={() => bulkStatus(true)} className={btnSecondary}>Activate</button>
          <button type="button" disabled={busy} onClick={() => bulkStatus(false)} className={btnSecondary}>Deactivate</button>
          <button type="button" disabled={busy} onClick={bulkReset} className={btnSecondary}>Reset passwords</button>
        </div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th className={tableHead}><input type="checkbox" aria-label="Select all records" checked={list.length > 0 && list.every((r) => selected.includes(r.userId))} onChange={(e) => setSelected(e.target.checked ? list.map((r) => r.userId) : [])} /></th>
                <th className={tableHead}>{isStudent ? 'Roll No' : 'Employee ID'}</th>
                <th className={tableHead}>Name</th>
                <th className={tableHead}>Email</th>
                <th className={tableHead}>Department</th>
                {isStudent ? <th className={tableHead + ' text-center'}>Semester</th> : <th className={tableHead}>Designation</th>}
                <th className={tableHead + ' text-center'}>Status</th>
                <th className={tableHead + ' text-right'}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const u = r.user;
                return (
                  <tr key={r.id} className="hover:bg-[#f9fafc]">
                    <td className={tableCell}><input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.includes(r.userId)} onChange={(e) => setSelected((current) => e.target.checked ? [...new Set([...current, r.userId])] : current.filter((id) => id !== r.userId))} /></td>
                    <td className={tableCell + ' font-mono text-[11px] font-semibold text-[#1e3a8a]'}>
                      {isStudent ? r.rollNumber : r.employeeId}
                    </td>
                    <td className={tableCell + ' font-medium'}>
                      <span className="inline-flex items-center gap-2">
                        <Avatar name={r.name} src={r.photoUrl} size="h-7 w-7" />
                        {r.name}
                      </span>
                    </td>
                    <td className={tableCell + ' text-[11px] text-[#697386]'}>{u?.email}</td>
                    <td className={tableCell}>{r.department}</td>
                    <td className={tableCell + ' text-center'}>{isStudent ? r.semester ?? r.currentSemester : r.designation}</td>
                    <td className={tableCell + ' text-center'}>
                      {u?.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}
                    </td>
                    <td className={tableCell + ' text-right'}>
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(r)}
                          className="py-1.5 px-2 text-[11px] rounded-lg border border-[#e4e7ec] text-[#697386] hover:bg-[#f6f8fc] transition bg-transparent"
                          title="Edit"
                          aria-label={`Edit ${r.name}`}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => toggleActive({ id: r.userId, email: u?.email, isActive: u?.isActive })}
                          className={`py-1.5 px-2 text-[11px] rounded-lg border transition ${
                            u?.isActive
                              ? 'border-[#f5c6c6] text-[#d14545] hover:bg-[#fde8e8]'
                              : 'border-[#c8e8d8] text-[#11875d] hover:bg-[#e9f7f0]'
                          }`}
                          title={u?.isActive ? 'Deactivate' : 'Activate'}
                          aria-label={`${u?.isActive ? 'Deactivate' : 'Activate'} ${r.name}`}
                        >
                          {u?.isActive ? <Ban size={12} /> : <CheckCircle2 size={12} />}
                        </button>
                        <button
                          onClick={() => resetPassword({ id: r.userId, email: u?.email })}
                          className="py-1.5 px-2 text-[11px] rounded-lg border border-[#e4e7ec] text-[#697386] hover:bg-[#f6f8fc] transition bg-transparent"
                          title="Reset password"
                          aria-label={`Reset password for ${r.name}`}
                        >
                          <KeyRound size={12} />
                        </button>
                        <button
                          onClick={() => openPermissions(r)}
                          className="py-1.5 px-2 text-[11px] rounded-lg border border-[#e4e7ec] text-[#1e3a8a] hover:bg-[#edf2ff] transition bg-transparent"
                          title="Edit permissions"
                          aria-label={`Edit permissions for ${r.name}`}
                        >
                          <ShieldCheck size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr><td colSpan={8} className="text-center py-6 text-sm text-[#98a0ae]">No records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={limit}
          onPage={setPage}
          onLimit={(n) => { setLimit(n); setPage(1); }}
        />
      </Card>

      {editing && editForm && (
        <Modal title={`Edit ${isStudent ? 'Student' : 'Faculty'}`} onClose={() => { setEditing(null); setEditForm(null); }}>
          <form onSubmit={saveEdit} className="space-y-3">
            <div>
              <label className={labelCls}>Name</label>
              <input required className={inputCls} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            {isStudent ? (
              <>
                <div>
                  <label className={labelCls}>Roll Number</label>
                  <input required className={inputCls} value={editForm.rollNumber} onChange={(e) => setEditForm({ ...editForm, rollNumber: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Batch</label>
                    <input className={inputCls} value={editForm.batch} onChange={(e) => setEditForm({ ...editForm, batch: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Semester</label>
                    <input type="number" min={1} max={8} className={inputCls} value={editForm.currentSemester} onChange={(e) => setEditForm({ ...editForm, currentSemester: Number(e.target.value) })} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelCls}>Employee ID</label>
                  <input required className={inputCls} value={editForm.employeeId} onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Designation</label>
                  <select className={inputCls} value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}>
                    <option>Professor</option>
                    <option>Associate Professor</option>
                    <option>Assistant Professor</option>
                    <option>Lecturer</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className={labelCls}>Department</label>
              <select className={inputCls} value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}>
                <option>BSCS</option>
                <option>BSSE</option>
                <option>BEE</option>
                <option>COMMON</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={busy} className={btnPrimary + ' flex-1 justify-center'}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Save Changes
              </button>
              <button type="button" onClick={() => { setEditing(null); setEditForm(null); }} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {permUser && catalog && (
        <Modal title={`Permissions — ${permUser.email}`} onClose={() => setPermUser(null)}>
          <form onSubmit={savePermissions} className="space-y-3">
            <p className="text-[11px] text-[#697386] m-0">
              Granular RBAC grants (ADMIN role always has full access; these matter for delegated staff accounts).
            </p>
            <fieldset className="border-0 p-0 m-0">
              <legend className="sr-only">Permission grants</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 max-h-[320px] overflow-y-auto border border-[#e4e7ec] rounded-lg p-3">
                {catalog.map((p) => (
                  <label key={p} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-[#0f9d8a]"
                      checked={permForm.includes(p)}
                      onChange={(e) =>
                        setPermForm((prev) => (e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)))
                      }
                    />
                    <span className="text-[11px] font-mono text-[#465166]">{p}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={btnPrimary + ' flex-1 justify-center'}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Save permissions
              </button>
              <button type="button" onClick={() => setPermUser(null)} className={btnSecondary}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
