import { useEffect, useState } from 'react';
import { Car, Clock, CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Stat, DashboardSkeleton } from '../components/ui.jsx';
import AdminKanban from '../components/AdminKanban.jsx';
import MechanicJobs from '../components/MechanicJobs.jsx';
import CustomerDashboard from '../components/CustomerDashboard.jsx';

const Mechanic = ({ d, reload }) => (
  <>
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Assigned vehicles" value={d.stats.vehicles} icon={Car} />
      <Stat label="Pending jobs" value={d.stats.pending} icon={Clock} tone="amber" />
      <Stat label="Completed repairs" value={d.stats.completed} icon={CheckCircle2} tone="green" />
    </div>
    <MechanicJobs onChange={reload} />
  </>
);

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === 'customer') return <CustomerDashboard />;
  if (user.role === 'admin') return <AdminKanban />; // statistics + service Kanban board, all from /api/service-board
  return <StaffDashboard user={user} />;
}

function StaffDashboard({ user }) {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const load = () => api('/dashboard').then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (err) return <p className="text-red-600">{err}</p>;
  if (!d) return <DashboardSkeleton />;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Welcome back, {user.name.split(' ')[0]}</h1>
      <Mechanic d={d} reload={load} />
    </div>
  );
}
