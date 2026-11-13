import { useEffect, useState } from 'react';
import { Users, UserCog, Layers, Library, Wallet, Star, ShieldCheck, CalendarCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Card, Spinner, Alert, PageHeader } from '../../components/ui/UI';
import { useI18n } from '../../i18n/index.jsx';

function StatTile({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: { bg: '#edf2ff', fg: '#1e3a8a' },
    teal: { bg: '#e7f8f5', fg: '#0f9d8a' },
    amber: { bg: '#fff5e3', fg: '#d18a17' },
    red: { bg: '#fde8e8', fg: '#d14545' },
    green: { bg: '#e9f7f0', fg: '#11875d' },
  };
  const t = tones[tone] || tones.blue;
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className="w-[38px] h-[38px] rounded-[9px] grid place-items-center shrink-0" style={{ background: t.bg, color: t.fg }}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="block text-[9px] text-[#697386] uppercase tracking-[0.3px]">{label}</span>
        <strong className="block text-[17px] mt-0.5 text-[#172033] truncate">{value}</strong>
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/admin/stats'), api.get('/admin/audit-logs'), api.get('/admin/analytics')])
      .then(([s, l, a]) => {
        setStats(s.data.stats);
        setLogs(l.data.logs.slice(0, 8));
        setAnalytics(a.data.analytics);
      })
      .catch(() => setStats(false));
  }, []);

  if (stats === null) return <Spinner label={t('common.loadingAdminDashboard')} />;
  if (stats === false) return <Alert type="error">{t('common.failedStatistics')}</Alert>;

  return (
    <div>
      <PageHeader title={t('admin.dashboard')} subtitle={t('admin.fullOversight', { email: user?.email || '' })} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile icon={Users} label={t('admin.students')} value={stats.students} tone="blue" />
        <StatTile icon={UserCog} label={t('admin.faculty')} value={stats.faculty} tone="teal" />
        <StatTile icon={Layers} label={t('admin.activeSections')} value={stats.sections} tone="blue" />
        <StatTile icon={CalendarCheck} label={t('admin.enrollments')} value={stats.enrollments} tone="amber" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile icon={Library} label={t('admin.courses')} value={stats.courses} tone="teal" />
        <StatTile icon={Wallet} label={t('admin.collectedFees')} value={`Rs. ${stats.collectedFees.toLocaleString()}`} tone="green" />
        <StatTile icon={Wallet} label={t('admin.pendingChallans')} value={stats.pendingChallans} tone={stats.pendingChallans ? 'red' : 'amber'} />
        <StatTile icon={Star} label={t('admin.evaluations')} value={stats.evaluations} tone="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title={t('admin.recentActivity')} subtitle={t('admin.securityTrail')} className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-[18px]">
            {logs.length === 0 ? (
              <div className="py-8 text-center"><Alert type="info">{t('admin.noActivity')}</Alert></div>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="py-3 flex items-start justify-between gap-3 border-b border-[#e4e7ec] last:border-0">
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-[#172033]">
                      <span className="text-[#1e3a8a] font-semibold">{l.action}</span>
                      {l.details && <span className="text-[#697386] font-normal"> — {l.details}</span>}
                    </div>
                    {analytics && (
                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <Card title="Enrollment trend" subtitle="Registered enrollments by semester">
                          <div className="space-y-3">
                            {analytics.enrollmentTrend.length === 0 && <p className="text-sm text-slate-500">No enrollment data yet.</p>}
                            {analytics.enrollmentTrend.map((item) => {
                              const max = Math.max(...analytics.enrollmentTrend.map((x) => x.count), 1);
                              return <div key={item.semester} className="flex items-center gap-3 text-xs">
                                <span className="w-20 text-slate-600">Semester {item.semester}</span>
                                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(item.count / max) * 100}%` }} /></div>
                                <strong className="w-10 text-right text-slate-800">{item.count}</strong>
                              </div>;
                            })}
                          </div>
                        </Card>
                        <Card title="Fee collection" subtitle="Paid versus unpaid challans">
                          <div className="grid grid-cols-2 gap-3">
                            {analytics.feeBreakdown.map((item) => <div key={item.status} className="rounded-lg bg-slate-50 p-4">
                              <div className="text-xs uppercase text-slate-500">{item.status}</div>
                              <div className="mt-1 text-xl font-bold text-slate-800">{item.count}</div>
                              <div className="text-xs text-slate-500">Rs. {Number(item.amount).toLocaleString()}</div>
                            </div>)}
                          </div>
                        </Card>
                        <Card title="Academic performance" subtitle="Average CGPA by semester">
                          <div className="space-y-3">
                            {analytics.gpaDistribution.map((item) => <div key={item.semester} className="flex items-center gap-3 text-xs">
                              <span className="w-20 text-slate-600">Semester {item.semester}</span>
                              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, (item.averageCgpa / 4) * 100)}%` }} /></div>
                              <strong className="w-10 text-right text-slate-800">{item.averageCgpa.toFixed(2)}</strong>
                            </div>)}
                          </div>
                        </Card>
                        <Card title="Activity and registration funnel" subtitle="Last 30 days">
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div><div className="text-2xl font-bold text-brand-700">{analytics.activeUsers30d}</div><div className="text-xs text-slate-500">Active sessions</div></div>
                            <div><div className="text-2xl font-bold text-slate-800">{analytics.registrationFunnel.started}</div><div className="text-xs text-slate-500">Started</div></div>
                            <div><div className="text-2xl font-bold text-teal-600">{analytics.registrationFunnel.completed}</div><div className="text-xs text-slate-500">Completed</div></div>
                          </div>
                        </Card>
                      </div>
                    )}
                    <div className="text-[10px] text-[#98a0ae] mt-0.5">
                      {l.user?.email || 'system'} · {l.entity || '—'}
                    </div>
                  </div>
                  <div className="text-[10px] text-[#98a0ae] whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title={t('admin.systemHealth')} className="p-0 overflow-hidden">
          <div className="px-[18px]">
            {[
              ['Notices published', String(stats.notices), '#172033'],
              ['Fee structures', 'Active', '#11875d'],
              ['Audit logging', 'Enabled', '#11875d'],
              ['JWT auth', 'HTTP-only cookies', '#11875d'],
              ['Current semester', '5 · Fall 2026', '#172033'],
            ].map(([k, v, c]) => (
              <div key={k} className="flex items-center justify-between py-3 border-b border-[#e4e7ec] last:border-0">
                <span className="text-[12px] text-[#697386]">{k}</span>
                <span className="text-[12px] font-semibold flex items-center gap-1" style={{ color: c }}>
                  {k.includes('Audit') || k.includes('JWT') ? <ShieldCheck size={13} /> : null}
                  {v}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
