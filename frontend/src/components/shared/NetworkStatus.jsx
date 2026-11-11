import { useEffect, useState } from 'react';

export default function NetworkStatus() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    const expire = () => setSessionExpired(true);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    window.addEventListener('portal:session-expired', expire);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('portal:session-expired', expire);
    };
  }, []);

  if (!offline && !sessionExpired) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[200] bg-amber-600 px-4 py-2 text-center text-xs font-semibold text-white">
      {offline ? 'You are offline. Changes will resume when your connection returns.' : 'Your session expired. Please sign in again.'}
      {sessionExpired && (
        <a className="ml-2 underline" href="/login">
          Sign in
        </a>
      )}
    </div>
  );
}
