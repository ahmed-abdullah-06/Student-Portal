import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie } from 'lucide-react';
import { useBranding } from '../../context/BrandingContext';

const STORAGE_KEY = 'novastra-cookie-prefs';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { essential: true, analytics: false, functional: false };
  } catch {
    return { essential: true, analytics: false, functional: false };
  }
}

export default function CookieConsent() {
  const { branding } = useBranding();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [saved, setSaved] = useState(false);

  function toggle(key) {
    if (key === 'essential') return; // always on
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
  }

  const rows = [
    {
      key: 'essential',
      title: 'Essential cookies',
      desc: 'Required for sign-in, session security and core portal features. Always active.',
      required: true,
    },
    {
      key: 'analytics',
      title: 'Analytics cookies',
      desc: 'Help us understand portal usage (page views, errors) to improve the service.',
    },
    {
      key: 'functional',
      title: 'Functional cookies',
      desc: 'Remember preferences such as language and theme.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f6f8fc] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#697386] hover:text-[#1e3a8a] mb-5 transition"
        >
          <ArrowLeft size={13} /> Back to sign in
        </Link>

        <div className="bg-white border border-[#e7e9ee] rounded-xl shadow-[0_1px_3px_rgba(19,33,68,.06),0_8px_24px_rgba(19,33,68,.045)] p-7">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#edf2ff] text-[#1e3a8a] flex items-center justify-center">
              <Cookie size={19} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#172033] m-0">Cookie preferences</h1>
              <p className="text-[11px] text-[#697386] m-0 mt-0.5">
                {branding.universityName} · {branding.portalName}
              </p>
            </div>
          </div>

          <p className="text-sm text-[#697386] mt-3 mb-5 leading-relaxed">
            We use cookies to keep you signed in, secure your session and improve the portal.
            You can choose which optional cookies to allow. See our{' '}
            <Link to="/privacy" className="text-[#1e3a8a] underline">privacy policy</Link> for details.
          </p>

          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex items-start justify-between gap-4 border border-[#edf0f3] rounded-lg px-4 py-3.5"
              >
                <div>
                  <h2 className="text-[13px] font-semibold text-[#172033] m-0">{row.title}</h2>
                  <p className="text-[11px] text-[#697386] m-0 mt-1 leading-relaxed">{row.desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[row.key]}
                  aria-label={row.title}
                  disabled={row.required}
                  onClick={() => toggle(row.key)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
                    prefs[row.key] ? 'bg-[#0f9d8a]' : 'bg-[#d8dde6]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      prefs[row.key] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={save}
              className="rounded-lg bg-[#1e3a8a] hover:bg-[#1e40af] text-white px-5 py-2.5 text-[13px] font-semibold transition"
            >
              Save preferences
            </button>
            <button
              onClick={() => {
                const all = { essential: true, analytics: true, functional: true };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
                setPrefs(all);
                setSaved(true);
              }}
              className="rounded-lg border border-[#d8dde6] text-[#465166] px-5 py-2.5 text-[13px] font-semibold hover:bg-[#f3f5f8] transition"
            >
              Accept all
            </button>
            {saved && (
              <span className="text-[12px] font-semibold text-[#11875d]">Preferences saved</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
