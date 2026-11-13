import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/shared/Sidebar';
import Navbar from '../components/shared/Navbar';
import { useBranding } from '../context/BrandingContext';
import { useRealtime } from '../services/realtime';

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const { branding } = useBranding();
  useRealtime();

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar onMenu={() => setOpen(true)} />
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="pt-[62px] lg:pt-[70px] lg:pl-[250px]">
        <main id="main-content" tabIndex={-1} className="max-w-[1600px] mx-auto px-4 lg:px-8 py-5 lg:py-7 focus:outline-none">
          <Outlet />
        </main>
        <footer className="text-center text-[10px] text-[#9aa1ad] py-5 px-5">
          © 2026 {branding.universityName} <span className="mx-2">•</span> {branding.portalName} · {branding.tagline}{' '}
          <span className="mx-2">•</span> {branding.supportEmail}
        </footer>
      </div>
    </div>
  );
}
