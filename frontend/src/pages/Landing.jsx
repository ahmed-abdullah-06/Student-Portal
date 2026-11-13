import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpenCheck, CalendarCheck, Check, GraduationCap,
  ShieldCheck, Sparkles, TrendingUp, Wallet,
} from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import BrandLogo from '../components/shared/BrandLogo';
import LogoStage from '../components/shared/LogoStage';

const PORTALS = [
  {
    key: 'student',
    title: 'Student',
    heading: 'Learn without limits',
    to: '/login/student',
    icon: GraduationCap,
    accent: '#2dd4bf',
    description: 'Courses, attendance, results, fee challans and campus services — all in one workspace.',
    bullets: ['Course workspace & resources', 'Attendance, marks & results', 'Fees, requests & documents'],
  },
  {
    key: 'faculty',
    title: 'Faculty',
    heading: 'Teach with clarity',
    to: '/login/faculty',
    icon: BookOpenCheck,
    accent: '#60a5fa',
    description: 'Mark attendance, enter marks, publish assignments and follow every student’s progress.',
    bullets: ['Attendance & marks register', 'Assignments and quizzes', 'Evaluation analytics'],
  },
  {
    key: 'admin',
    title: 'Administration',
    heading: 'Run the campus',
    to: '/login/admin',
    icon: ShieldCheck,
    accent: '#fbbf24',
    description: 'Manage people, sections, fees, approvals and institutional reporting end to end.',
    bullets: ['Students, faculty & sections', 'Fees, approvals & reports', 'Notices and portal settings'],
  },
];

function RoleCard({ portal, index }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, on: false });
  const Icon = portal.icon;

  function handleMove(e) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ rx: (0.5 - y) * 9, ry: (x - 0.5) * 11 });
    setGlare({ x: x * 100, y: y * 100, on: true });
  }

  function reset() {
    setTilt({ rx: 0, ry: 0 });
    setGlare((g) => ({ ...g, on: false }));
  }

  return (
    <div
      className="landing-card-rise"
      style={{ animationDelay: `${140 + index * 130}ms` }}
    >
      <Link
        ref={cardRef}
        to={portal.to}
        onPointerMove={handleMove}
        onPointerLeave={reset}
        onBlur={reset}
        className="portal-card group relative flex h-full flex-col rounded-2xl p-6 text-left"
        style={{
          '--portal-accent': portal.accent,
          transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        }}
      >
        <span
          className="portal-card-glare"
          aria-hidden="true"
          style={{ opacity: glare.on ? 1 : 0, background: `radial-gradient(420px circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,.16), transparent 60%)` }}
        />
        <div
          className="portal-card-icon mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${portal.accent}1f`, color: portal.accent, boxShadow: `inset 0 0 0 1px ${portal.accent}40` }}
        >
          <Icon size={22} />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[2px] text-white/45">{portal.title}</div>
        <h2 className="mt-1.5 text-xl font-bold tracking-[-0.3px] text-white">{portal.heading}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-white/65">{portal.description}</p>
        <ul className="mt-5 space-y-2">
          {portal.bullets.map((b) => (
            <li key={b} className="flex items-center gap-2 text-[12px] text-white/70">
              <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: `${portal.accent}26`, color: portal.accent }}>
                <Check size={10} strokeWidth={3} />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <span
          className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold transition-transform duration-300 group-hover:translate-x-1"
          style={{ color: portal.accent }}
        >
          Enter {portal.title.toLowerCase()} portal
          <ArrowRight size={15} />
        </span>
      </Link>
    </div>
  );
}

