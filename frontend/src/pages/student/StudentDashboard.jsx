import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, Check, CreditCard, BookOpen, ArrowRight, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Card, Spinner, Alert } from '../../components/ui/UI';
import { useI18n } from '../../i18n/index.jsx';

const toneStyles = {
  blue: 'bg-[#edf2ff] text-[#1e3a8a]',
  teal: 'bg-[#e7f8f5] text-[#0f9d8a]',
  green: 'bg-[#e9f7f0] text-[#11875d]',
  amber: 'bg-[#fff6e5] text-[#d18a17]',
};

function StatCard({ icon, label, value, meta, tone }) {
  return (
    <Card className="p-[18px] flex items-center gap-3.5">
      <div className={`w-[42px] h-[42px] rounded-[9px] flex items-center justify-center shrink-0 ${toneStyles[tone]}`}>
        <span className="text-[18px]">{icon}</span>
      </div>
      <div className="min-w-0">
        <span className="text-[10px] text-[#697386] font-medium block">{label}</span>
        <strong className="text-[22px] text-[#172033] tracking-[-0.5px] block my-0.5">{value}</strong>
        <small className="text-[9px] text-[#8b94a2] block">{meta}</small>
      </div>
    </Card>
  );
}

function CardTitle({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between px-[18px] pt-4 pb-3 border-b border-[#edf0f3] min-h-[62px]">
      <div>
        <h2 className="text-sm font-semibold text-[#172033] m-0">{title}</h2>
        {subtitle && <p className="text-[10px] text-[#697386] mt-1 m-0">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Notice({ date, title, tag, tone }) {
  const toneMap = { blue: 'bg-[#edf2ff] text-[#1e3a8a]', green: 'bg-[#e9f7f0] text-[#11875d]', amber: 'bg-[#fff6e5] text-[#d18a17]' };
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-[#edf0f3] last:border-0">
      <span className="text-[10px] font-semibold text-[#697386] w-14 shrink-0">{date}</span>
      <div className="flex-1 min-w-0">
        <strong className="text-[12px] text-[#172033] block truncate">{title}</strong>
        <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${toneMap[tone]}`}>{tag}</span>
      </div>
      <ChevronRight size={16} className="text-[#b2b8c2] shrink-0" />
    </div>
  );
}

export default function StudentDashboard() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/student/transcript'),
      api.get('/student/attendance'),
      api.get('/student/challans'),
      api.get('/student/courses'),
      api.get('/student/notices'),
      api.get('/student/evaluations'),
      api.get('/student/timetable'),
    ])
      .then(([tr, at, ch, co, no, ev, tt]) =>
        setData({
          cgpa: tr.data.cgpa,
          crHrs: tr.data.totalCreditHours,
          attendance: at.data.courses,
          challans: ch.data.challans,
          courses: co.data.enrollments,
          notices: no.data.notices,
          evaluations: ev.data,
          timetable: tt.data.entries,
        })
      )
      .catch(() => setData({ error: true }));
  }, []);

  if (!data) return <Spinner label={t('common.loadingDashboard')} />;
  if (data.error) return <Alert type="error">{t('common.failedDashboard')}</Alert>;

  const deficient = data.attendance.filter((a) => a.isDeficient);
  const avgAtt =
    data.attendance.length > 0 ? data.attendance.reduce((s, a) => s + a.percentage, 0) / data.attendance.length : 0;
  const unpaid = data.challans.filter((c) => c.status === 'UNPAID');
  const pendingEval = data.evaluations.items.filter((i) => !i.submitted).length;

  const todayClasses = data.timetable
    .filter((t) => t.day === 'Monday')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 4);

  return (
    <div>
      <div className="rounded-[10px] px-5 sm:px-6 py-6 bg-gradient-to-r from-[#18377f] via-[#294ba5] to-[#23609d] text-white flex flex-wrap justify-between items-end gap-3 relative overflow-hidden mb-4">
        <div className="absolute w-[250px] h-[250px] rounded-full right-[130px] -top-[170px] border-[50px] border-white/5" />
        <div className="relative z-10 min-w-0">
          <span className="text-[11px] font-bold tracking-[1.8px] text-[#a8eee4]">
            FALL 2026 • WEEK 8
          </span>
          <h1 className="text-[20px] sm:text-[24px] tracking-[-0.5px] mt-2 mb-1">Assalam-o-Alaikum, {profile?.name?.split(' ')[0]}!</h1>
          <p className="text-[12px] text-[#d7e1fa] m-0">
            {profile?.program || profile?.degree || 'BS Computer Science'} • Semester {profile?.currentSemester || 5} • {profile?.rollNumber}
          </p>
        </div>
        <div className="text-right relative z-10 max-sm:hidden">
          <span className="text-[9px] uppercase text-[#b9c9ee] tracking-[1px] block">Registration No.</span>
          <strong className="text-[13px] mt-1 block">{profile?.rollNumber}</strong>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={<Award />} label={t('common.currentCgpa')} value={data.cgpa?.toFixed(2) ?? '—'} meta={t('common.academicPerformance')} tone="blue" />
        <StatCard icon={<Check />} label={t('common.overallAttendance')} value={`${avgAtt.toFixed(0)}%`} meta={t(avgAtt >= 75 ? 'common.aboveRequired' : 'common.belowRequired', { percent: 75 })} tone="teal" />
        <StatCard icon={<CreditCard />} label={t('common.feeStatus')} value={unpaid.length ? t('common.pending') : t('common.paid')} meta={unpaid.length ? `${unpaid.length} ${t('common.pending')} ` : t('common.noPendingDues')} tone={unpaid.length ? 'amber' : 'green'} />
        <StatCard icon={<BookOpen />} label={t('common.enrolledCourses')} value={data.courses.length} meta={t('common.totalCreditHours', { count: data.crHrs || 0 })} tone="amber" />
      </div>

      {deficient.length > 0 && (
        <div className="mb-4">
          <Alert type="warning">
            <b>{t('dashboard.attendanceShortage')}</b> {deficient.map((d) => `${d.courseCode} (${d.percentage}%)`).join(', ')} — {t('dashboard.minimumRequired', { percent: 75 })}
          </Alert>
        </div>
      )}
      {pendingEval > 0 && (
        <div className="mb-4">
          <Alert type="info">
            {t('dashboard.pendingEvaluations', { count: pendingEval })}{' '}
            <Link to="/student/evaluations" className="underline font-medium">{t('dashboard.submitNow')}</Link>
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_0.8fr] gap-4">
        <Card className="p-0 overflow-hidden">
          <CardTitle
            title={t('dashboard.currentCourses')}
            subtitle={t('dashboard.enrolledCourses')}
            action={
              <Link to="/student/registration" className="text-[11px] text-[#1e3a8a] hover:underline inline-flex items-center gap-1 bg-transparent border-0">
                {t('dashboard.viewRegistration')} <ArrowRight size={13} />
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  {['Course', 'Title', 'Cr. Hrs', 'Instructor', 'Attendance', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.courses.slice(0, 6).map((c) => {
                  const att = data.attendance.find((a) => a.sectionId === c.sectionId || a.courseCode === c.course?.courseCode);
                  const pct = att?.percentage ?? 0;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/student/courses/${c.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/student/courses/${c.id}`); }}
                      tabIndex={0}
                      title="Open course workspace"
                      className="hover:bg-[#f9fafc] cursor-pointer focus:outline-none focus:bg-[#f4f7ff]"
                    >
                      <td className="px-4 py-3 text-[12px] border-b border-[#edf0f3]">
                        <strong className="text-[#1e3a8a] font-semibold">{c.course?.courseCode}</strong>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">{c.course?.title}</td>
                      <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">{c.course?.creditHours}</td>
                      <td className="px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]">{c.section?.faculty?.name || 'TBD'}</td>
                      <td className="px-4 py-3 border-b border-[#edf0f3]">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          pct < 75 ? 'bg-[#fde8e8] text-[#d14545] border-[#f5c6c6]'
                          : pct < 80 ? 'bg-[#fff6e5] text-[#d18a17] border-[#f1d9a8]'
                          : 'bg-[#e9f7f0] text-[#11875d] border-[#c8e8d8]'
                        }`}>{pct}%</span>
                      </td>
                      <td className="px-4 py-3 border-b border-[#edf0f3] text-right">
                        <ArrowRight size={14} className="inline text-[#b2b8c2]" />
                      </td>
                    </tr>
                  );
                })}
                {data.courses.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#98a0ae]">No enrolled courses</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <CardTitle
            title="Today's Classes"
            subtitle="Monday, 12 October"
            action={
              <Link to="/student/timetable" className="text-[11px] text-[#1e3a8a] hover:underline bg-transparent border-0">
                Full timetable
              </Link>
            }
          />
          <div className="px-[18px] py-2">
            {todayClasses.length === 0 ? (
              <p className="text-sm text-[#98a0ae] text-center py-6">No classes scheduled today</p>
            ) : (
              todayClasses.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-3 border-b border-[#edf0f3] last:border-0">
                  <div className={`shrink-0 rounded-lg px-2.5 py-1.5 text-center min-w-[52px] ${
                    t.startTime < '12:00' ? 'bg-[#edf2ff] text-[#1e3a8a]' : 'bg-[#e7f8f5] text-[#0f9d8a]'
                  }`}>
                    <strong className="text-[11px] block">{t.startTime}</strong>
                    <small className="text-[8px] block">{t.startTime < '12:00' ? 'AM' : 'PM'}</small>
                  </div>
                  <div className="flex-1 min-w-0">
                    <strong className="text-[12px] text-[#172033] block truncate">{t.section?.course?.title}</strong>
                    <small className="text-[9px] text-[#697386] block mt-0.5 truncate">
                      {t.room || 'TBD'} • {t.section?.faculty?.name || 'TBD'}
                    </small>
                  </div>
                  <ArrowRight size={15} className="text-[#b2b8c2] shrink-0" />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden lg:col-span-1">
          <CardTitle title="GPA Trend" subtitle="Academic performance" />
          <div className="p-5">
            <div className="relative h-[180px]">
              <div className="absolute left-0 top-0 text-[9px] text-[#98a0ae]">4.0</div>
              <div className="absolute left-0 top-1/2 text-[9px] text-[#98a0ae]">3.0</div>
              <div className="absolute left-0 bottom-0 text-[9px] text-[#98a0ae]">2.0</div>
              <svg viewBox="0 0 600 180" preserveAspectRatio="none" className="w-full h-full pl-8">
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E3A8A" stopOpacity=".2" />
                    <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path className="area" fill="url(#chartFill)" d="M20 130 L130 100 L240 112 L350 65 L460 78 L580 38 L580 170 L20 170Z" />
                <path fill="none" stroke="#1E3A8A" strokeWidth="2.5" d="M20 130 L130 100 L240 112 L350 65 L460 78 L580 38" />
                {[[20,130],[130,100],[240,112],[350,65],[460,78],[580,38]].map(([x,y]) => (
                  <circle key={x} cx={x} cy={y} r="5" fill="#1E3A8A" stroke="#fff" strokeWidth="2" />
                ))}
              </svg>
              <div className="flex justify-between text-[8px] text-[#98a0ae] mt-2 pl-8">
                <span>Fall 23</span><span>Spring 24</span><span>Fall 24</span><span>Spring 25</span><span>Fall 25</span><span>Spring 26</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <CardTitle
            title="Notices & Announcements"
            action={
              <Link to="/messages" className="text-[11px] text-[#1e3a8a] hover:underline bg-transparent border-0">View all</Link>
            }
          />
          <div className="px-[18px]">
            {data.notices.slice(0, 4).map((n, i) => (
              <Notice
                key={n.id}
                date={new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                title={n.title}
                tag={i % 3 === 0 ? 'Academic' : i % 3 === 1 ? 'Finance' : 'Campus'}
                tone={i % 3 === 0 ? 'blue' : i % 3 === 1 ? 'green' : 'amber'}
              />
            ))}
            {data.notices.length === 0 && (
              <p className="text-sm text-[#98a0ae] text-center py-6">No notices yet</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
