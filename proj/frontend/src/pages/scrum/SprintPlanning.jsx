import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Card, Field, Select, Btn, Badge, Alert } from '../../components/ui.jsx';

const EMPTY = { name: '', goal: '', start_date: '', end_date: '', capacity: '20' };
const small = 'rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm';

export default function SprintPlanning() {
  const [sprints, setSprints] = useState([]), [sel, setSel] = useState(null), [tasks, setTasks] = useState([]);
  const [backlog, setBacklog] = useState([]), [team, setTeam] = useState([]), [picks, setPicks] = useState([]);
  const [f, setF] = useState(EMPTY), [editId, setEditId] = useState(null), [msg, setMsg] = useState({});

  const loadSprints = () => api('/scrum/sprints').then((rows) => {
    setSprints(rows);
    setSel((cur) => (cur && rows.some((s) => s.id === cur) ? cur : (rows.find((s) => s.status !== 'completed') || rows[0])?.id ?? null));
  });
  const loadTasks = (id) => (id ? api(`/scrum/sprints/${id}/tasks`).then(setTasks) : setTasks([]));
  const loadBacklog = () => api('/scrum/backlog').then((rows) => setBacklog(rows.filter((s) => s.state === 'open')));
  const fail = (e) => setMsg({ m: e.message });
  useEffect(() => { loadSprints().catch(fail); loadBacklog().catch(fail); api('/scrum/team').then(setTeam).catch(fail); }, []);
  useEffect(() => { setPicks([]); loadTasks(sel).catch(fail); }, [sel]);

  const refresh = () => Promise.all([loadSprints(), loadTasks(sel), loadBacklog()]);
  const act = async (fn, ok) => { try { await fn(); setMsg({ m: ok, ok: 1 }); await refresh(); } catch (e) { fail(e); } };

  const sprint = sprints.find((s) => s.id === sel);
  const locked = !sprint || sprint.status === 'completed';
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const planned = tasks.reduce((a, t) => a + t.story_points, 0);
  const picked = backlog.filter((s) => picks.includes(s.id)).reduce((a, s) => a + s.story_points, 0);
  const over = sprint && planned + picked > sprint.capacity;

  const saveSprint = async (e) => {
    e.preventDefault();
    try {
      const d = await api(editId ? `/scrum/sprints/${editId}` : '/scrum/sprints', { method: editId ? 'PUT' : 'POST', body: f });
      setMsg({ m: editId ? 'Sprint updated' : 'Sprint created. Now add user stories to it.', ok: 1 });
      setF(EMPTY); setEditId(null); if (d.id) setSel(d.id); await loadSprints();
    } catch (x) { fail(x); }
  };
  const startEdit = () => { setEditId(sprint.id); setF({ name: sprint.name, goal: sprint.goal, start_date: sprint.start_date.slice(0, 10), end_date: sprint.end_date.slice(0, 10), capacity: String(sprint.capacity) }); setMsg({}); };
  const toggle = (id) => setPicks(picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sprint Planning</h1>
      <Card>
        <h3 className="mb-3 font-semibold">{editId ? 'Edit sprint' : 'Create a sprint'}</h3>
        <form onSubmit={saveSprint} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Sprint name" required maxLength={100} value={f.name} onChange={on('name')} placeholder="Sprint 2" />
          <Field label="Start date" type="date" required value={f.start_date} onChange={on('start_date')} />
          <Field label="End date" type="date" required value={f.end_date} onChange={on('end_date')} />
          <Field label="Capacity (story points)" type="number" min="1" max="999" required value={f.capacity} onChange={on('capacity')} />
          <div className="sm:col-span-2"><Field label="Sprint goal" required maxLength={500} value={f.goal} onChange={on('goal')} /></div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <Btn>{editId ? 'Save sprint' : 'Create sprint'}</Btn>
            {editId && <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2" onClick={() => { setEditId(null); setF(EMPTY); }}>Cancel</button>}
          </div>
        </form>
      </Card>
      <Alert msg={msg.m} ok={msg.ok} />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Select label="Sprint to plan" value={sel || ''} onChange={(e) => setSel(Number(e.target.value) || null)}>
              {!sprints.length && <option value="">No sprints yet</option>}
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
            </Select>
          </div>
          {sprint && sprint.status === 'planned' && <Btn type="button" onClick={() => act(() => api(`/scrum/sprints/${sprint.id}/start`, { method: 'POST' }), 'Sprint started')}>Start sprint</Btn>}
          {sprint && sprint.status === 'active' && <Btn type="button" onClick={() => window.confirm('Complete this sprint? Unfinished stories return to the backlog.') && act(() => api(`/scrum/sprints/${sprint.id}/complete`, { method: 'POST' }), 'Sprint completed. Team members can now add retrospective feedback.')}>Complete sprint</Btn>}
          {sprint && !locked && <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2" onClick={startEdit}>Edit sprint</button>}
        </div>
        {sprint && (
          <div className="text-sm text-slate-600">
            <p className="flex items-center gap-2"><b>{sprint.name}</b> <Badge v={sprint.status} /></p>
            <p>Goal: {sprint.goal}</p>
            <p>{sprint.start_date.slice(0, 10)} to {sprint.end_date.slice(0, 10)} · Planned {planned} of {sprint.capacity} story points</p>
          </div>
        )}
      </Card>

      {sprint && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <h3 className="mb-3 font-semibold">Product Backlog (not in a sprint)</h3>
            {locked ? <p className="text-slate-400">A completed sprint cannot be changed.</p> : (
              <>
                <ul className="space-y-2">
                  {backlog.map((s) => (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                        <input type="checkbox" className="mt-1" checked={picks.includes(s.id)} onChange={() => toggle(s.id)} />
                        <span className="flex-1">{s.title}{s.carried_from && <span className="mt-1 block text-xs text-amber-700">Returned from {s.carried_from} (unfinished)</span>}</span>
                        <Badge v={s.priority} /><span className="whitespace-nowrap text-xs text-slate-500">{s.story_points} pts</span>
                      </label>
                    </li>
                  ))}
                  {!backlog.length && <li className="text-slate-400">No open stories. Add some on the Product Backlog page.</li>}
                </ul>
                {over && <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Selected stories ({picked} pts) would take the sprint to {planned + picked} pts, over its capacity of {sprint.capacity}.</p>}
                <Btn type="button" className="mt-3" disabled={!picks.length} onClick={() => act(async () => { await api(`/scrum/sprints/${sprint.id}/tasks`, { method: 'POST', body: { backlog_ids: picks } }); setPicks([]); }, 'Stories added to the sprint')}>Add {picks.length || ''} selected to sprint</Btn>
              </>
            )}
          </Card>

          <Card>
            <h3 className="mb-3 font-semibold">Sprint tasks</h3>
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex items-start justify-between gap-2"><p className="font-medium">{t.title}</p><span className="whitespace-nowrap text-xs text-slate-500">{t.story_points} pts</span></div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select aria-label="Assign to" className={small} disabled={locked} value={t.assignee_id || ''} onChange={(e) => act(() => api('/scrum/tasks/' + t.id, { method: 'PATCH', body: { assignee_id: e.target.value } }), 'Task assigned')}>
                      <option value="">Unassigned</option>
                      {team.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                    </select>
                    <Badge v={t.status} />
                    {!locked && <button className="text-xs text-red-600 hover:underline" onClick={() => window.confirm('Remove this task from the sprint?') && act(() => api('/scrum/tasks/' + t.id, { method: 'DELETE' }), 'Task removed from the sprint')}>Remove</button>}
                  </div>
                </li>
              ))}
              {!tasks.length && <li className="text-slate-400">No tasks in this sprint yet.</li>}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
