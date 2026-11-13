import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams, Navigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpenCheck, CalendarCheck, Eye, EyeOff,
  GraduationCap, Loader2, RefreshCw, ShieldCheck, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { useBranding } from '../context/BrandingContext';
import { Alert } from '../components/ui/UI';
import TenantSwitcher from '../components/shared/TenantSwitcher';
import BrandLogo from '../components/shared/BrandLogo';
import LogoStage from '../components/shared/LogoStage';
import { getTenant } from '../services/tenant';
import api, { apiMessage } from '../services/api';

const roleHome = { STUDENT: '/student', FACULTY: '/faculty', ADMIN: '/admin' };

const PORTALS = {
  student: {
    role: 'STUDENT',
    label: 'Student',
    eyebrow: 'Student portal',
    heading: 'Student sign-in',
    subtitle: 'Access your courses, attendance, results, fee records and campus services.',
    icon: GraduationCap,
    accent: '#0f9d8a',
    demo: 'SP23-BSCS-001 / student123 (reg. no. login)',
  },
  faculty: {
    role: 'FACULTY',
    label: 'Faculty',
    eyebrow: 'Faculty portal',
    heading: 'Faculty sign-in',
    subtitle: 'Mark attendance, enter marks and manage your assigned sections.',
    icon: BookOpenCheck,
    accent: '#2563eb',
    demo: 'ali.khan@novastra.edu.pk / faculty123',
  },
  admin: {
    role: 'ADMIN',
    label: 'Administration',
    eyebrow: 'Administration portal',
    heading: 'Administrator sign-in',
    subtitle: 'Manage students, faculty, sections, fees, approvals and portal settings.',
    icon: ShieldCheck,
    accent: '#b45309',
    demo: 'admin@novastra.edu.pk / admin123',
  },
};

const campusImage =
  'https://images.unsplash.com/photo-1562774053-701939374585?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1600';

