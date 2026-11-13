import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/shared/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import { Spinner } from './components/ui/UI';
import ErrorBoundary from './components/shared/ErrorBoundary';
import CookieConsent from './components/shared/CookieConsent';

import Login from './pages/Login';
import Landing from './pages/Landing';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import ChangePassword from './pages/shared/ChangePassword';
import Security from './pages/shared/Security';
import NotificationPreferences from './pages/shared/NotificationPreferences';
import PlatformConsole from './pages/platform/PlatformConsole';

import StudentDashboard from './pages/student/StudentDashboard';
const CourseWorkspace = lazy(() => import('./pages/student/CourseWorkspace'));
import CourseReg from './pages/student/CourseReg';
import Attendance from './pages/student/Attendance';
import Marks from './pages/student/Marks';
import Transcript from './pages/student/Transcript';
import FeeChallan from './pages/student/FeeChallan';
import Timetable from './pages/student/Timetable';
import Evaluations from './pages/student/Evaluations';
import Profile from './pages/student/Profile';
import Library from './pages/student/Library';
import Hostel from './pages/student/Hostel';
import Transport from './pages/student/Transport';
import CourseWithdraw from './pages/student/CourseWithdraw';
import Complaints from './pages/student/Complaints';
import Downloads from './pages/student/Downloads';
import DateSheet from './pages/student/DateSheet';
import DegreeAudit from './pages/student/DegreeAudit';
import Requests from './pages/student/Requests';

const Messages = lazy(() => import('./pages/shared/Messages'));

import FacultyDashboard from './pages/faculty/FacultyDashboard';
import MarkAttendance from './pages/faculty/MarkAttendance';
import EnterMarks from './pages/faculty/EnterMarks';
import FacultyAssignments from './pages/faculty/Assignments';
import FacultyEvaluations from './pages/faculty/FacultyEvaluations';

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
import UserManagement from './pages/admin/UserManagement';
import AdminQuality from './pages/admin/AdminQuality';
import CourseManagement from './pages/admin/CourseManagement';
import SectionScheduler from './pages/admin/SectionScheduler';
import FeeManagement from './pages/admin/FeeManagement';
import LibraryManagement from './pages/admin/LibraryManagement';
import HostelManagement from './pages/admin/HostelManagement';
import TransportManagement from './pages/admin/TransportManagement';
import Notices from './pages/admin/Notices';
import AuditLogs from './pages/admin/AuditLogs';
import SemesterManagement from './pages/admin/SemesterManagement';
import AdminApprovals from './pages/admin/AdminApprovals';
import DocumentManagement from './pages/admin/DocumentManagement';
import MasterData from './pages/admin/MasterData';
const DataImport = lazy(() => import('./pages/admin/DataImport'));
const Reports = lazy(() => import('./pages/admin/Reports'));
import ScholarshipManagement from './pages/admin/ScholarshipManagement';
import PortalSettings from './pages/admin/Settings';
import CalendarManagement from './pages/admin/CalendarManagement';
import AcademicCalendar from './pages/student/AcademicCalendar';
import FacultyProfile from './pages/faculty/FacultyProfile';
import Legal from './pages/Legal';
import PrivacySettings from './pages/shared/PrivacySettings';
import AcceptTerms from './pages/AcceptTerms';

const roleHome = { STUDENT: '/student', FACULTY: '/faculty', ADMIN: '/admin' };

function LazyPage({ children }) {
  return <ErrorBoundary><Suspense fallback={<Spinner label="Loading page..." />}>{children}</Suspense></ErrorBoundary>;
}

