import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Sun, Moon, CheckCheck, ChevronDown, User, HelpCircle, LogOut, Languages, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { useI18n } from '../../i18n';
import api from '../../services/api';

function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('novastra-theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('novastra-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return [dark, setDark];
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([api.get('/notifications'), api.get('/notifications/unread-count')])
        .then(([n, u]) => {
          if (!alive) return;
          setItems(n.data.notifications);
          setUnread(u.data.unread);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 45000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function openItem(n) {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((c) => Math.max(0, c - (n.read ? 0 : 1)));
    setOpen(false);
    if (!n.read) api.post(`/notifications/${n.id}/read`).catch(() => {});
    if (n.link) navigate(n.link);
  }

  async function markAll() {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    api.post('/notifications/read-all').catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#4f5d73] transition"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#d14545] text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-24px)] bg-white border border-[#e4e7ec] rounded-lg shadow-[0_14px_36px_rgba(24,35,60,.16)] overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#edf0f3]">
            <span className="text-sm font-semibold text-[#172033]">Notifications</span>
            <button onClick={markAll} className="text-xs text-[#1e3a8a] hover:underline flex items-center gap-1">
              <CheckCheck size={13} /> Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-[#edf0f3]">
            {items.length === 0 && (
              <div className="px-4 py-6 text-sm text-[#98a0ae] text-center">No notifications yet</div>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`w-full text-left px-4 py-3 hover:bg-[#f3f5f8] transition ${
                  n.read ? 'opacity-70' : 'bg-[#edf2ff]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[#172033] truncate">
                    {!n.read && <span className="inline-block w-2 h-2 rounded-full bg-[#1e3a8a] mr-1.5 align-middle" />}
                    {n.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                    n.type === 'ALERT' ? 'bg-red-100 text-red-700'
                    : n.type === 'SUCCESS' ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                  }`}>{n.type}</span>
                </div>
                <div className="text-xs text-[#697386] mt-0.5 line-clamp-2">{n.body}</div>
                <div className="text-[10px] text-[#98a0ae] mt-1">{new Date(n.createdAt).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Logo({ light = false, branding }) {
  const primary = branding?.primaryColor || '#1e3a8a';
  return (
    <div className={`flex items-center gap-2.5 ${light ? 'text-white' : ''}`} style={light ? undefined : { color: primary }}>
      <div
        className={`w-10 h-10 rounded-[10px] flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(255,255,255,.15)] text-white ${light ? 'bg-white' : ''}`}
        style={light ? { color: primary, backgroundColor: '#fff' } : { backgroundColor: primary }}
      >
        <span className="font-extrabold tracking-tight text-sm">{branding?.logoText || 'NU'}</span>
      </div>
      <div>
        <div className={`text-[13px] font-bold leading-tight ${light ? 'text-white' : ''}`} style={light ? undefined : { color: primary }}>
          {branding?.portalName || 'Novastra'}
        </div>
        <div className={`text-[9px] uppercase tracking-[1.5px] mt-0.5 ${light ? 'text-white/70' : 'text-[#697386]'}`}>
          {branding?.tagline || 'Student Portal'}
        </div>
      </div>
    </div>
  );
}

export default function Navbar({ onMenu }) {
  const { user, profile, logout } = useAuth();
  const { branding } = useBranding();
  const { t, lang, setLang } = useI18n();
  const [dark, setDark] = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-[#e4e7ec] h-[62px] lg:h-[70px] flex items-center px-3 lg:px-6">
      <button
        className="lg:hidden mr-3 p-1.5 text-[#1e3a8a] hover:bg-[#edf2ff] rounded-lg"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu size={22} />
      </button>

      <div className="hidden lg:block w-[230px] shrink-0">
        <Logo branding={branding} />
      </div>

      <div className="flex items-center gap-2 lg:gap-5 ml-auto">
        <label className="hidden md:flex items-center gap-2.5 border-r border-[#e4e7ec] pr-5">
          <span className="text-[10px] text-[#697386] uppercase tracking-[0.5px]">{t('common.activeSemester')}</span>
          <select
            defaultValue="Fall 2026"
            aria-label={t('common.activeSemester')}
            className="border-0 bg-transparent text-[#1e3a8a] font-semibold text-xs focus:outline-none cursor-pointer"
          >
            <option>Fall 2026</option>
            <option>Spring 2026</option>
          </select>
        </label>

        <button
          onClick={() => setLang(lang === 'en' ? 'ur' : 'en')}
          className="h-9 px-2.5 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 text-[#4f5d73] transition text-[11px] font-semibold"
          aria-label={`Switch language (currently ${lang === 'en' ? 'English' : 'اردو'})`}
          title={t('common.language')}
        >
          <Languages size={17} />
          {lang === 'en' ? 'اردو' : 'EN'}
        </button>

        <button
          onClick={() => setDark((d) => !d)}
          className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#4f5d73] transition"
          aria-label="Toggle dark mode"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <NotificationBell />

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2.5 text-left"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            aria-label="Account menu"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#4e6cbb] text-white flex items-center justify-center text-[11px] font-bold">
              {getInitials(profile?.name)}
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-xs font-semibold text-[#172033]">{profile?.name || user?.email}</div>
              <div className="text-[10px] text-[#697386] mt-0.5">
                {profile?.rollNumber || profile?.employeeId || user?.email}
              </div>
            </div>
            <ChevronDown size={15} className="text-[#98a0ae] hidden sm:block" />
          </button>

          {profileOpen && (
            <div role="menu" className="absolute right-0 top-[48px] bg-white border border-[#e4e7ec] rounded-lg shadow-[0_14px_36px_rgba(24,35,60,.16)] p-1.5 w-[190px] z-50">
              <button
                role="menuitem"
                onClick={() => { navigate(user?.role === 'ADMIN' ? '/admin' : user?.role === 'FACULTY' ? '/faculty' : '/student/profile'); setProfileOpen(false); }}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 rounded-md text-[12px] text-[#465166] hover:bg-[#f3f5f8] hover:text-[#1e3a8a] transition"
              >
                <User size={16} aria-hidden="true" /> My Profile
              </button>
              <button
                role="menuitem"
                onClick={() => { navigate('/security'); setProfileOpen(false); }}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 rounded-md text-[12px] text-[#465166] hover:bg-[#f3f5f8] hover:text-[#1e3a8a] transition"
              >
                <ShieldCheck size={16} aria-hidden="true" /> Security
              </button>
              <button
                role="menuitem"
                onClick={() => { navigate('/change-password'); setProfileOpen(false); }}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 rounded-md text-[12px] text-[#465166] hover:bg-[#f3f5f8] hover:text-[#1e3a8a] transition"
              >
                <HelpCircle size={16} aria-hidden="true" /> Change Password
              </button>
              <button
                role="menuitem"
                onClick={logout}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 rounded-md text-[12px] text-[#465166] hover:bg-[#f3f5f8] hover:text-[#d14545] transition"
              >
                <LogOut size={16} aria-hidden="true" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
