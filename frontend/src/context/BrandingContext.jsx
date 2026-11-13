import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const DEFAULTS = {
  universityName: 'Novastra University',
  portalName: 'Novastra',
  tagline: 'Campus Portal',
  logoText: 'NU',
  primaryColor: '#1e3a8a',
  accentColor: '#0f9d8a',
  supportEmail: 'support@novastra.edu.pk',
  supportPhone: '+92-51-111-001-001',
};

const BrandingContext = createContext(null);

function applyBranding(b) {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', b.primaryColor || DEFAULTS.primaryColor);
  root.style.setProperty('--brand-accent', b.accentColor || DEFAULTS.accentColor);
  document.title = `${b.portalName || DEFAULTS.portalName} · ${b.universityName || DEFAULTS.universityName}`;
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULTS);
  const [features, setFeatures] = useState({});
  const [tenantError, setTenantError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/public/branding');
      const b = { ...DEFAULTS, ...(res.data.branding || {}) };
      setBranding(b);
      setFeatures(res.data.features || {});
      setTenantError(null);
      applyBranding(b);
      return b;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) setTenantError('Unknown university. Check the tenant slug.');
      else if (status === 403) setTenantError('This university portal is currently suspended.');
      else setTenantError(null);
      applyBranding(DEFAULTS);
      return DEFAULTS;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <BrandingContext.Provider value={{ branding, features, tenantError, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
}