function RouteBoundary({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner label="Loading portal..." />;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={roleHome[user.role] || '/dashboard'} replace /> : <Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login/:role" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/privacy" element={<Legal type="privacy" />} />
      <Route path="/terms" element={<Legal type="terms" />} />
      <Route path="/accept-terms" element={<ProtectedRoute><AcceptTerms /></ProtectedRoute>} />
      <Route path="/platform" element={<PlatformConsole />} />
      <Route path="/cookie-consent" element={<CookieConsent />} />

      <Route path="/dashboard" element={<Navigate to={user ? roleHome[user.role] : '/login'} replace />} />

      <Route element={<ProtectedRoute><RouteBoundary><DashboardLayout /></RouteBoundary></ProtectedRoute>}>
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/security" element={<Security />} />
        <Route path="/notification-preferences" element={<NotificationPreferences />} />
        <Route path="/privacy-settings" element={<PrivacySettings />} />
      </Route>

      <Route element={<ProtectedRoute roles={['STUDENT']}><RouteBoundary><DashboardLayout /></RouteBoundary></ProtectedRoute>}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/courses/:id" element={<LazyPage><CourseWorkspace /></LazyPage>} />
        <Route path="/student/registration" element={<CourseReg />} />
        <Route path="/student/attendance" element={<Attendance />} />
        <Route path="/student/marks" element={<Marks />} />
        <Route path="/student/transcript" element={<Transcript />} />
        <Route path="/student/challans" element={<FeeChallan />} />
        <Route path="/student/timetable" element={<Timetable />} />
        <Route path="/student/evaluations" element={<Evaluations />} />
        <Route path="/student/library" element={<Library />} />
        <Route path="/student/hostel" element={<Hostel />} />
        <Route path="/student/transport" element={<Transport />} />
        <Route path="/student/withdraw" element={<CourseWithdraw />} />
        <Route path="/student/complaints" element={<Complaints />} />
        <Route path="/student/downloads" element={<Downloads />} />
        <Route path="/student/date-sheet" element={<DateSheet />} />
        <Route path="/student/degree-audit" element={<DegreeAudit />} />
        <Route path="/student/requests" element={<Requests />} />
        <Route path="/messages" element={<LazyPage><Messages /></LazyPage>} />
        <Route path="/student/profile" element={<Profile />} />
        <Route path="/student/calendar" element={<AcademicCalendar />} />
      </Route>

      <Route element={<ProtectedRoute roles={['FACULTY']}><RouteBoundary><DashboardLayout /></RouteBoundary></ProtectedRoute>}>
        <Route path="/faculty" element={<FacultyDashboard />} />
        <Route path="/faculty/attendance" element={<MarkAttendance />} />
        <Route path="/faculty/marks" element={<EnterMarks />} />
        <Route path="/faculty/assignments" element={<FacultyAssignments />} />
        <Route path="/faculty/evaluations" element={<FacultyEvaluations />} />
        <Route path="/faculty/profile" element={<FacultyProfile />} />
        <Route path="/messages" element={<LazyPage><Messages /></LazyPage>} />
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN']}><RouteBoundary><DashboardLayout /></RouteBoundary></ProtectedRoute>}>
        <Route path="/admin" element={<LazyPage><AdminDashboard /></LazyPage>} />
        <Route path="/admin/students" element={<UserManagement role="STUDENT" />} />
        <Route path="/admin/faculty" element={<UserManagement role="FACULTY" />} />
        <Route path="/admin/operations" element={<AdminQuality />} />
        <Route path="/admin/courses" element={<CourseManagement />} />
        <Route path="/admin/sections" element={<SectionScheduler />} />
        <Route path="/admin/semesters" element={<SemesterManagement />} />
        <Route path="/admin/calendar" element={<CalendarManagement />} />
        <Route path="/admin/fees" element={<FeeManagement />} />
        <Route path="/admin/approvals" element={<AdminApprovals />} />
        <Route path="/admin/scholarships" element={<ScholarshipManagement />} />
        <Route path="/admin/library" element={<LibraryManagement />} />
        <Route path="/admin/hostel" element={<HostelManagement />} />
        <Route path="/admin/transport" element={<TransportManagement />} />
        <Route path="/admin/documents" element={<DocumentManagement />} />
        <Route path="/admin/master-data" element={<MasterData />} />
        <Route path="/admin/import" element={<LazyPage><DataImport /></LazyPage>} />
        <Route path="/admin/reports" element={<LazyPage><Reports /></LazyPage>} />
        <Route path="/messages" element={<LazyPage><Messages /></LazyPage>} />
        <Route path="/admin/notices" element={<Notices />} />
        <Route path="/admin/audit" element={<AuditLogs />} />
        <Route path="/admin/settings" element={<PortalSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
