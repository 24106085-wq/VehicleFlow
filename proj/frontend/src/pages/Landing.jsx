import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Wrench, Car, CalendarCheck, Activity, KanbanSquare, LayoutDashboard, Target, ArrowRight, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { WORKSPACES } from '../workspace.jsx';
import { Field, Btn, Alert } from '../components/ui.jsx';

const CARDS = [
  { ws: WORKSPACES.customer, icon: Car, title: 'Customer Portal', text: 'Everything a vehicle owner needs in one place.',
    points: [[Car, 'Vehicle management'], [CalendarCheck, 'Service booking'], [Activity, 'Live service tracking']] },
  { ws: WORKSPACES.admin, icon: Target, title: 'Admin & Agile Workspace', text: 'Run the workshop and the development team.',
    points: [[KanbanSquare, 'Service management & Kanban'], [LayoutDashboard, 'Admin dashboard'], [Target, 'Scrum tools & burndown']] },
];

// Secure access panel: uses the normal backend login (JWT + bcrypt). Opens only after a workspace is chosen.
function AccessPanel({ ws, onClose }) {
  const { login, register, logout } = useAuth();
  const nav = useNavigate();
  const isCustomer = ws.key === 'customer';
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      let u;
      if (mode === 'register') {
        if (f.password !== f.confirm) throw new Error('Passwords do not match');
        u = await register({ name: f.name, email: f.email, phone: f.phone, password: f.password });
      } else u = await login(f.email, f.password);
      if (!ws.roles.includes(u.role)) { logout(); throw new Error(`This account cannot open the ${ws.label}`); }
      nav(ws.base);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center bg-navy-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${ws.label} access`}>
      <form onSubmit={submit} className="modal-panel relative w-full max-w-md space-y-4 rounded-2xl border border-cyan-400/25 bg-[#0a2042] p-7 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"><X size={20} /></button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">Secure access</p>
          <h2 className="text-xl font-bold text-navy-900">{ws.label}</h2>
          <p className="text-sm text-slate-500">{mode === 'register' ? 'Create your customer account.' : 'Verify your identity to continue.'}</p>
        </div>
        <Alert msg={err} />
        {mode === 'register' && <>
          <Field label="Full name" required minLength={2} value={f.name} onChange={on('name')} />
          <Field label="Phone (optional)" value={f.phone} onChange={on('phone')} />
        </>}
        <Field label="Email" type="email" required value={f.email} onChange={on('email')} />
        <Field label="Password" type="password" required minLength={mode === 'register' ? 8 : undefined} value={f.password} onChange={on('password')} />
        {mode === 'register' && <Field label="Confirm password" type="password" required value={f.confirm} onChange={on('confirm')} />}
        <Btn disabled={busy} className="w-full">{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Continue'}</Btn>
        {isCustomer && (
          <p className="text-center text-sm">
            {mode === 'login' ? 'New customer? ' : 'Already registered? '}
            <button type="button" className="text-blue-600 hover:underline" onClick={() => { setErr(''); setMode(mode === 'login' ? 'register' : 'login'); }}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        )}
      </form>
    </div>
  );
}

export default function Landing() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [panel, setPanel] = useState(null);
  const denied = params.get('denied');
  useEffect(() => {
    const w = params.get('open');
    if (w && WORKSPACES[w] && !loading) { setPanel(WORKSPACES[w]); setParams({}, { replace: true }); }
  }, [params, loading]);
  // Existing valid session for the right role enters directly; anything else needs secure access.
  const choose = (ws) => (user && ws.roles.includes(user.role) ? nav(ws.base) : setPanel(ws));
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 px-4 py-10 text-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center">
        <div className="flex items-center gap-2 text-3xl font-bold"><Wrench className="text-cyan-400" size={32} />VehicleFlow</div>
        <p className="mt-3 max-w-xl text-center text-slate-300">Vehicle service management and agile delivery, in one platform. Choose your workspace to get started.</p>
        {denied && <p className="mt-6 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm text-amber-200"><ShieldAlert size={16} />Your account does not have access to that workspace.</p>}
        <div className="mt-10 grid w-full gap-6 md:grid-cols-2">
          {CARDS.map(({ ws, icon: Icon, title, text, points }) => (
            <button key={ws.key} onClick={() => choose(ws)} className="group rounded-3xl border border-white/15 bg-white/10 p-8 text-left shadow-xl backdrop-blur-md transition hover:-translate-y-1 hover:border-cyan-400/60 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-cyan-400">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-500/20 text-cyan-300"><Icon size={28} /></span>
              <h2 className="mt-5 text-2xl font-semibold">{title}</h2>
              <p className="mt-1 text-slate-300">{text}</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-200">
                {points.map(([I, t]) => <li key={t} className="flex items-center gap-2"><I size={16} className="text-cyan-300" />{t}</li>)}
              </ul>
              <span className="mt-6 inline-flex items-center gap-2 font-medium text-cyan-300">Open workspace <ArrowRight size={18} className="transition group-hover:translate-x-1" /></span>
            </button>
          ))}
        </div>
        {user && <p className="mt-8 text-sm text-slate-400">Signed in as {user.name}. Choose a workspace to continue.</p>}
      </div>
      {panel && <AccessPanel ws={panel} onClose={() => setPanel(null)} />}
    </div>
  );
}
