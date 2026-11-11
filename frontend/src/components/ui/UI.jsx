import { cloneElement, useEffect, useId, useRef } from 'react';

export function Card({ title, subtitle, children, className = '', action = null }) {
  return (
    <div className={`bg-white border border-[#e7e9ee] rounded-lg shadow-[0_1px_3px_rgba(19,33,68,.06),0_8px_24px_rgba(19,33,68,.045)] ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-2 px-[18px] pt-4 pb-3 border-b border-[#edf0f3] min-h-[62px]">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-[#172033] m-0">{title}</h2>}
            {subtitle && <p className="text-[10px] text-[#697386] mt-1 m-0">{subtitle}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function CardTitle({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 px-[18px] pt-4 pb-3 border-b border-[#edf0f3] min-h-[62px]">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[#172033] m-0">{title}</h2>
        {subtitle && <p className="text-[10px] text-[#697386] mt-1 m-0">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-[20px] sm:text-[23px] font-bold text-[#172033] tracking-[-0.5px] m-0">{title}</h1>
        <p className="text-[11px] text-[#697386] mt-1 m-0">{subtitle}</p>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'brand', meta }) {
  const tones = {
    brand: 'bg-[#edf2ff] text-[#1e3a8a]',
    blue: 'bg-[#edf2ff] text-[#1e3a8a]',
    teal: 'bg-[#e7f8f5] text-[#0f9d8a]',
    green: 'bg-[#e9f7f0] text-[#11875d]',
    amber: 'bg-[#fff6e5] text-[#d18a17]',
    red: 'bg-[#fde8e8] text-[#d14545]',
    slate: 'bg-[#f1f3f7] text-[#465166]',
    gold: 'bg-[#fff6e5] text-[#d18a17]',
  };
  return (
    <div className="bg-white border border-[#e7e9ee] rounded-lg shadow-[0_1px_3px_rgba(19,33,68,.06),0_8px_24px_rgba(19,33,68,.045)] p-[18px] flex items-center gap-3.5">
      {Icon && (
        <div className={`w-[42px] h-[42px] rounded-[9px] flex items-center justify-center shrink-0 ${tones[tone] || tones.brand}`}>
          <Icon size={20} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[10px] text-[#697386] font-medium">{label}</div>
        <div className="text-[22px] font-bold text-[#172033] tracking-[-0.5px] leading-tight my-0.5">{value}</div>
        {meta && <div className="text-[9px] text-[#8b94a2]">{meta}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'gray' }) {
  const tones = {
    green: 'bg-[#e9f7f0] text-[#11875d] border-[#c8e8d8]',
    red: 'bg-[#fde8e8] text-[#d14545] border-[#f5c6c6]',
    amber: 'bg-[#fff6e5] text-[#d18a17] border-[#f1d9a8]',
    blue: 'bg-[#edf2ff] text-[#1e3a8a] border-[#c8d4f5]',
    slate: 'bg-[#f1f3f7] text-[#697386] border-[#dfe3ea]',
    gray: 'bg-[#f1f3f7] text-[#697386] border-[#dfe3ea]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${tones[tone] || tones.gray}`}>
      {children}
    </span>
  );
}

