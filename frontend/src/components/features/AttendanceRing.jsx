export default function AttendanceRing({ percentage, size = 96, stroke = 9 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped < 75 ? '#dc2626' : clamped < 85 ? '#d4a017' : '#006838';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} stroke="#e2e8f0" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          stroke={color}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-bold" style={{ color }}>
          {Math.round(clamped)}%
        </div>
        <div className="text-[9px] uppercase text-slate-400 tracking-wide">Attendance</div>
      </div>
    </div>
  );
}
