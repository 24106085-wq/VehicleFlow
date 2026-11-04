import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, ClipboardList, RefreshCw, CheckCircle2, ArrowRight, PlusCircle, ListChecks } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useBase } from '../workspace.jsx';
import { CountUp, Skeleton } from './ui.jsx';
import carImg from '../assets/blue-car.svg';

const TILE = {
  cyan: 'border-cyan-400/40 from-cyan-500/15 to-blue-900/20 text-cyan-300',
  purple: 'border-violet-400/40 from-violet-500/20 to-indigo-900/20 text-violet-300',
  blue: 'border-sky-400/40 from-sky-500/20 to-blue-900/20 text-sky-300',
  green: 'border-emerald-400/40 from-emerald-500/20 to-emerald-900/20 text-emerald-300',
};

function StatTile({ label, value, icon: Icon, tone }) {
  return (
    <div className={`vf-card flex flex-col items-center gap-1 bg-gradient-to-b p-4 text-center backdrop-blur ${TILE[tone]}`}>
      <Icon size={26} aria-hidden="true" />
      <p className="mt-1 text-3xl font-semibold text-white"><CountUp value={value} /></p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function Action({ to, icon: Icon, title, hint, tone }) {
  return (
    <Link to={to} className={`vf-card group flex items-center justify-between gap-3 bg-gradient-to-br p-5 backdrop-blur ${TILE[tone]}`}>
      <div className="flex items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5"><Icon size={24} aria-hidden="true" /></span>
        <span><span className="block font-medium text-white">{title}</span><span className="block text-xs text-slate-500">{hint}</span></span>
      </div>
      <ArrowRight size={20} className="shrink-0 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth(), base = useBase();
  const [vehicles, setVehicles] = useState(null), [bookings, setBookings] = useState(null), [err, setErr] = useState('');

  // The API only returns the signed-in customer's own records.
  useEffect(() => {
    let live = true;
    const load = () => Promise.all([api('/vehicles'), api('/bookings')])
      .then(([v, b]) => { if (live) { setVehicles(v); setBookings(b); setErr(''); } })
      .catch((e) => { if (live) setErr(e.message); });
    load();
    const t = setInterval(load, 20000); // pick up status changes made by staff
    return () => { live = false; clearInterval(t); };
  }, []);

  const ready = vehicles && bookings;
  const reported = bookings?.length ?? 0;
  const inProgress = bookings?.filter((b) => b.status === 'in_progress').length ?? 0;
  const completed = bookings?.filter((b) => ['completed', 'delivered'].includes(b.status)).length ?? 0;
  const active = bookings?.filter((b) => !['cancelled', 'delivered', 'completed'].includes(b.status)).length ?? 0;
  const first = (user.name || '').split(' ')[0];

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Customer Dashboard</h1>
        <p className="text-sm text-slate-500">Manage vehicles and track service requests</p>
      </div>

      <section className="vf-card relative overflow-hidden bg-gradient-to-r from-[#0b3a8c] via-[#0a2a63] to-[#081B35] p-6 sm:p-8" aria-label="Welcome">
        <div className="relative z-10 max-w-md">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Welcome back, {first}! <span aria-hidden="true">👋</span></h2>
          <p className="mt-2 text-sm text-slate-300">Manage vehicles and track service requests — report issues and follow every repair in one place.</p>
        </div>
        <img src={carImg} alt="" width="460" height="187" className="pointer-events-none absolute -bottom-3 -right-6 hidden w-[46%] max-w-[460px] select-none drop-shadow-[0_10px_30px_rgba(0,183,255,.35)] sm:block" />
      </section>

      {err && !ready && (
        <p role="alert" className="rounded-xl border border-red-400/30 bg-red-100 px-3 py-2 text-sm text-red-700">{err}</p>
      )}

      {ready ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="My Vehicles" value={vehicles.length} icon={Car} tone="cyan" />
          <StatTile label="Reported Problems" value={reported} icon={ClipboardList} tone="purple" />
          <StatTile label="In Progress" value={inProgress} icon={RefreshCw} tone="blue" />
          <StatTile label="Completed" value={completed} icon={CheckCircle2} tone="green" />
        </div>
      ) : !err && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-label="Loading statistics">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      )}

      <section aria-label="Quick actions">
        <h2 className="mb-3 text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Action to={base('/vehicles')} icon={Car} tone="blue" title="Add Vehicle"
            hint={!ready ? ' ' : vehicles.length ? `${vehicles.length} registered` : 'No vehicles yet. Add your first one'} />
          <Action to={base('/report')} icon={PlusCircle} tone="purple" title="Report a Problem"
            hint={!ready ? ' ' : vehicles.length ? 'Tell us what is wrong' : 'Add a vehicle first to report a problem'} />
          <Action to={base('/problems')} icon={ListChecks} tone="green" title="Track Status"
            hint={!ready ? ' ' : reported ? `${active} active · ${reported} total` : 'No problems reported yet'} />
        </div>
      </section>
    </>
  );
}
