import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api.js';
import { Card, Field, Select, Btn, Badge, Alert, inr } from '../components/ui.jsx';

const STATUS = ['pending', 'confirmed', 'in_progress', 'completed', 'delivered', 'cancelled'];
const PRIO = { high: 0, medium: 1, low: 2 };
const sel = 'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm';
const EMPTY = { vehicle_id: '', category_id: '', scheduled_date: '', notes: '', priority: 'medium' };

function Details({ b, mechs, patch }) {
  const [h, setH] = useState(null);
  const [c, setC] = useState({ estimated_cost: b.estimated_cost ?? '', final_cost: b.final_cost ?? '', mechanic_notes: b.mechanic_notes || '' });
  const [cust, setCust] = useState(null);
  useEffect(() => { api(`/bookings/${b.id}/history`).then(setH).catch(() => setH([])); }, [b.id, b.status, b.mechanic_id, b.priority, b.final_cost, b.estimated_cost, b.mechanic_notes]);
  useEffect(() => { api(`/admin/customers/${b.customer_id}`).then(setCust).catch(() => {}); }, [b.customer_id]);
  const save = () => {
    if ([c.estimated_cost, c.final_cost].some((v) => v !== '' && (isNaN(v) || +v < 0))) return patch(b.id, { estimated_cost: -1 });
    patch(b.id, { estimated_cost: c.estimated_cost, final_cost: c.final_cost, mechanic_notes: c.mechanic_notes });
  };
  return (
    <div className="mt-4 grid gap-4 border-t pt-4 lg:grid-cols-3">
      <div className="space-y-2 text-sm">
        <h4 className="font-semibold">Customer</h4>
        <p>{b.customer}{cust && <><br /><span className="text-slate-500">{cust.email} · {cust.phone || 'No phone'}</span>{cust.address && <><br /><span className="text-slate-500">{cust.address}</span></>}</>}</p>
        <h4 className="pt-2 font-semibold">Booking</h4>
        <p className="text-slate-600">Created {String(b.created_at).slice(0, 16).replace('T', ' ')}<br />Scheduled {b.scheduled_date?.slice(0, 10)}<br />Customer note: {b.notes || '—'}</p>
      </div>
      <div className="space-y-3 text-sm">
        <h4 className="font-semibold">Costs and completion</h4>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Estimated ₹" type="number" min="0" value={c.estimated_cost} onChange={(e) => setC({ ...c, estimated_cost: e.target.value })} />
          <Field label="Final ₹" type="number" min="0" value={c.final_cost} onChange={(e) => setC({ ...c, final_cost: e.target.value })} />
        </div>
        <label className="block"><span className="text-slate-600">Completion / repair notes</span>
          <textarea rows={3} value={c.mechanic_notes} onChange={(e) => setC({ ...c, mechanic_notes: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
        <Btn type="button" className="!py-1.5 text-sm" onClick={save}>Save details</Btn>
      </div>
      <div className="text-sm">
        <h4 className="mb-2 font-semibold">Activity history</h4>
        <ul className="max-h-56 space-y-1 overflow-y-auto border-l-2 border-cyan-200 pl-3">
          {h?.map((a) => <li key={a.id}>{a.action} <span className="text-slate-400">· {a.actor || 'System'} · {String(a.created_at).slice(0, 16).replace('T', ' ')}</span></li>)}
          {h && !h.length && <li className="text-slate-400">No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}

export default function AdminBookings() {
  const [rows, setRows] = useState([]), [vehicles, setV] = useState([]), [cats, setC] = useState([]), [mechs, setM] = useState([]);
  const [msg, setMsg] = useState({}), [open, setOpen] = useState(null), [f, setF] = useState(EMPTY), [showNew, setShowNew] = useState(false);
  const [fl, setFl] = useState({ s: '', status: '', prio: '', mech: '', sort: 'newest' });
  const load = () => api('/bookings').then(setRows).catch((e) => setMsg({ m: e.message }));
  useEffect(() => { load(); api('/vehicles').then(setV); api('/categories').then(setC); api('/mechanics').then(setM); }, []);
  const patch = async (id, body) => {
    if (body.estimated_cost === -1) return setMsg({ m: 'Costs must be numbers, 0 or more' });
    try { await api('/bookings/' + id, { method: 'PATCH', body }); setMsg({ m: 'Saved', ok: 1 }); load(); } catch (x) { setMsg({ m: x.message }); }
  };
  const add = async (e) => {
    e.preventDefault();
    if (!f.vehicle_id || !f.category_id || !f.scheduled_date) return setMsg({ m: 'Vehicle, service and date are required' });
    try { await api('/bookings', { method: 'POST', body: f }); setF(EMPTY); setShowNew(false); setMsg({ m: 'Booking created', ok: 1 }); load(); } catch (x) { setMsg({ m: x.message }); }
  };
  const shown = useMemo(() => {
    const t = fl.s.trim().toLowerCase();
    const out = rows.filter((b) => (!t || `${b.id} ${b.plate} ${b.make} ${b.model} ${b.customer} ${b.category} ${b.mechanic || ''}`.toLowerCase().includes(t))
      && (!fl.status || b.status === fl.status) && (!fl.prio || b.priority === fl.prio)
      && (!fl.mech || (fl.mech === 'none' ? !b.mechanic_id : String(b.mechanic_id) === fl.mech)));
    const by = { newest: (a, b) => b.id - a.id, oldest: (a, b) => a.id - b.id, date: (a, b) => String(a.scheduled_date).localeCompare(b.scheduled_date),
      priority: (a, b) => PRIO[a.priority] - PRIO[b.priority], cost: (a, b) => (b.final_cost ?? b.estimated_cost) - (a.final_cost ?? a.estimated_cost) };
    return out.sort(by[fl.sort]);
  }, [rows, fl]);
  const set = (k) => (e) => setFl({ ...fl, [k]: e.target.value });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <Btn type="button" onClick={() => setShowNew(!showNew)}>{showNew ? 'Close' : 'New booking'}</Btn>
      </div>
      {showNew && (
        <Card>
          <form onSubmit={add} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Vehicle" value={f.vehicle_id} onChange={(e) => setF({ ...f, vehicle_id: e.target.value })}>
              <option value="">Select vehicle</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} ({v.plate}) – {v.owner}</option>)}</Select>
            <Select label="Service" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
              <option value="">Select service</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name} – {inr(c.base_price)}</option>)}</Select>
            <Field label="Date" type="date" min={new Date().toISOString().slice(0, 10)} value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} />
            <Select label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select>
            <Field label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            <div className="flex items-end"><Btn>Create booking</Btn></div>
          </form>
        </Card>
      )}
      <Card className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={fl.s} onChange={set('s')} placeholder="Search #, plate, customer, service, mechanic" aria-label="Search bookings" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" /></label>
        <select aria-label="Status filter" className={sel} value={fl.status} onChange={set('status')}><option value="">All statuses</option>{STATUS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
        <select aria-label="Priority filter" className={sel} value={fl.prio} onChange={set('prio')}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <select aria-label="Mechanic filter" className={sel} value={fl.mech} onChange={set('mech')}><option value="">All mechanics</option><option value="none">Unassigned</option>{mechs.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <select aria-label="Sort" className={sel} value={fl.sort} onChange={set('sort')}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="date">Scheduled date</option><option value="priority">Priority</option><option value="cost">Cost (high→low)</option></select>
      </Card>
      <Alert msg={msg.m} ok={msg.ok} />
      <p className="text-sm text-slate-500">{shown.length} of {rows.length} bookings</p>
      <div className="space-y-3">
        {shown.map((b) => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">#{b.id} · {b.category} <span className="font-normal text-slate-500">for {b.make} {b.model} ({b.plate})</span></p>
                <p className="text-sm text-slate-500">{b.customer} · {b.scheduled_date?.slice(0, 10)} · Est. {inr(b.estimated_cost)}{b.final_cost != null && <> · Final {inr(b.final_cost)}</>} · Mechanic: {b.mechanic || 'Not assigned'}</p>
              </div>
              <div className="flex gap-2"><Badge v={b.priority} /><Badge v={b.status} /></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select aria-label="Assign mechanic" className={sel} value={b.mechanic_id || ''} onChange={(e) => patch(b.id, { mechanic_id: e.target.value })}>
                <option value="">Assign mechanic</option>{mechs.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.availability})</option>)}</select>
              <select aria-label="Status" className={sel} value={b.status} onChange={(e) => patch(b.id, { status: e.target.value })}>{STATUS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
              <select aria-label="Priority" className={sel} value={b.priority} onChange={(e) => patch(b.id, { priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
              <button className="text-sm text-blue-600 hover:underline" onClick={() => setOpen(open === b.id ? null : b.id)}>{open === b.id ? 'Hide details' : 'Details & history'}</button>
            </div>
            {open === b.id && <Details b={b} mechs={mechs} patch={patch} />}
          </Card>
        ))}
        {!shown.length && <Card><p className="text-slate-400">No bookings match your filters.</p></Card>}
      </div>
    </div>
  );
}
