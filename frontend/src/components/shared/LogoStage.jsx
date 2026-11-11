import { BookOpenCheck, GraduationCap, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { useBranding } from '../../context/BrandingContext';

const EDGE_SEGMENTS = 20;
const EDGE_STEP = 360 / EDGE_SEGMENTS;

const TILES = [
  { key: 'cap', icon: GraduationCap, className: 'logo3d-tile-a', z: '46px', delay: '-0.8s', accent: '#5eead4' },
  { key: 'book', icon: BookOpenCheck, className: 'logo3d-tile-b', z: '70px', delay: '-2.1s', accent: '#93c5fd' },
  { key: 'shield', icon: ShieldCheck, className: 'logo3d-tile-c', z: '56px', delay: '-3.4s', accent: '#fcd34d' },
  { key: 'chart', icon: TrendingUp, className: 'logo3d-tile-d', z: '82px', delay: '-4.7s', accent: '#f0abfc' },
];

export default function LogoStage({ variant = 'hero', className = '' }) {
  const { branding } = useBranding();
  const mono = branding.logoText || 'NU';

  return (
    <div
      className={`logo3d ${variant === 'auth' ? 'logo3d-auth' : ''} ${className}`}
      aria-hidden="true"
    >
      <div className="logo3d-stage">
        <div className="logo3d-glow" />
        <div className="logo3d-ring logo3d-ring-a" />
        <div className="logo3d-ring logo3d-ring-b" />
        <div className="logo3d-ring logo3d-ring-c" />

        <div className="logo3d-tilt">
          <div className="logo3d-bob">
            <div className="logo3d-coin">
              <div className="logo3d-face logo3d-front">
                <span className="logo3d-front-inner">
                  <span className="logo3d-mono">{mono}</span>
                  <span className="logo3d-name">{branding.portalName || 'Novastra'}</span>
                  <span className="logo3d-sub">{branding.tagline || 'Campus Portal'}</span>
                </span>
                <span className="logo3d-shine" />
              </div>
              <div className="logo3d-face logo3d-back">
                <span className="logo3d-back-inner">
                  <Sparkles size={26} />
                  <span className="logo3d-back-name">{branding.universityName}</span>
                  <span className="logo3d-sub">EST. 2026</span>
                </span>
              </div>
              {Array.from({ length: EDGE_SEGMENTS }).map((_, i) => (
                <span
                  key={i}
                  className="logo3d-edge"
                  style={{ transform: `rotateY(${i * EDGE_STEP}deg) translateZ(var(--coin-r))` }}
                />
              ))}
            </div>
          </div>
        </div>

        {TILES.map(({ key, icon: Icon, className: tileClass, z, delay, accent }) => (
          <span
            key={key}
            className={`logo3d-tile ${tileClass}`}
            style={{ '--z': z, animationDelay: delay, color: accent }}
          >
            <Icon size={18} strokeWidth={1.9} />
          </span>
        ))}
      </div>
    </div>
  );
}
