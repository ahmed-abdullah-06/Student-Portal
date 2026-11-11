export default function BrandLogo({ light = false, branding, size = 'md' }) {
  const primary = branding?.primaryColor || '#1e3a8a';
  const box = size === 'lg' ? 'w-12 h-12 rounded-xl' : 'w-10 h-10 rounded-[10px]';
  const mark = size === 'lg' ? 'text-base' : 'text-sm';
  return (
    <div className={`flex items-center gap-2.5 ${light ? 'text-white' : ''}`} style={light ? undefined : { color: primary }}>
      <div
        className={`${box} flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(255,255,255,.15)] text-white`}
        style={light ? { color: primary, backgroundColor: '#fff' } : { backgroundColor: primary }}
      >
        <span className={`font-extrabold tracking-tight ${mark}`}>{branding?.logoText || 'NU'}</span>
      </div>
      <div>
        <div className={`text-[13px] font-bold leading-tight ${light ? 'text-white' : ''}`} style={light ? undefined : { color: primary }}>
          {branding?.portalName || 'Novastra'}
        </div>
        <div className={`text-[9px] uppercase tracking-[1.5px] mt-0.5 ${light ? 'text-white/70' : 'text-[#697386]'}`}>
          {branding?.tagline || 'Campus Portal'}
        </div>
      </div>
    </div>
  );
}
