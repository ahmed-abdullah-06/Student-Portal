import { useState } from 'react';
import { Building2, Check, X } from 'lucide-react';
import { useBranding } from '../../context/BrandingContext';
import { getTenant, switchTenant } from '../../services/tenant';

export default function TenantSwitcher({ className = '' }) {
  const { branding } = useBranding();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  function apply(e) {
    e.preventDefault();
    switchTenant(value.trim() || null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(getTenant() || '');
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 text-[11px] text-[#697386] hover:text-[#1e3a8a] transition ${className}`}
      >
        <Building2 size={12} />
        {branding.universityName}
        <span className="underline underline-offset-2">Change</span>
      </button>
    );
  }

  return (
    <form onSubmit={apply} className={`inline-flex items-center gap-1.5 ${className}`}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="tenant slug (blank = default)"
        aria-label="Tenant slug"
        className="border border-[#d8dde6] rounded-lg px-2.5 py-1.5 text-[12px] w-[200px] focus:border-[#0f9d8a] focus:outline-none"
      />
      <button type="submit" className="p-1.5 rounded-lg bg-[#1e3a8a] text-white" aria-label="Switch tenant">
        <Check size={13} />
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="p-1.5 rounded-lg border border-[#d8dde6] text-[#697386] hover:bg-[#f3f5f8]"
        aria-label="Cancel"
      >
        <X size={13} />
      </button>
    </form>
  );
}
