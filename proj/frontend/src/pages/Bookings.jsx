import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Field, Select, Btn, Badge, Alert, inr } from '../components/ui.jsx';
import AdminBookings from './AdminBookings.jsx';
import { Tracker } from '../components/CustomerServices.jsx';

const STATUS = ['pending', 'confirmed', 'in_progress', 'completed', 'delivered', 'cancelled'];
const EMPTY = { vehicle_id: '', category_id: '', scheduled_date: '', notes: '' };
const small = 'rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm';

function MechanicControls({ b, patch }) {
  const [n, setN] = useState(b.mechanic_notes || '');
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input className={`${small} min-w-[12rem] flex-1`} placeholder="Inspection / repair notes or blockers" value={n} onChange={(e) => setN(e.target.value)} />
      <button className={small} onClick={() => patch(b.id, { mechanic_notes: n })}>Save notes</button>
      {b.status === 'confirmed' && <Btn className="!py-1 text-sm" onClick={() => patch(b.id, { status: 'in_progress' })}>Start repair</Btn>}
      {b.status === 'in_progress' && <Btn className="!py-1 text-sm" onClick={() => patch(b.id, { status: 'completed' })}>Mark completed</Btn>}
    </div>
  );
}

function History({ id }) {
  const [h, setH] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api(`/bookings/${id}/history`).then(setH).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!h) return <p className="text-sm text-slate-400">Loading history…</p>;
  return (
    <ul className="space-y-1 border-l-2 border-cyan-200 pl-3 text-sm">
      {h.map((a) => <li key={a.id}>{a.action} <span className="text-slate-400">· {String(a.created_at).slice(0, 16).replace('T', ' ')}</span></li>)}
      {!h.length && <li className="text-slate-400">No activity yet.</li>}
    </ul>
  );
}

const FILTERS = { all: () => true, active: (b) => ['pending', 'confirmed', 'in_progress', 'completed'].includes(b.status), done: (b) => b.status === 'delivered', cancelled: (b) => b.status === 'cancelled' };

export default function Bookings() {
  const { user } = useAuth();
  return user.role === 'admin' ? <AdminBookings /> : <BookingsInner />;
}

function BookingsInner() {
  const { user } = useAuth(), role = user.role;
  const [rows, setRows] = useState([]), [vehicles, setV] = useState([]), [cats, setC] = useState([]), [mechs, setM] = useState([]);
  const [f, setF] = useState(EMPTY), [msg, setMsg] = useState({}), [flt, setFlt] = useState('all'), [openH, setOpenH] = useState(null);
  const load = () => api('/bookings').then(setRows).catch((e) => setMsg({ m: e.message }));
  useEffect(() => {
    load();
    if (role !== 'mechanic') { api('/vehicles').then(setV); api('/categories').then(setC); }
    if (role === 'admin') api('/mechanics').then(setM);
  }, []);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const patch = async (id, body) => { try { await api('/bookings/' + id, { method: 'PATCH', body }); setMsg({}); load(); } catch (x) { setMsg({ m: x.message }); } };
  const add = async (e) => {
    e.preventDefault();
    if (!f.vehicle_id || !f.category_id) return setMsg({ m: 'Please select a vehicle and a service' });
    if (!f.scheduled_date || f.scheduled_date < new Date().toISOString().slice(0, 10)) return setMsg({ m: 'Choose today or a future date' });
    try { await api('/bookings', { method: 'POST', body: f }); setF(EMPTY); setMsg({ m: 'Booking created', ok: 1 }); load(); }
    catch (x) { setMsg({ m: x.message }); }
  };
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{role === 'mechanic' ? 'My jobs' : 'Bookings'}</h1>
      {role !== 'mechanic' && (
        <Card><span id="report" className="block -mt-20 pt-20" aria-hidden="true" />
          <h3 className="mb-3 font-semibold">Book a service</h3>
          <form onSubmit={add} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select label="Vehicle" required value={f.vehicle_id} onChange={on('vehicle_id')}>
              <option value="">Select vehicle</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} ({v.plate}){role === 'admin' ? ` – ${v.owner}` : ''}</option>)}
            </Select>
            <Select label="Service" required value={f.category_id} onChange={on('category_id')}>
              <option value="">Select service</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name} – {inr(c.base_price)}</option>)}
            </Select>
            <Field label="Preferred date" type="date" required min={new Date().toISOString().slice(0, 10)} value={f.scheduled_date} onChange={on('scheduled_date')} />
            <Field label="Notes" value={f.notes} onChange={on('notes')} />
            <Btn className="sm:col-span-2 lg:col-span-1">Book service</Btn>
          </form>
        </Card>
      )}
      <Alert msg={msg.m} ok={msg.ok} />
      {role === 'customer' && (
        <div className="flex flex-wrap gap-2" role="tablist">
          {[['all', 'All'], ['active', 'Active'], ['done', 'Service history'], ['cancelled', 'Cancelled']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={flt === k} onClick={() => setFlt(k)}
              className={`rounded-full px-3 py-1 text-sm ${flt === k ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
              {l} ({rows.filter(FILTERS[k]).length})</button>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {(role === 'customer' ? rows.filter(FILTERS[flt]) : rows).map((b) => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">#{b.id} · {b.category} <span className="font-normal text-slate-500">for {b.make} {b.model} ({b.plate})</span></p>
                <p className="text-sm text-slate-500">
                  {role !== 'customer' && <>{b.customer} · </>}{b.scheduled_date?.slice(0, 10)} · Estimate {inr(b.estimated_cost)}
                  {b.final_cost != null && <> · Final {inr(b.final_cost)}</>} · Mechanic: {b.mechanic || 'Not assigned'}
                </p>
                {b.notes && <p className="mt-1 text-sm">Customer note: {b.notes}</p>}
                {role !== 'mechanic' && b.mechanic_notes && <p className="mt-1 text-sm text-slate-600">Mechanic note: {b.mechanic_notes}</p>}
              </div>
              <Badge v={b.status} />
            </div>
            {role === 'admin' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <select className={small} value={b.mechanic_id || ''} onChange={(e) => patch(b.id, { mechanic_id: e.target.value })}>
                  <option value="">Assign mechanic</option>{mechs.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.availability})</option>)}
                </select>
                <select className={small} value={b.status} onChange={(e) => patch(b.id, { status: e.target.value })}>
                  {STATUS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            )}
            {role === 'mechanic' && <MechanicControls b={b} patch={patch} />}
            {role === 'customer' && b.status !== 'cancelled' && <div className="mt-4"><Tracker status={b.status} /></div>}
            {role === 'customer' && (
              <div className="mt-3">
                <button className="text-sm text-blue-600 hover:underline" onClick={() => setOpenH(openH === b.id ? null : b.id)}>{openH === b.id ? 'Hide timeline' : 'View timeline'}</button>
                {openH === b.id && <div className="mt-2"><History id={b.id} /></div>}
              </div>
            )}
            {role === 'customer' && b.status === 'pending' && (
              <button className="mt-3 text-sm text-red-600 hover:underline" onClick={() => confirm('Cancel this booking?') && patch(b.id, { status: 'cancelled' })}>Cancel booking</button>
            )}
          </Card>
        ))}
        {!(role === 'customer' ? rows.filter(FILTERS[flt]) : rows).length && <Card><p className="text-slate-400">No bookings here yet.</p></Card>}
      </div>
    </div>
  );
}
