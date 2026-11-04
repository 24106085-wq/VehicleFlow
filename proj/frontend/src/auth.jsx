import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { WORKSPACES } from './workspace.jsx';
import { api } from './api.js';

const Ctx = createContext();
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!localStorage.getItem('vf_token')) return setLoading(false);
    api('/auth/me').then((d) => setUser(d.user)).catch(() => localStorage.removeItem('vf_token')).finally(() => setLoading(false));
  }, []);
  const authed = (d) => { localStorage.setItem('vf_token', d.token); setUser(d.user); return d.user; };
  const login = async (email, password) => authed(await api('/auth/login', { method: 'POST', body: { email, password } }));
  const register = async (body) => authed(await api('/auth/register', { method: 'POST', body }));
  const logout = () => { localStorage.removeItem('vf_token'); setUser(null); };
  return <Ctx.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

// Guards a workspace: no session -> landing page (opens the access panel); wrong role -> landing page with a notice.
export function Protected({ roles, ws, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-slate-500">Loading…</p>;
  if (!user) return <Navigate to={ws ? `/?open=${ws}` : '/'} replace />;
  if (roles && !roles.includes(user.role)) {
    const own = user.role === 'customer' ? WORKSPACES.customer : WORKSPACES.admin;
    return <Navigate to={ws ? '/?denied=1' : own.base} replace />;
  }
  return children;
}