export function Alert({ type = 'error', children }) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm ${styles[type]}`} role="alert" aria-live="polite">
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-[#697386]">
      <div className="w-8 h-8 border-4 border-[#c8d4f5] border-t-[#1e3a8a] rounded-full animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ message = 'No records found' }) {
  return <div className="py-10 text-center text-sm text-[#98a0ae]">{message}</div>;
}

export const tableHead = 'px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#697386] bg-[#f9fafc] border-b border-[#e4e7ec]';
export const tableCell = 'px-4 py-3 text-[12px] text-[#172033] border-b border-[#edf0f3]';
export const inputCls =
  'w-full rounded-lg border border-[#d8dde6] px-3 py-2.5 text-[13px] text-[#172033] bg-white focus:outline-none focus:border-[#0f9d8a] transition placeholder:text-[#98a0ae]';
export const btnPrimary =
  'inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--brand-primary,#1e3a8a)] hover:opacity-90 text-white px-4 py-2 text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
export const btnSecondary =
  'inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-white border border-[#d8dde6] hover:bg-[#f3f5f8] text-[#465166] px-4 py-2 text-[13px] font-medium transition';
export const btnDanger =
  'inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#d14545] hover:bg-[#b83939] text-white px-4 py-2 text-[13px] font-medium transition';
export const btnGhost =
  'inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-transparent hover:bg-[#f3f5f8] text-[#465166] px-4 py-2 text-[13px] font-medium transition';
export const btnTeal =
  'inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0f9d8a] hover:bg-[#0d8a79] text-white px-4 py-2 text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';

export function Field({ label, children, hint, error }) {
  const id = useId();
  const controlId = children.props.id || id;
  const describedBy = [hint && `${controlId}-hint`, error && `${controlId}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="block mb-4">
      <label htmlFor={controlId} className="block text-[12px] font-semibold text-[#344054] mb-2">{label}</label>
      {cloneElement(children, { id: controlId, 'aria-describedby': describedBy, 'aria-invalid': error ? 'true' : undefined })}
      {hint && <small id={`${controlId}-hint`} className="block text-[10px] text-[#5f6b80] mt-1.5">{hint}</small>}
      {error && <div id={`${controlId}-error`} role="alert" aria-live="assertive" className="text-[11px] text-red-700 mt-1">{error}</div>}
    </div>
  );
}

export function FormError({ children }) {
  return children ? <div role="alert" aria-live="assertive" className="text-sm text-red-700 mt-1">{children}</div> : null;
}

export function Modal({ title, children, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    const panel = panelRef.current;
    const focusable = () =>
      (panel?.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])') || []);
    focusable()[0]?.focus() || panel?.focus();

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = focusable();
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px] grid place-items-center p-4 sm:p-5" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="bg-white rounded-[10px] w-full max-w-[480px] max-h-[90vh] overflow-y-auto p-5 shadow-[0_20px_50px_rgba(0,0,0,.25)] focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#172033] m-0">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="min-w-[44px] min-h-[44px] rounded-full bg-[#f1f3f5] border-0 text-[#687386] text-xl leading-none grid place-items-center hover:bg-[#e4e7ec]"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange, ariaLabel = 'Sections' }) {
  return (
    <div className="flex gap-1 border-b border-[#e4e7ec] overflow-x-auto" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          id={`tab-${t}`}
          aria-selected={active === t}
          aria-controls={`panel-${t}`}
          onClick={() => onChange(t)}
          className={`border-0 bg-transparent px-3 py-4 text-[11px] font-medium whitespace-nowrap border-b-2 transition ${
            active === t
              ? 'text-[#1e3a8a] border-[#1e3a8a] font-semibold'
              : 'text-[#697386] border-transparent hover:text-[#1e3a8a]'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, totalPages, total, onPage, limit, onLimit }) {
  if (!totalPages || totalPages <= 1) return null;
  const from = (page - 1) * (limit || 20) + 1;
  const to = Math.min(page * (limit || 20), total ?? 0);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#edf0f3]">
      <div className="text-[11px] text-[#697386]">
        {total != null ? `Showing ${from}–${to} of ${total}` : `Page ${page}`}
      </div>
      <div className="flex items-center gap-2">
        {onLimit && (
          <label className="flex items-center gap-1.5 text-[11px] text-[#697386]">
            Per page
            <select
              value={limit || 20}
              onChange={(e) => onLimit(Number(e.target.value))}
              className="border border-[#d8dde6] rounded-md px-1.5 py-1 text-[11px] text-[#172033] bg-white focus:outline-none focus:border-[#0f9d8a]"
              aria-label="Rows per page"
            >
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-2.5 py-1.5 text-[11px] rounded-md border border-[#d8dde6] text-[#465166] hover:bg-[#f3f5f8] disabled:opacity-40 disabled:cursor-not-allowed transition bg-white"
          aria-label="Previous page"
        >
          Previous
        </button>
        <span className="text-[11px] text-[#465166] font-medium" aria-current="page">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="px-2.5 py-1.5 text-[11px] rounded-md border border-[#d8dde6] text-[#465166] hover:bg-[#f3f5f8] disabled:opacity-40 disabled:cursor-not-allowed transition bg-white"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}
