import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, CheckCircle2, Clock, Wrench, AlertTriangle, Target } from 'lucide-react';
import { api } from '../../api.js';
import { Card, Stat, DashboardSkeleton } from '../../components/ui.jsx';
import { useBase } from '../../workspace.jsx';
import BurndownChart from '../../components/BurndownChart.jsx';

function History({ rows }) {
  return (
    <Card>
      <h3 className="mb-3 font-semibold">Completed sprint history</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500"><tr><th className="py-2">Sprint</th><th>Dates</th><th>Tasks done</th><th>Story points done</th></tr></thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id} className="border-t">
                <td className="py-2 font-medium">{h.name}</td><td>{h.start_date.slice(0, 10)} to {h.end_date.slice(0, 10)}</td>
                <td>{h.done} / {h.tasks}</td><td>{h.donePoints} / {h.points}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="4" className="py-4 text-slate-400">No sprint has been completed yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function ScrumDashboard() {
  const base = useBase();
  const [d, setD] = useState(null), [burn, setBurn] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    api('/scrum/dashboard').then((x) => {
      setD(x);
      if (x.sprint) api(`/scrum/sprints/${x.sprint.id}/burndown`).then(setBurn).catch((e) => setErr(e.message));
    }).catch((e) => setErr(e.message));
  }, []);
  if (err) return <p className="text-red-600">{err}</p>;
  if (!d) return <DashboardSkeleton />;
  if (!d.sprint) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Scrum Dashboard</h1>
      <Card><p className="text-slate-600">There is no active sprint. <Link to={base('/scrum/planning')} className="text-blue-600 hover:underline">Open Sprint Planning</Link> to create and start one.</p></Card>
      <History rows={d.history || []} />
    </div>
  );
  const { sprint: s, stats: t } = d;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scrum Dashboard</h1>
      <Card className="space-y-1">
        <p className="text-sm text-slate-500">Active sprint</p>
        <h2 className="text-xl font-semibold">{s.name}</h2>
        <p className="text-slate-700"><b>Goal:</b> {s.goal}</p>
        <p className="text-sm text-slate-500">{s.start_date.slice(0, 10)} to {s.end_date.slice(0, 10)} · Capacity {s.capacity} story points · {t.points} planned</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Total sprint tasks" value={t.total} icon={ListChecks} />
        <Stat label="Completed tasks" value={t.done} icon={CheckCircle2} tone="green" />
        <Stat label="Pending (To Do)" value={t.pending} icon={Clock} tone="amber" />
        <Stat label="In progress (incl. Testing)" value={t.inProgress} icon={Wrench} tone="cyan" />
        <Stat label="Blocked tasks" value={t.blocked} icon={AlertTriangle} tone="amber" />
        <Stat label="Completion (story points)" value={`${t.percent}%`} icon={Target} tone="green" />
      </div>
      <Card>
        <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${t.percent}%` }} /></div>
        <p className="text-sm text-slate-600">{t.donePoints} of {t.points} story points done</p>
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">Sprint burndown</h3>
        {burn ? <BurndownChart data={burn} /> : <p className="text-slate-500">Loading chart…</p>}
      </Card>
      <History rows={d.history || []} />
    </div>
  );
}
