import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Repeat, LayoutDashboard, Car, CalendarCheck, UserCog, Users, LogOut, Menu, X, ClipboardList, FilePlus2, ListChecks, Gauge, Bell } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useBase, useWorkspace } from '../workspace.jsx';

// Sidebar per role. `hash` items share a page but are highlighted independently.
const MENUS = {
  customer: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/vehicles', label: 'My Vehicles', icon: Car },
    { to: '/report', label: 'Report a Problem', icon: FilePlus2 },
    { to: '/problems', label: 'My Problems', icon: ListChecks },
    { to: '/profile', label: 'Profile', icon: UserCog },
  ],
  admin: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/backlog', label: 'Product Backlog', icon: ClipboardList },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/vehicles', label: 'Vehicles', icon: Car },
    { to: '/sprint', label: 'Sprint Summary', icon: Gauge },
  ],
  mechanic: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/bookings', label: 'My Jobs', icon: CalendarCheck },
    { to: '/profile', label: 'Profile', icon: UserCog },
  ],
};

function Bell_({ light }) {
  const [d, setD] = useState({ items: [], unread: 0 }), [open, setOpen] = useState(false);
  const load = () => api('/notifications').then(setD).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  const toggle = () => { const next = !open; setOpen(next); if (next && d.unread) api('/notifications/read', { method: 'POST' }).then(() => setTimeout(load, 1500)).catch(() => {}); };
  return (
    <div className="relative">
      <button type="button" onClick={toggle} aria-label={`Notifications${d.unread ? `, ${d.unread} unread` : ''}`} aria-expanded={open} className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white">
        <Bell size={20} />{d.unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#061329]" />}
      </button>
      {open && (
        <div className="modal-panel absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-cyan-400/25 bg-[#0B1C35] p-3 text-sm shadow-2xl">
          <p className="mb-2 font-semibold text-white">Notifications</p>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {d.items.length ? d.items.map((n) => <li key={n.id} className={`rounded-lg p-2 ${n.is_read ? 'text-slate-500' : 'bg-cyan-500/10 text-white'}`}>{n.message}<span className="block text-xs text-slate-500">{n.created_at.slice(0, 16)}</span></li>) : <li className="text-slate-500">No notifications yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || 'VF';

function Brand() {
  return (
    <div className="mb-8 flex items-center gap-2.5 text-xl font-semibold text-white">
      <svg width="34" height="22" viewBox="0 0 34 22" fill="none" aria-hidden="true"><path d="M2 14c2-5 6-9 12-9h8c4 0 7 3 10 7v3H2v-1Z" stroke="#00B7FF" strokeWidth="2" strokeLinejoin="round" /><circle cx="10" cy="17" r="2.5" fill="#081B35" stroke="#00B7FF" strokeWidth="2" /><circle cx="25" cy="17" r="2.5" fill="#081B35" stroke="#00B7FF" strokeWidth="2" /></svg>
      VehicleFlow
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate(), loc = useLocation();
  const base = useBase(), ws = useWorkspace();
  const items = MENUS[user.role] || MENUS.customer;

  useEffect(() => { setOpen(false); }, [loc.pathname, loc.hash]);
  useEffect(() => {
    if (loc.hash === '#report') setTimeout(() => document.getElementById('report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }, [loc.pathname, loc.hash]);

  const isActive = (n) => {
    const path = base(n.to);
    const here = n.to === '/' || n.to === '/scrum' ? loc.pathname.replace(/\/$/, '') === path : loc.pathname === path;
    if (!here) return false;
    return true;
  };

  return (
    <div className="min-h-screen lg:flex">
      {open && <div className="modal-backdrop fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={`vf-sidebar fixed inset-y-0 left-0 z-30 flex w-[11.25rem] flex-col p-4 transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? '' : '-translate-x-full'}`} aria-label="Primary">
        <Brand />
        <p className="mb-3 px-1 text-sm text-slate-500">{user.role === 'customer' ? 'Customer Portal' : 'Admin Panel'}</p>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {items.map((n, i) => n.heading ? (
            <p key={'h' + i} className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{n.heading}</p>
          ) : (
            <NavLink key={n.to + (n.hash || '') + n.label} to={base(n.to) + (n.hash || '')} onClick={() => setOpen(false)}
              className={`vf-nav ${isActive(n) ? 'active' : ''}`} aria-current={isActive(n) ? 'page' : undefined}>
              <n.icon size={18} />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-4 text-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-semibold text-white">{initials(user.name)}</div>
            <div className="min-w-0"><p className="truncate font-medium text-white">{user.name}</p><p className="text-xs capitalize text-slate-500">{user.role === 'admin' ? 'Service Manager' : user.role}</p></div>
          </div>
          <button onClick={() => nav('/')} className="mb-2 flex items-center gap-2 text-slate-500 hover:text-white"><Repeat size={16} />Switch workspace</button>
          <button onClick={() => { logout(); nav('/'); }} className="flex items-center gap-2 text-slate-500 hover:text-white"><LogOut size={16} />Log out</button>
        </div>
      </aside>
      <div className="relative min-w-0 flex-1">
        <div className="absolute right-4 top-4 z-10 hidden items-center gap-3 lg:flex md:right-8">
          <Bell_ />
          <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white" aria-hidden="true">{initials(user.name)}</div>
        </div>
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#081B35]/95 p-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} className="text-white">{open ? <X /> : <Menu />}</button>
          <b className="text-white">VehicleFlow</b>
          <div className="ml-auto"><Bell_ /></div>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white" aria-hidden="true">{initials(user.name)}</div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8 lg:pt-16"><div key={loc.pathname} className="page-enter space-y-6"><Outlet /></div></main>
      </div>
    </div>
  );
}
