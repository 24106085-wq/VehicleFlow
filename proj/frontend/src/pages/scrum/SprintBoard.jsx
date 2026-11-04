import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, Select, Alert } from '../../components/ui.jsx';

// Development-task board (separate from the vehicle-service Kanban board on the Dashboard).
const COLS = [['todo', 'To Do'], ['in_progress', 'In Progress'], ['review', 'Testing'], ['done', 'Done']];
const small = 'rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm';

function TaskCard({ t, active, update }) {
  const [c, setC] = useState(t.comment || '');
  return (
    <div className={`space-y-2 rounded-xl border bg-white p-3 text-sm shadow-sm ${t.blocked ? 'border-red-300' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{t.title}</p>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{t.story_points} pts</span>
      </div>
      <p className="text-xs text-slate-500">{t.assignee || 'Unassigned'}</p>
      <select aria-label="Task status" className={`${small} w-full`} disabled={!active} value={t.status} onChange={(e) => update(t.id, { status: e.target.value }, 'Task moved')}>
        {COLS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={!!t.blocked} disabled={!active || t.status === 'done'} onChange={(e) => update(t.id, { blocked: e.target.checked }, e.target.checked ? 'Task marked as blocked' : 'Task unblocked')} />
        Blocked
      </label>
      <div className="flex gap-1">
        <input className={`${small} min-w-0 flex-1`} maxLength={300} placeholder="Short comment" aria-label="Task comment" value={c} onChange={(e) => setC(e.target.value)} />
        <button className={small} onClick={() => update(t.id, { comment: c }, 'Comment saved')}>Save</button>
      </div>
    </div>
  );
}

export default function SprintBoard() {
  const { user } = useAuth();
  const [sprints, setSprints] = useState([]), [sel, setSel] = useState(null), [tasks, setTasks] = useState([]), [msg, setMsg] = useState({});
  useEffect(() => {
    api('/scrum/sprints').then((rows) => { setSprints(rows); setSel((rows.find((s) => s.status === 'active') || rows[0])?.id ?? null); }).catch((e) => setMsg({ m: e.message }));
  }, []);
  const load = () => (sel ? api(`/scrum/sprints/${sel}/tasks`).then(setTasks).catch((e) => setMsg({ m: e.message })) : setTasks([]));
  useEffect(() => { load(); }, [sel]);

  const sprint = sprints.find((s) => s.id === sel), active = sprint?.status === 'active';
  const update = async (id, body, ok) => {
    try { await api('/scrum/tasks/' + id, { method: 'PATCH', body }); setMsg({ m: ok, ok: 1 }); await load(); }
    catch (e) { setMsg({ m: e.message }); await load(); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sprint Board</h1>
      <div className="max-w-sm"><Select label="Sprint" value={sel || ''} onChange={(e) => setSel(Number(e.target.value) || null)}>
        {!sprints.length && <option value="">No sprints yet</option>}
        {sprints.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
      </Select></div>
      {sprint && <p className="text-sm text-slate-600"><b>Goal:</b> {sprint.goal}</p>}
      {sprint && !active && <p className="text-sm text-amber-700">Tasks can only be moved while the sprint is active.</p>}
      {user.role === 'mechanic' && <p className="text-sm text-slate-500">Showing only the tasks assigned to you.</p>}
      <Alert msg={msg.m} ok={msg.ok} />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLS.map(([key, title]) => {
          const list = tasks.filter((t) => t.status === key);
          return (
            <section key={key} aria-label={title} className="min-w-[15rem] flex-1 rounded-2xl bg-slate-200/60 p-3">
              <h3 className="mb-3 font-semibold">{title} <span className="font-normal text-slate-500">({list.length})</span></h3>
              <div className="min-h-[6rem] space-y-2">{list.map((t) => <TaskCard key={t.id} t={t} active={active} update={update} />)}</div>
            </section>
          );
        })}
      </div>
      {sprint && !tasks.length && <Card><p className="text-slate-400">No tasks to show for this sprint.</p></Card>}
    </div>
  );
}
