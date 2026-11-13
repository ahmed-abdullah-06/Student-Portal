import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api, { apiMessage } from '../../services/api';
import { Card, Badge, Tabs, PageHeader, Alert, btnPrimary, btnGhost, inputCls, Modal } from '../../components/ui/UI';
import { Pencil, Loader2, Camera } from 'lucide-react';

function Info({ label, value }) {
  return (
    <div>
      <span className="block text-[9px] text-[#697386] uppercase tracking-[0.4px] mb-1.5">{label}</span>
      <strong className="block text-[12px] text-[#172033] font-semibold">{value || '—'}</strong>
    </div>
  );
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const emptyForm = {
  name: '', phone: '', cnic: '', guardianName: '', guardianPhone: '', address: '', permanentAddress: '',
  dateOfBirth: '', gender: '', bloodGroup: '', nationality: 'Pakistani',
  emergencyContactName: '', emergencyContactPhone: '', matricMarks: '', interMarks: '', advisorName: '',
};

export default function Profile() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState('Personal');
  const [student, setStudent] = useState(null);
  const [completion, setCompletion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const isStudent = user?.role === 'STUDENT';
  const tabs = isStudent ? ['Personal', 'Academic', 'Contact', 'Guardian'] : ['Personal', 'Academic', 'Contact'];
  const p = student || profile;

  async function loadProfile() {
    if (!isStudent) return;
    try {
      const res = await api.get('/student/profile');
      setStudent(res.data.student);
      setCompletion(res.data.completion);
    } catch {
      setCompletion(0);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit() {
    setForm({
      name: p?.name || '',
      phone: p?.phone || '',
      cnic: p?.cnic || '',
      guardianName: p?.guardianName || '',
      guardianPhone: p?.guardianPhone || '',
      address: p?.address || '',
      permanentAddress: p?.permanentAddress || '',
      dateOfBirth: p?.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
      gender: p?.gender || '',
      bloodGroup: p?.bloodGroup || '',
      nationality: p?.nationality || 'Pakistani',
      emergencyContactName: p?.emergencyContactName || '',
      emergencyContactPhone: p?.emergencyContactPhone || '',
      matricMarks: p?.matricMarks ?? '',
      interMarks: p?.interMarks ?? '',
      advisorName: p?.advisorName || '',
    });
    setEditing(true);
    setMsg(null);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.put('/student/profile', form);
      setStudent(res.data.student);
      setCompletion(res.data.completion);
      setMsg({ type: 'success', text: res.data.message });
      setEditing(false);
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    const data = new FormData();
    // Normalize uploads client-side so profile photos are fast and consistently sized.
    const optimized = await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const size = 640;
        const scale = Math.min(1, size / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.85);
      };
      image.onerror = () => resolve(file);
      image.src = URL.createObjectURL(file);
    });
    data.append('photo', optimized, 'profile-photo.jpg');
    try {
      const res = await api.post('/student/profile/photo', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setStudent((current) => ({ ...current, photoUrl: res.data.photoUrl }));
      setMsg({ type: 'success', text: res.data.message });
    } catch (err) {
      setMsg({ type: 'error', text: apiMessage(err) });
    } finally {
      setPhotoBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <PageHeader
        title={isStudent ? 'Student Profile' : 'Profile'}
        subtitle="View and manage your university information"
        action={
          isStudent ? (
            <button onClick={openEdit} className={btnPrimary}><Pencil size={14} /> Edit Profile</button>
          ) : null
        }
      />

      {msg && <div className="mb-4"><Alert type={msg.type}>{msg.text}</Alert></div>}

      <Card className="p-6 flex flex-wrap items-center gap-[18px] mb-4">
        <div className="relative w-[76px] h-[76px] shrink-0">
          {p?.photoUrl ? (
            <img src={p.photoUrl} alt={`${p.name} profile`} className="h-full w-full rounded-xl object-cover" />
          ) : (
            <div role="img" aria-label={`${p?.name || 'Student'} profile placeholder`} className="h-full w-full rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#5574c2] grid place-items-center text-white text-[22px] font-bold">
              {getInitials(p?.name)}
            </div>
          )}
          {isStudent && (
            <label title="Upload profile photo" className="absolute -bottom-2 -right-2 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-white text-brand-700 shadow">
              <Camera size={14} aria-hidden="true" />
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={photoBusy} className="sr-only" />
            </label>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold text-[#172033] m-0">{p?.name}</h2>
          <p className="text-[11px] text-[#697386] m-0 mt-1">
            {p?.rollNumber || p?.employeeId} • {p?.program || p?.degree || p?.department}
          </p>
          <div className="flex gap-1.5 mt-2.5">
            <Badge tone="green">Active</Badge>
            {isStudent && <Badge tone="blue">Semester {p?.currentSemester}</Badge>}
            {isStudent && <Badge tone="amber">{p?.batch}</Badge>}
          </div>
        </div>
        <div className="ml-auto w-[200px] max-sm:w-full">
          <div className="flex justify-between text-[10px] mb-1.5">
            <span className="text-[#697386]">Profile completion</span>
            <strong className="text-[#1e3a8a]">{completion}%</strong>
          </div>
          <div className="h-1.5 bg-[#e9edf2] rounded-full overflow-hidden">
            <div className="h-full bg-[#0f9d8a] rounded-full transition-all" style={{ width: `${completion}%` }} />
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 gap-x-9">
          {tab === 'Personal' && (
            <>
              <Info label="Full Name" value={p?.name} />
              <Info label="CNIC / B-Form" value={p?.cnic} />
              <Info label="Date of Birth" value={p?.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : ''} />
              <Info label="Gender" value={p?.gender} />
              <Info label="Nationality" value={p?.nationality || 'Pakistani'} />
              <Info label="Blood Group" value={p?.bloodGroup} />
            </>
          )}
          {tab === 'Academic' && (
            <>
              <Info label="Program" value={p?.program || p?.degree} />
              <Info label="Batch" value={p?.batch} />
              {isStudent && <Info label="Current Semester" value={`Semester ${p?.currentSemester}`} />}
              <Info label="Department" value={p?.department} />
              <Info label="Matric Marks" value={p?.matricMarks} />
              <Info label="Inter Marks" value={p?.interMarks} />
              <Info label="Advisor" value={p?.advisorName} />
            </>
          )}
          {tab === 'Contact' && (
            <>
              <Info label={isStudent ? 'University Email' : 'Email'} value={user?.email} />
              <Info label="Mobile" value={p?.phone} />
              <Info label="Current Address" value={p?.address} />
              <Info label="Permanent Address" value={p?.permanentAddress} />
              <Info label="Emergency Contact" value={p?.emergencyContactName} />
              <Info label="Emergency Phone" value={p?.emergencyContactPhone} />
            </>
          )}
          {tab === 'Guardian' && isStudent && (
            <>
              <Info label="Guardian Name" value={p?.guardianName} />
              <Info label="Guardian Phone" value={p?.guardianPhone} />
            </>
          )}
        </div>
      </Card>

      {editing && (
        <Modal title="Edit Profile" onClose={() => setEditing(false)}>
          <form onSubmit={save} className="max-h-[65vh] overflow-y-auto pr-1 space-y-0">
            <label className="block mb-3">
              <span className="block text-[11px] font-semibold text-[#344054] mb-1">Full Name</span>
              <input className={inputCls} value={form.name} onChange={set('name')} required minLength={2} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">CNIC</span>
                <input className={inputCls} value={form.cnic} onChange={set('cnic')} placeholder="xxxxx-xxxxxxx-x" />
              </label>
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">Date of Birth</span>
                <input type="date" className={inputCls} value={form.dateOfBirth} onChange={set('dateOfBirth')} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">Gender</span>
                <select className={inputCls} value={form.gender} onChange={set('gender')}>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">Blood Group</span>
                <input className={inputCls} value={form.bloodGroup} onChange={set('bloodGroup')} placeholder="A+" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">Phone</span>
                <input className={inputCls} value={form.phone} onChange={set('phone')} />
              </label>
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">Nationality</span>
                <input className={inputCls} value={form.nationality} onChange={set('nationality')} />
              </label>
            </div>
            <label className="block mb-3">
              <span className="block text-[11px] font-semibold text-[#344054] mb-1">Current Address</span>
              <input className={inputCls} value={form.address} onChange={set('address')} />
            </label>
            <label className="block mb-3">
              <span className="block text-[11px] font-semibold text-[#344054] mb-1">Permanent Address</span>
              <input className={inputCls} value={form.permanentAddress} onChange={set('permanentAddress')} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">Guardian Name</span>
                <input className={inputCls} value={form.guardianName} onChange={set('guardianName')} />
              </label>
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">Guardian Phone</span>
                <input className={inputCls} value={form.guardianPhone} onChange={set('guardianPhone')} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">Emergency Contact Name</span>
                <input className={inputCls} value={form.emergencyContactName} onChange={set('emergencyContactName')} />
              </label>
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">Emergency Phone</span>
                <input className={inputCls} value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">Matric Marks</span>
                <input type="number" min={0} max={1100} className={inputCls} value={form.matricMarks} onChange={set('matricMarks')} />
              </label>
              <label className="block mb-3">
                <span className="block text-[11px] font-semibold text-[#344054] mb-1">Inter Marks</span>
                <input type="number" min={0} max={1100} className={inputCls} value={form.interMarks} onChange={set('interMarks')} />
              </label>
            </div>
            <label className="block mb-4">
              <span className="block text-[11px] font-semibold text-[#344054] mb-1">Advisor Name</span>
              <input className={inputCls} value={form.advisorName} onChange={set('advisorName')} />
            </label>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : null} Save changes
              </button>
              <button type="button" className={btnGhost} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
