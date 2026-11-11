export default function Avatar({ name = 'User', src, size = 'h-8 w-8' }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return src
    ? <img src={src} alt={`${name} profile`} className={`${size} rounded-full object-cover`} loading="lazy" />
    : <span role="img" aria-label={`${name} profile placeholder`} className={`${size} rounded-full bg-[#edf2ff] text-[#1e3a8a] inline-grid place-items-center text-[10px] font-bold`}>{initials || '?'}</span>;
}