export default function Login() {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const { branding, tenantError } = useBranding();
  const { role: portalKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const visualRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [remember, setRemember] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [pendingToken, setPendingToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const portal = portalKey && PORTALS[portalKey] ? PORTALS[portalKey] : null;
  const invalidPortal = Boolean(portalKey) && !portal;

  async function loadCaptcha() {
    try {
      const res = await api.get('/auth/captcha');
      setCaptcha(res.data.code);
      setCaptchaToken(res.data.token);
      setCaptchaInput('');
    } catch {
      setCaptcha('');
    }
  }

  useEffect(() => {
    loadCaptcha();
  }, []);

  if (user) return <Navigate to={roleHome[user.role] || '/dashboard'} replace />;
  if (invalidPortal) return <Navigate to="/login" replace />;

  const PortalIcon = portal?.icon;

  function handleVisualMove(e) {
    const el = visualRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--lx', ((e.clientX - rect.left) / rect.width - 0.5).toFixed(3));
    el.style.setProperty('--ly', ((e.clientY - rect.top) / rect.height - 0.5).toFixed(3));
  }

  function resetVisual() {
    const el = visualRef.current;
    if (!el) return;
    el.style.setProperty('--lx', '0');
    el.style.setProperty('--ly', '0');
  }

  function resetTwoFactor() {
    setNeeds2FA(false);
    setPendingToken('');
    setTotpCode('');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = needs2FA
        ? await login(email, password, undefined, undefined, portal?.role, totpCode, pendingToken)
        : await login(email, password, captchaInput, captchaToken, portal?.role);
      if (result?.requires2FA) {
        setPendingToken(result.pendingToken);
        setNeeds2FA(true);
        setTotpCode('');
        setError('');
        return;
      }
      const u = result;
      const from = location.state?.from?.pathname;
      navigate(from && from !== '/' ? from : roleHome[u.role] || '/dashboard', { replace: true });
    } catch (err) {
      setError(apiMessage(err, 'Login failed'));
      if (!needs2FA) loadCaptcha();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-screen min-h-[680px] bg-white grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr]">
      <section
        ref={visualRef}
        onPointerMove={handleVisualMove}
        onPointerLeave={resetVisual}
        className="auth-visual relative p-10 lg:p-14 flex flex-col text-white overflow-hidden max-lg:hidden"
      >
        <div
          className="auth-visual-bg"
          style={{ backgroundImage: `url(${campusImage})` }}
          aria-hidden="true"
        />
        <div className="auth-visual-overlay" aria-hidden="true" />
        <div className="auth-orbit auth-orbit-a" aria-hidden="true" />
        <div className="auth-orbit auth-orbit-b" aria-hidden="true" />
        <div className="auth-visual-glow" aria-hidden="true" />

        <div className="auth-chip-wrap max-xl:hidden" style={{ right: '5%', top: '12%', '--depth': '26px' }} aria-hidden="true">
          <div className="auth-chip" style={{ animationDelay: '-1.5s' }}>
            <CalendarCheck size={14} className="text-[#5eead4]" />
            Attendance <strong className="text-[#99f6e4]">92%</strong>
          </div>
        </div>
        <div className="auth-chip-wrap max-xl:hidden" style={{ right: '4%', bottom: '10%', '--depth': '38px' }} aria-hidden="true">
          <div className="auth-chip" style={{ animationDelay: '-4s' }}>
            <TrendingUp size={14} className="text-[#93c5fd]" />
            CGPA <strong className="text-[#bfdbfe]">3.84</strong>
          </div>
        </div>
        <div className="auth-chip-wrap max-xl:hidden" style={{ left: '6%', top: '30%', '--depth': '18px' }} aria-hidden="true">
          <div className="auth-chip" style={{ animationDelay: '-2.7s' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#34d399] shadow-[0_0_10px_#34d399]" />
            Result <strong className="text-emerald-200">Published</strong>
          </div>
        </div>

        <div className="auth-visual-inner relative z-10 flex flex-col h-full">
          <BrandLogo light branding={branding} />
          <div className="relative z-10 flex flex-1 items-center justify-center py-4">
            <LogoStage variant="auth" />
          </div>
          <div className="mb-[7vh] max-w-[620px]">
            <span className="text-[11px] font-bold tracking-[1.8px] text-[#a8eee4]">LEARN • GROW • LEAD</span>
            <h1 className="auth-hero-title text-[46px] leading-[1.13] tracking-[-1.8px] my-4">
              Your academic journey,
              <br />
              all in one place.
            </h1>
            <p className="text-[17px] leading-relaxed max-w-[560px] text-white/85">
              Access courses, attendance, results, fee records and campus services through the {branding.portalName} {branding.tagline.toLowerCase()}.
            </p>
            <div className="flex gap-14 mt-10">
              <div>
                <strong className="block text-[23px]">18K+</strong>
                <span className="block text-[12px] text-white/70 mt-1">Students</span>
              </div>
              <div>
                <strong className="block text-[23px]">95+</strong>
                <span className="block text-[12px] text-white/70 mt-1">Programs</span>
              </div>
              <div>
                <strong className="block text-[23px]">6</strong>
                <span className="block text-[12px] text-white/70 mt-1">Campuses</span>
              </div>
            </div>
          </div>
        </div>
        <span className="absolute bottom-4 left-14 text-[9px] text-white/50">
          Photo by Syed Fassih ul Hassny on Unsplash
        </span>
      </section>

      <section className="flex items-center justify-center relative p-8 lg:p-10">
        <div className="lg:hidden w-full mb-8">
          <BrandLogo branding={branding} />
        </div>
        <form className="w-full max-w-[430px]" onSubmit={handleSubmit}>
          <div className="mb-8">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#697386] hover:text-[#1e3a8a] mb-5 transition"
            >
              <ArrowLeft size={13} /> Choose a different portal
            </Link>
            {portal ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${portal.accent}14`, color: portal.accent, boxShadow: `inset 0 0 0 1px ${portal.accent}33` }}
                  >
                    <PortalIcon size={19} />
                  </div>
                  <span className="text-[11px] font-bold tracking-[1.8px] uppercase" style={{ color: portal.accent }}>
                    {portal.eyebrow}
                  </span>
                </div>
                <h2 className="text-[32px] tracking-[-0.8px] my-2 font-bold text-[#172033]">{portal.heading}</h2>
                <p className="text-sm text-[#697386] m-0 mb-3">{portal.subtitle}</p>
              </>
            ) : (
              <>
                <span className="text-[11px] font-bold tracking-[1.8px] text-[#0f9d8a]">{branding.tagline.toUpperCase()}</span>
                <h2 className="text-[32px] tracking-[-0.8px] my-2 font-bold text-[#172033]">Welcome back</h2>
                <p className="text-sm text-[#697386] m-0 mb-3">{t('auth.credentials')}</p>
              </>
            )}
            <TenantSwitcher />
          </div>

          {(error || tenantError) && (
            <div className="mb-4" aria-live="polite">
              <Alert type="error">{tenantError || error}</Alert>
            </div>
          )}

          {needs2FA && (
            <div className="mb-5 rounded-xl border border-[#e4e7ec] bg-[#f8fafc] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#344054]">
                <ShieldCheck size={14} className="text-[#0f9d8a]" />
                Two-factor authentication required
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#697386]">
                Enter the 6-digit code from your authenticator app for <strong className="text-[#465166]">{email}</strong>.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                autoComplete="one-time-code"
                required
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                aria-label="Two-factor code"
                className="mt-3 w-full border border-[#d8dde6] bg-white rounded-lg px-3 py-3 text-center text-lg font-bold tracking-[10px] text-[#172033] focus:border-[#0f9d8a] focus:outline-none placeholder:text-[#c3c9d4]"
              />
              <button
                type="button"
                onClick={resetTwoFactor}
                className="mt-3 text-[11px] font-semibold text-[#697386] hover:text-[#1e3a8a] transition"
              >
                Use a different account
              </button>
            </div>
          )}

          {!needs2FA && (
            <>
          <label className="block mb-4">
            <label htmlFor="login-identity" className="block text-xs font-semibold text-[#344054] mb-2">{t('auth.emailOrRegistration')}</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={email}
              id="login-identity" onChange={(e) => setEmail(e.target.value)}
              placeholder="sp23-bscs-001@student.novastra.edu.pk or SP23-BSCS-001"
              className="w-full border border-[#d8dde6] bg-white rounded-lg px-3 py-3 text-sm text-[#172033] focus:border-[#0f9d8a] focus:outline-none transition placeholder:text-[#98a0ae]"
            />
            <small className="block text-[10px] text-[#98a0ae] mt-1.5">
              Use your email or registration number (e.g. SP23-BSCS-001)
            </small>
          </label>

          <label className="block mb-4">
            <label htmlFor="login-password" className="block text-xs font-semibold text-[#344054] mb-2">{t('auth.password')}</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                id="login-password" onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-[#d8dde6] bg-white rounded-lg pl-3 pr-11 py-3 text-sm text-[#172033] focus:border-[#0f9d8a] focus:outline-none transition placeholder:text-[#98a0ae]"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98a0ae] hover:text-[#465166]"
                tabIndex={-1}
                aria-label="Show password"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <div className="flex flex-wrap items-end gap-2 mb-4">
            <div className="shrink-0 bg-[#f3f5f8] border border-[#e4e7ec] rounded-lg px-4 py-2.5 text-sm font-bold tracking-[6px] text-[#1e3a8a] select-none">
              {captcha.split('').map((ch, i) => (
                <span key={i} className={i % 2 ? 'text-[#0f9d8a]' : ''}>{ch}</span>
              ))}
            </div>
            <button
              type="button"
              onClick={loadCaptcha}
              className="shrink-0 border border-[#d8dde6] bg-white rounded-lg px-3 py-2.5 text-[#465166] hover:bg-[#f3f5f8]"
              aria-label="Refresh captcha"
            >
              <RefreshCw size={15} />
            </button>
            <input
              aria-label="Captcha answer"
              placeholder="Enter code"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              maxLength={5}
              className="flex-1 min-w-0 border border-[#d8dde6] bg-white rounded-lg px-3 py-2.5 text-sm text-[#172033] focus:border-[#0f9d8a] focus:outline-none placeholder:text-[#98a0ae]"
            />
          </div>

          <div className="flex items-center justify-between mb-5">
            <label className="flex items-center gap-2 text-xs text-[#465166] cursor-pointer">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[#1e3a8a]" />
              {t('auth.remember')}
            </label>
            <Link to="/forgot-password" className="text-xs text-[#1e3a8a] hover:underline">Forgot password?</Link>
          </div>
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-lg text-white px-4 py-3.5 text-sm font-semibold transition disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: branding.primaryColor }}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> {needs2FA ? t('auth.verifying') : t('auth.signingIn')}
              </>
            ) : needs2FA ? (
              <>
                Verify &amp; sign in <ShieldCheck size={16} />
              </>
            ) : (
              <>
                {t('auth.submit')} {portal ? `to ${portal.label.toLowerCase()} portal` : 'to portal'} <ArrowRight size={16} />
              </>
            )}
          </button>

          <p className="text-xs text-[#98a0ae] text-center mt-5">
            Need help? Contact <strong className="text-[#465166]">IT Support</strong> at{' '}
            {[branding.supportPhone, branding.supportEmail].filter(Boolean).join(' · ')}
          </p>

          {!getTenant() && (
            <div className="mt-8 border-t border-[#edf0f3] pt-4">
              <div className="text-[10px] uppercase tracking-wide text-[#98a0ae] mb-2 font-semibold">
                {portal ? `Demo ${portal.label.toLowerCase()} account` : 'Demo accounts'}
              </div>
              <div className="space-y-1 text-[11px] text-[#697386] font-mono">
                {portal ? (
                  <div>{portal.demo}</div>
                ) : (
                  <>
                    <div>admin@novastra.edu.pk / admin123</div>
                    <div>ali.khan@novastra.edu.pk / faculty123</div>
                    <div>SP23-BSCS-001 / student123 (reg. no. login)</div>
                  </>
                )}
              </div>
            </div>
          )}

          <p className="text-[10px] text-[#9aa1ad] text-center mt-6">
            © 2026 {branding.universityName}. All rights reserved.{' '}
            <Link to="/privacy" className="text-[#1e3a8a] hover:underline">Privacy</Link>
            {' · '}
            <Link to="/terms" className="text-[#1e3a8a] hover:underline">Terms</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
