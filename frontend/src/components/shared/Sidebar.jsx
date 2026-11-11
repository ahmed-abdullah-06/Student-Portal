import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, CalendarCheck, ClipboardList, Receipt,
  CalendarDays, Star, User, BookOpen, Users, Library, Layers, Wallet,
  Megaphone, ScrollText, LogOut, X, MessageCircle, Bus, Building2,
  MinusCircle, HelpCircle, Download, KeyRound, GraduationCap, Upload,
  Inbox, FileBarChart, Building, FolderOpen, Award, Settings, ShieldCheck, FileUp,
  LockKeyhole,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';

const menus = {
  STUDENT: [
    { to: '/student', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
    { to: '/student/profile', labelKey: 'nav.profile', icon: User },
    { to: '/student/calendar', labelKey: 'nav.calendar', icon: CalendarDays },
    { to: '/student/registration', labelKey: 'nav.registration', icon: BookOpen },
    { to: '/student/attendance', labelKey: 'nav.attendance', icon: CalendarCheck },
    { to: '/student/timetable', labelKey: 'nav.timetable', icon: CalendarDays },
    { to: '/student/marks', labelKey: 'nav.marks', icon: ClipboardList },
    { to: '/student/date-sheet', labelKey: 'nav.dateSheet', icon: CalendarDays },
    { to: '/student/degree-audit', labelKey: 'nav.degreeAudit', icon: GraduationCap },
    { to: '/student/challans', labelKey: 'nav.fees', icon: Receipt },
    { to: '/student/withdraw', labelKey: 'nav.withdraw', icon: MinusCircle },
    { to: '/student/requests', labelKey: 'nav.requests', icon: Inbox },
    { to: '/student/evaluations', labelKey: 'nav.evaluations', icon: Star },
    { to: '/student/hostel', labelKey: 'nav.hostel', icon: Building2 },
    { to: '/student/library', labelKey: 'nav.library', icon: Library },
    { to: '/student/transport', labelKey: 'nav.transport', icon: Bus },
    { to: '/student/complaints', labelKey: 'nav.complaints', icon: HelpCircle },
    { to: '/student/downloads', labelKey: 'nav.downloads', icon: Download },
    { to: '/messages', labelKey: 'nav.messages', icon: MessageCircle },
    { to: '/security', labelKey: 'nav.security', icon: ShieldCheck },
    { to: '/privacy-settings', labelKey: 'nav.privacy', icon: LockKeyhole },
    { to: '/change-password', labelKey: 'nav.changePassword', icon: KeyRound },
  ],
  FACULTY: [
    { to: '/faculty', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
    { to: '/faculty/attendance', labelKey: 'nav.markAttendance', icon: CalendarCheck },
    { to: '/faculty/marks', labelKey: 'nav.enterMarks', icon: ClipboardList },
    { to: '/faculty/assignments', labelKey: 'nav.assignments', icon: FileUp },
    { to: '/faculty/evaluations', labelKey: 'nav.evaluations', icon: Star },
    { to: '/faculty/profile', labelKey: 'nav.profile', icon: User },
    { to: '/messages', labelKey: 'nav.messages', icon: MessageCircle },
    { to: '/security', labelKey: 'nav.security', icon: ShieldCheck },
    { to: '/privacy-settings', labelKey: 'nav.privacy', icon: LockKeyhole },
    { to: '/change-password', labelKey: 'nav.changePassword', icon: KeyRound },
  ],
  ADMIN: [
    { to: '/admin', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/students', labelKey: 'nav.students', icon: Users },
    { to: '/admin/faculty', labelKey: 'nav.faculty', icon: User },
    { to: '/admin/courses', labelKey: 'nav.courses', icon: BookOpen },
    { to: '/admin/sections', labelKey: 'nav.sections', icon: Layers },
    { to: '/admin/semesters', labelKey: 'nav.semesters', icon: CalendarDays },
    { to: '/admin/calendar', labelKey: 'nav.calendar', icon: CalendarDays },
    { to: '/admin/fees', labelKey: 'nav.feeManagement', icon: Wallet },
    { to: '/admin/approvals', labelKey: 'nav.approvals', icon: Inbox },
    { to: '/admin/scholarships', labelKey: 'nav.scholarships', icon: Award },
    { to: '/admin/library', labelKey: 'nav.library', icon: Library },
    { to: '/admin/hostel', labelKey: 'nav.hostel', icon: Building2 },
    { to: '/admin/transport', labelKey: 'nav.transport', icon: Bus },
    { to: '/admin/documents', labelKey: 'nav.documents', icon: FolderOpen },
    { to: '/admin/master-data', labelKey: 'nav.masterData', icon: Building },
    { to: '/admin/import', labelKey: 'nav.dataImport', icon: Upload },
    { to: '/admin/reports', labelKey: 'nav.reports', icon: FileBarChart },
    { to: '/messages', labelKey: 'nav.messages', icon: MessageCircle },
    { to: '/admin/notices', labelKey: 'nav.notices', icon: Megaphone },
    { to: '/admin/audit', labelKey: 'nav.audit', icon: ScrollText },
    { to: '/admin/settings', labelKey: 'nav.settings', icon: Settings },
    { to: '/security', labelKey: 'nav.security', icon: ShieldCheck },
    { to: '/change-password', labelKey: 'nav.changePassword', icon: KeyRound },
  ],
};

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Sidebar({ open, onClose }) {
  const { user, profile, logout } = useAuth();
  const { t } = useI18n();
  const items = menus[user?.role] || [];
  const isStudent = user?.role === 'STUDENT';

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}
      <aside
        className={`fixed z-50 lg:z-30 left-0 top-[62px] lg:top-[70px] bottom-0 w-[250px] lg:w-[250px] bg-white border-r border-[#e4e7ec] overflow-y-auto transform transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <button
          className="lg:hidden absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>

        {isStudent && (
          <div className="flex items-center gap-2.5 bg-[#f6f8fc] rounded-lg px-3 py-3 mx-3 mt-4 mb-5">
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#4e6cbb] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                {getInitials(profile?.name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#172033] truncate">{profile?.name || 'Student'}</div>
              <div className="text-[9px] text-[#697386] mt-0.5 truncate">
                {profile?.program || profile?.department || 'Student'}
              </div>
            </div>
          </div>
        )}

        <nav className="pb-4" aria-label="Main menu">
          <span className="block text-[9px] font-bold text-[#a0a8b5] tracking-[1.1px] px-5 mb-1.5">{t('nav.mainMenu').toUpperCase()}</span>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-5 py-2.5 text-[12px] transition ${
                  isActive
                    ? 'bg-[#edf2ff] text-[#1e3a8a] font-semibold'
                    : 'text-[#586579] hover:bg-[#f3f6fb] hover:text-[#1e3a8a]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={17} aria-hidden="true" />
                  <span>{t(item.labelKey)}</span>
                  {isActive && (
                    <i className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-[#1e3a8a] rounded-l" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-5 pt-4 border-t border-[#edf0f3] mx-3">
          <span className="block text-[9px] font-bold text-[#a0a8b5] tracking-[1.1px] px-2 mb-1.5">{t('nav.account').toUpperCase()}</span>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-2 py-2.5 text-[12px] text-[#586579] hover:bg-[#f3f6fb] hover:text-[#1e3a8a] rounded-lg transition text-left"
          >
            <LogOut size={17} aria-hidden="true" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
