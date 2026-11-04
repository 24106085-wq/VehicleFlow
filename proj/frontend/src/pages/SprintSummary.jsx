import { useEffect, useState } from 'react';
import { ClipboardList, CheckCircle2, RefreshCw, Hourglass, CalendarDays, Target } from 'lucide-react';
import { api } from '../api.js';
import { Card, Skeleton } from '../components/ui.jsx';

const day = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

function Ring({ percent }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-40 w-40 shrink-0 place-items-center" role="img" aria-label={`${percent}% complete`}>
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#10e08a" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} style={{ transition: 'stroke-dashoffset .9s ease' }} />
      </svg>
      <div className="text-center"><p className="text-3xl font-semibold text-white">{percent}%</p><p className="text-xs text-slate-500">Completion</p></div>
    </div>
  );
}

// Sprint Summary: the sprint's name, goal and dates, plus progress calculated from the real vehicle problem records.
export default function SprintSummary() {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    const load = () => api('/service-board/sprint-summary').then((r) => { setD(r); setErr(''); }).catch((e) => setErr(e.message));
    load(); const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);
  if (err && !d) return <p role="alert" className="text-red-600">{err}</p>;
  if (!d) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  const { sprint, stats, percent } = d;
  const tiles = [['Total Tasks', stats.total, ClipboardList, 'text-cyan-400 border-cyan-400/30'], ['Completed', stats.done, CheckCircle2, 'text-emerald-400 border-emerald-400/30 bg-emerald-500/[.08]'], ['In Progress', stats.in_progress, RefreshCw, 'text-violet-300 border-violet-400/30'], ['To Do', stats.todo, Hourglass, 'text-amber-300 border-amber-400/30']];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Sprint Summary</h1><p className="text-sm text-slate-500">Track service sprint progress, based on the real vehicle problem records.</p></div>

      <Card className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div>
          <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-300">{sprint ? (sprint.status === 'active' ? 'Current Sprint' : sprint.status === 'planned' ? 'Upcoming Sprint' : 'Latest Sprint') : 'No sprint'}</span>
          <h2 className="mt-3 text-xl font-semibold">{sprint ? sprint.name : 'No sprint has been created yet'}</h2>
          {sprint && <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500"><CalendarDays size={16} aria-hidden="true" />Start: <b className="text-white">{day(sprint.start_date)}</b> · End: <b className="text-white">{day(sprint.end_date)}</b></p>}
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-violet-400/25 bg-violet-500/10 p-4">
          <Target size={22} className="mt-0.5 shrink-0 text-violet-300" aria-hidden="true" />
          <div><p className="font-semibold">Sprint Goal</p><p className="text-sm text-slate-600">{sprint ? sprint.goal : 'Create a sprint in Sprint Planning to set a goal.'}</p></div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:col-span-1">
          {tiles.map(([k, v, I, tone]) => <div key={k} className={`vf-card flex flex-col items-center gap-1 p-4 text-center ${tone}`}><I size={22} aria-hidden="true" /><p className="text-3xl font-semibold text-white">{v}</p><p className="text-sm text-slate-500">{k}</p></div>)}
        </div>
        <Card className="flex items-center justify-center"><Ring percent={percent} /></Card>
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between text-sm"><b>Sprint Progress</b><span className="text-slate-500">{stats.done} of {stats.total} tasks completed</span></div>
        <div className="h-3 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: percent + '%', transition: 'width .9s ease' }} />
        </div>
      </Card>
    </div>
  );
}
