import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Card, Field, Select, Btn, Badge, Alert } from '../../components/ui.jsx';

const EMPTY = { title: '', description: '', acceptance_criteria: '', priority: 'medium', story_points: '3' };
const area = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100';

export default function ProductBacklog() {
  const [rows, setRows] = useState([]), [f, setF] = useState(EMPTY), [editId, setEditId] = useState(null), [msg, setMsg] = useState({});
  const load = () => api('/scrum/backlog').then(setRows).catch((e) => setMsg({ m: e.message }));
  useEffect(() => { load(); }, []);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    try {
      await api(editId ? `/scrum/backlog/${editId}` : '/scrum/backlog', { method: editId ? 'PUT' : 'POST', body: f });
      setMsg({ m: editId ? 'User story updated' : 'User story added', ok: 1 }); setF(EMPTY); setEditId(null); load();
    } catch (x) { setMsg({ m: x.message }); }
  };
  const edit = (s) => {
    setEditId(s.id); setMsg({});
    setF({ title: s.title, description: s.description || '', acceptance_criteria: s.acceptance_criteria || '', priority: s.priority, story_points: String(s.story_points) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const del = async (s) => {
    if (!window.confirm(`Delete "${s.title}"?`)) return;
    try { await api('/scrum/backlog/' + s.id, { method: 'DELETE' }); setMsg({ m: 'User story deleted', ok: 1 }); if (editId === s.id) { setEditId(null); setF(EMPTY); } load(); }
    catch (x) { setMsg({ m: x.message }); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Product Backlog</h1>
      <Card>
        <h3 className="mb-3 font-semibold">{editId ? `Edit user story #${editId}` : 'Add a user story'}</h3>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Title (As a …, I want … so that …)" required maxLength={150} value={f.title} onChange={on('title')} placeholder="As a customer, I want to track my vehicle repair status so that I know when it will be ready" /></div>
          <Select label="Priority" value={f.priority} onChange={on('priority')}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </Select>
          <Select label="Story points" value={f.story_points} onChange={on('story_points')}>
            {[1, 2, 3, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
          <label className="block text-sm"><span className="text-slate-600">Description</span>
            <textarea rows={3} maxLength={2000} className={area} value={f.description} onChange={on('description')} /></label>
          <label className="block text-sm"><span className="text-slate-600">Acceptance criteria</span>
            <textarea rows={3} maxLength={2000} className={area} value={f.acceptance_criteria} onChange={on('acceptance_criteria')} /></label>
          <div className="flex gap-2 sm:col-span-2">
            <Btn>{editId ? 'Save changes' : 'Add story'}</Btn>
            {editId && <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2" onClick={() => { setEditId(null); setF(EMPTY); }}>Cancel</button>}
          </div>
        </form>
        <div className="mt-3"><Alert msg={msg.m} ok={msg.ok} /></div>
      </Card>

      <div className="space-y-3">
        <p className="text-sm text-slate-500">Highest priority first. "open" means the story is not in a sprint yet.</p>
        {rows.map((s) => (
          <Card key={s.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold">#{s.id} · {s.title}</p>
              <div className="flex items-center gap-2"><Badge v={s.priority} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{s.story_points} pts</span><Badge v={s.state} /></div>
            </div>
            {s.state === 'open' && s.carried_from && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">Returned from {s.carried_from}: not finished, available for a future sprint.</p>}
            {s.description && <p className="mt-2 text-sm text-slate-600">{s.description}</p>}
            {s.acceptance_criteria && <p className="mt-1 text-sm"><b>Acceptance criteria:</b> {s.acceptance_criteria}</p>}
            <div className="mt-3 flex gap-4 text-sm">
              <button className="text-blue-600 hover:underline" onClick={() => edit(s)}>Edit</button>
              <button className="text-red-600 hover:underline" onClick={() => del(s)}>Delete</button>
            </div>
          </Card>
        ))}
        {!rows.length && <Card><p className="text-slate-400">No user stories yet. Add the first one above.</p></Card>}
      </div>
    </div>
  );
}
