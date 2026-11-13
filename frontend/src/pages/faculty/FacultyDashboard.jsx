import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Users, CalendarCheck, ClipboardList, ArrowRight, Star, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Card, Spinner, Alert, PageHeader } from '../../components/ui/UI';
import { useI18n } from '../../i18n/index.jsx';

function StatTile({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: { bg: '#edf2ff', fg: '#1e3a8a' },
    teal: { bg: '#e7f8f5', fg: '#0f9d8a' },
    amber: { bg: '#fff5e3', fg: '#d18a17' },
  };
  const t = tones[tone] || tones.blue;
  return (
    <Card className="p-5 flex items-start gap-3.5">
      <div className="w-[42px] h-[42px] rounded-[10px] grid place-items-center shrink-0" style={{ background: t.bg, color: t.fg }}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="block text-[9px] text-[#697386] uppercase tracking-[0.4px]">{label}</span>
        <strong className="block text-[20px] mt-1 text-[#172033]">{value}</strong>
      </div>
    </Card>
  );
}

const quickLinks = [
  { to: '/faculty/attendance', icon: CalendarCheck, title: 'Mark Attendance', sub: 'Daily lecture attendance register', color: '#edf2ff', fg: '#1e3a8a' },
  { to: '/faculty/marks', icon: ClipboardList, title: 'Enter Marks', sub: 'Quizzes, assignments, midterms, finals', color: '#eaf9f6', fg: '#0f9d8a' },
  { to: '/faculty/evaluations', icon: Star, title: 'Evaluations', sub: 'Anonymous student feedback', color: '#fff5e3', fg: '#d18a17' },
];

export default function FacultyDashboard() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [sections, setSections] = useState(null);

  useEffect(() => {
    api.get('/faculty/sections').then((res) => setSections(res.data.sections)).catch(() => setSections([]));
  }, []);

  if (!sections) return <Spinner label={t('common.loadingYourSections')} />;

  return (
    <div>
      <PageHeader
        title={t('faculty.welcome')}
        subtitle={`${profile?.name} · ${profile?.designation} · ${profile?.department} · ${profile?.employeeId}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <StatTile icon={Layers} label={t('faculty.assignedSections')} value={sections.length} tone="blue" />
        <StatTile icon={Users} label={t('faculty.totalStudents')} value={sections.reduce((s, x) => s + (x._count?.enrollments || 0), 0)} tone="teal" />
        <StatTile icon={ClipboardList} label={t('faculty.coursesTaught')} value={new Set(sections.map((s) => s.courseId)).size} tone="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {quickLinks.map((q) => (
          <Link key={q.to} to={q.to} className="group">
            <Card className="h-full hover:border-[#8da4f0] transition">
              <div className="flex items-center gap-3.5">
                <div className="w-[42px] h-[42px] rounded-[10px] grid place-items-center shrink-0" style={{ background: q.color, color: q.fg }}>
                  <q.icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <strong className="block text-[13px] text-[#172033] group-hover:text-[#1e3a8a]">{q.title}</strong>
                  <small className="block text-[10px] text-[#697386] mt-0.5">{q.sub}</small>
                </div>
                <ArrowRight size={16} className="text-[#b2b8c2] group-hover:text-[#1e3a8a]" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card title={t('faculty.mySections')} subtitle={t('faculty.assignedCoursesYear')} className="p-0 overflow-hidden">
        {sections.length === 0 ? (
          <div className="p-8 text-center"><Alert type="info">{t('faculty.noSections')}</Alert></div>
        ) : (
          <div className="px-[18px]">
            {sections.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3.5 border-b border-[#e4e7ec] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-[36px] h-[36px] rounded-lg bg-[#edf2ff] text-[#1e3a8a] grid place-items-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <strong className="text-[12px] text-[#1e3a8a] block">{s.course.courseCode}</strong>
                    <small className="text-[10px] text-[#697386] block mt-0.5">{s.course.title} · Section {s.name}</small>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-[#697386]">Sem {s.semester} · {s.year}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#172033] font-medium">
                    <Users size={13} className="text-[#697386]" /> {s._count?.enrollments || 0}/{s.capacity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
