import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Badge, Btn, Alert } from './ui.jsx';

// Active jobs first, finished jobs last.
const ORDER = { in_progress: 0, confirmed: 1, pending: 1, completed: 2, delivered: 3 };

function JobCard({ b, update }) {
  const [n, setN] = useState(b.mechanic_notes || '');
  const open = ['pending', 'confirmed', 'in_progress'].includes(b.status);
  const complete = () => window.confirm(`Mark service #${b.id} as completed?`) && update(b.id, { status: 'completed', mechanic_notes: n }, 'Repair marked as completed');
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">Service #{b.id} · {b.category}</p>
          <p className="text-sm text-slate-600">{b.plate} · {b.make} {b.model}</p>
          <p className="text-sm text-slate-500">Customer: {b.customer}</p>
        </div>
        <div className="flex items-center gap-2"><Badge v={b.priority} /><Badge v={b.status} /></div>
      </div>
      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm" maxLength={300}
            placeholder="Short repair notes or blockers" aria-label={`Repair notes for service ${b.id}`} value={n} onChange={(e) => setN(e.target.value)} />
          <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm" onClick={() => update(b.id, { mechanic_notes: n }, 'Notes saved')}>Save notes</button>
          {b.status !== 'in_progress' && <Btn className="!py-1 text-sm" onClick={() => update(b.id, { status: 'in_progress', mechanic_notes: n }, 'Repair started')}>Start repair</Btn>}
          {b.status === 'in_progress' && <Btn className="!py-1 text-sm" onClick={complete}>Mark completed</Btn>}
        </div>
      ) : (
        b.mechanic_notes && <p className="mt-3 text-sm text-slate-600">Notes: {b.mechanic_notes}</p>
      )}
    </Card>
  );
}

export default function MechanicJobs({ onChange }) {
  const [jobs, setJobs] = useState(null), [msg, setMsg] = useState({});
  // /bookings already returns only the jobs assigned to the logged-in mechanic.
  const load = () => api('/bookings').then((rows) => setJobs(rows.filter((b) => b.status !== 'cancelled').sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.id - b.id)))
    .catch((e) => { setJobs([]); setMsg({ m: e.message }); });
  useEffect(() => { load(); }, []);

  const update = async (id, body, ok) => {
    try { await api('/bookings/' + id, { method: 'PATCH', body }); setMsg({ m: ok, ok: 1 }); await load(); onChange?.(); }
    catch (e) { setMsg({ m: e.message }); }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">Assigned service requests</h2>
      <Alert msg={msg.m} ok={msg.ok} />
      {jobs === null && <p className="text-slate-500">Loading…</p>}
      {jobs?.map((b) => <JobCard key={b.id} b={b} update={update} />)}
      {jobs?.length === 0 && <Card><p className="text-slate-400">No jobs are assigned to you yet.</p></Card>}
    </div>
  );
}
