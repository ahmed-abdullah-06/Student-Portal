import { useEffect } from 'react';

export function useRealtime() {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || typeof WebSocket === 'undefined') return undefined;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const socketUrl = apiUrl.replace(/^http/, 'ws').replace(/\/api\/?$/, `/ws?token=${encodeURIComponent(token)}`);
    let socket;
    let timer;
    let stopped = false;
    let attempt = 0;

    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(socketUrl);
      socket.onopen = () => { attempt = 0; };
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data);
          window.dispatchEvent(new CustomEvent(`portal:${event.event}`, { detail: event.data }));
        } catch {
          // The server only sends JSON; malformed frames are ignored safely.
        }
      };
      socket.onclose = () => {
        if (!stopped) {
          timer = window.setTimeout(connect, Math.min(30000, 1000 * 2 ** attempt));
          attempt += 1;
        }
      };
    };

    connect();
    window.portalRealtimeSend = (event, data) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event, ...data }));
    };
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      socket?.close();
      delete window.portalRealtimeSend;
    };
  }, []);
}