export default function Landing() {
  const { branding } = useBranding();
  const rootRef = useRef(null);

  function handleSceneMove(e) {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--px', ((e.clientX - rect.left) / rect.width - 0.5).toFixed(3));
    el.style.setProperty('--py', ((e.clientY - rect.top) / rect.height - 0.5).toFixed(3));
    el.style.setProperty('--lx', ((e.clientX - rect.left) / rect.width - 0.5).toFixed(3));
    el.style.setProperty('--ly', ((e.clientY - rect.top) / rect.height - 0.5).toFixed(3));
  }

  return (
    <div
      ref={rootRef}
      onPointerMove={handleSceneMove}
      className="landing-root relative flex min-h-screen flex-col overflow-hidden text-white"
    >
      <div
        className="landing-scene pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="landing-grid" />
        <div className="landing-orb" style={{ width: 420, height: 420, left: '-8%', top: '-12%', background: '#1e3a8a' }} />
        <div className="landing-orb" style={{ width: 380, height: 380, right: '-6%', top: '6%', background: '#0f9d8a', animationDelay: '-5s' }} />
        <div className="landing-orb" style={{ width: 300, height: 300, left: '38%', bottom: '-18%', background: '#2563eb', animationDelay: '-9s' }} />
        <div className="landing-orbit landing-orbit-a" />
        <div className="landing-orbit landing-orbit-b" />
        <div className="landing-decor hidden md:block">
          <div className="landing-parallax" style={{ left: '3%', top: '64%', '--depth': '26px' }}>
            <div className="landing-chip" style={{ animationDelay: '-2s' }}>
              <CalendarCheck size={15} className="text-[#2dd4bf]" />
              Attendance <strong className="text-[#5eead4]">92%</strong>
            </div>
          </div>
          <div className="landing-parallax" style={{ right: '4%', top: '55%', '--depth': '34px' }}>
            <div className="landing-chip" style={{ animationDelay: '-4.5s' }}>
              <TrendingUp size={15} className="text-[#60a5fa]" />
              CGPA <strong className="text-[#93c5fd]">3.84</strong>
            </div>
          </div>
          <div className="landing-parallax" style={{ left: '5%', bottom: '10%', '--depth': '20px' }}>
            <div className="landing-chip" style={{ animationDelay: '-1s' }}>
              <Wallet size={15} className="text-[#fbbf24]" />
              Fee status <strong className="text-[#fcd34d]">Paid</strong>
            </div>
          </div>
        </div>
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <BrandLogo light branding={branding} />
        <div className="flex items-center gap-4">
          <span className="hidden text-[12px] text-white/55 sm:inline">
            {branding.universityName}
          </span>
          <Link
            to="/login"
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-semibold text-white/85 backdrop-blur transition hover:bg-white/10 hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-12 pt-8 lg:pt-14">
        <div className="grid w-full items-center gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-2">
          <div className="landing-card-rise mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[2.2px] text-[#8fe8dc] backdrop-blur">
              <Sparkles size={12} />
              One portal · every campus service
            </span>
            <h1 className="mt-6 text-[40px] font-bold leading-[1.08] tracking-[-1.6px] sm:text-[54px] lg:text-[58px]">
              One campus.
              <br />
              <span className="landing-gradient-text">Every service. Connected.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/65 sm:text-[17px] lg:mx-0">
              {branding.portalName} brings students, faculty and administrators into one secure,
              beautifully simple home for campus life at {branding.universityName}.
            </p>
          </div>

          <div className="landing-card-rise order-first flex justify-center lg:order-last" style={{ animationDelay: '120ms' }}>
            <LogoStage className="landing-logo3d" />
          </div>
        </div>

        <div className="mt-11 grid gap-5 md:grid-cols-3">
          {PORTALS.map((portal, i) => (
            <RoleCard key={portal.key} portal={portal} index={i} />
          ))}
        </div>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] text-white/50">
          <span className="inline-flex items-center gap-1.5"><Check size={12} className="text-[#2dd4bf]" /> Role-secure sign-in</span>
          <span className="inline-flex items-center gap-1.5"><Check size={12} className="text-[#2dd4bf]" /> Multi-campus ready</span>
          <span className="inline-flex items-center gap-1.5"><Check size={12} className="text-[#2dd4bf]" /> Available 24/7</span>
        </div>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-5 text-[11px] text-white/40">
        <span>© 2026 {branding.universityName}. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">Support: {branding.supportEmail}</span>
          <Link to="/platform" className="transition hover:text-white/70">Platform console</Link>
        </div>
      </footer>
    </div>
  );
}
