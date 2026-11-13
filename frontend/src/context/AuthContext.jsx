import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password, captcha, captchaToken, role, totp, pendingToken) {
    const res = await api.post('/auth/login', {
      email,
      password,
      captcha,
      captchaToken,
      ...(role ? { role } : {}),
      ...(totp ? { totp, pendingToken } : {}),
    });
    if (res.data.requires2FA) {
      return { requires2FA: true, pendingToken: res.data.pendingToken };
    }
    localStorage.setItem('token', res.data.token);
    const me = await api.get('/auth/me');
    setUser(me.data.user);
    return me.data.user;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  }

  const profile = user?.student || user?.faculty || null;

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
