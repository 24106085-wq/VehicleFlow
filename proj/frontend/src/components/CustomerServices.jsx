import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, CalendarCheck, Wrench, CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { Card, Stat, Field, Select, Btn, Alert, inr } from './ui.jsx';
import { useBase } from '../workspace.jsx';

// Same five stages as the admin Kanban board. Each stage is one booking status.
export const STEPS = ['Booking', 'Inspection', 'Repairing', 'Quality Check', 'Delivered'];
export const STEP_OF = { pending: 0, confirmed: 1, in_progress: 2, completed: 3, delivered: 4 };
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { vehicle_id: '', category_id: '', scheduled_date: today(), notes: '' };
const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Estimated completion = preferred date + the service's estimated hours (8 working hours per day).
function estimatedDate(b, cats) {
  const hours = cats.find((c) => c.id === b.category_id)?.est_hours || 0;
  const d = new Date(b.scheduled_date.slice(0, 10) + 'T00:00:00');
  d.setDate(d.getDate() + Math.max(0, Math.ceil(hours / 8) - 1));
  return fmt(d);
}

export function Tracker({ status }) {
  const cur = STEP_OF[status], finished = cur === 4;
  return (
    <ol className="flex items-start" aria-label="Service progress">
      {STEPS.map((s, i) => {
        const done = i < cur || finished, current = i === cur && !finished;
        return (
          <li key={s} className="relative flex-1 text-center" aria-current={current ? 'step' : undefined}>
            {i > 0 && <span className={`absolute left-[-50%] top-3 h-0.5 w-full ${i <= cur ? 'bg-cyan-500' : 'bg-slate-200'}`} />}
            <span className={`relative z-10 mx-auto grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${done ? 'bg-cyan-500 text-white' : current ? 'bg-blue-600 text-white ring-4 ring-cyan-100' : 'bg-slate-200 text-slate-500'}`}>
              {done ? '✓' : i + 1}
            </span>
            <p className={`mt-1 text-[11px] sm:text-xs ${current ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{s}</p>
          </li>
        );
      })}
    </ol>
  );
}

export default function CustomerServices() {
  const base = useBase();
  const [vehicles, setVehicles] = useState(null), [cats, setCats] = useState([]), [bookings, setBookings] = useState([]);
  const [f, setF] = useState(EMPTY), [msg, setMsg] = useState({});

  // /vehicles and /bookings already return only the logged-in customer's own records.
  const loadBookings = () => api('/bookings').then(setBookings);
  useEffect(() => {
    api('/vehicles').then(setVehicles).catch((e) => { setVehicles([]); setMsg({ m: e.message }); });
    api('/categories').then(setCats).catch(() => {});
    loadBookings().catch((e) => setMsg({ m: e.message }));
    // Re-check every 20 seconds so status changes made by the mechanic or admin show up without a reload.
    const t = setInterval(() => loadBookings().catch(() => {}), 20000);
    return () => clearInterval(t);
  }, []);

  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const chosen = vehicles?.find((v) => String(v.id) === String(f.vehicle_id));
  const add = async (e) => {
    e.preventDefault();
    if (!f.vehicle_id || !f.category_id) return setMsg({ m: 'Please select a vehicle and a service' });
    if (!f.scheduled_date || f.scheduled_date < today()) return setMsg({ m: 'Choose today or a future date' });
    try {
      await api('/bookings', { method: 'POST', body: f });
      setF(EMPTY); setMsg({ m: 'Booking created. You can follow its progress below.', ok: 1 }); loadBookings();
    } catch (x) { setMsg({ m: x.message }); }
  };

  const cancel = async (id) => {
    if (!confirm('Cancel this booking?')) return;
    try { await api('/bookings/' + id, { method: 'PATCH', body: { status: 'cancelled' } }); setMsg({ m: 'Booking cancelled', ok: 1 }); loadBookings(); }
    catch (x) { setMsg({ m: x.message }); }
  };

  const live = bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'delivered');
  const past = bookings.filter((b) => b.status === 'delivered');

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="My vehicles" value={vehicles?.length ?? '…'} icon={Car} />
        <Stat label="Total bookings" value={bookings.length} icon={CalendarCheck} tone="cyan" />
        <Stat label="Active services" value={live.length} icon={Wrench} tone="amber" />
        <Stat label="Completed services" value={bookings.filter((b) => ['completed', 'delivered'].includes(b.status)).length} icon={CheckCircle2} tone="green" />
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">My vehicles</h3>
          <Link to={base('/vehicles')} className="text-sm text-blue-600 hover:underline">Manage vehicles</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles?.map((v) => (
            <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-semibold">{v.plate}</p>
              <p>{v.make} {v.model} · {v.year}</p>
              <p className="text-slate-500">{v.color || 'Colour not set'} · {Number(v.mileage).toLocaleString('en-IN')} km</p>
            </div>
          ))}
          {vehicles?.length === 0 && <p className="text-slate-400">No vehicles yet. Add one on the Vehicles page to book a service.</p>}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Book a service</h3>
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Vehicle registration number" required value={f.vehicle_id} onChange={on('vehicle_id')}>
            <option value="">Select your vehicle</option>
            {vehicles?.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
          </Select>
          <Field label="Vehicle model" readOnly placeholder="Filled in when you pick a vehicle" value={chosen ? `${chosen.make} ${chosen.model} (${chosen.year})` : ''} />
          <Select label="Service type" required value={f.category_id} onChange={on('category_id')}>
            <option value="">Select service</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name} – {inr(c.base_price)}</option>)}
          </Select>
          <Field label="Preferred date" type="date" required min={today()} value={f.scheduled_date} onChange={on('scheduled_date')} />
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">Problem description</span>
            <textarea rows={2} maxLength={1000} value={f.notes} onChange={on('notes')} placeholder="Describe the problem or what you need done"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-3"><Btn disabled={!vehicles?.length}>Book service</Btn></div>
        </form>
      </Card>
      <Alert msg={msg.m} ok={msg.ok} />

      <div className="space-y-3">
        <h2 className="text-xl font-bold">My services</h2>
        {live.map((b) => (
          <Card key={b.id} className="space-y-4">
            <div>
              <p className="font-semibold">Service #{b.id} · {b.category}</p>
              <p className="text-sm text-slate-600">{b.plate} · {b.make} {b.model}</p>
            </div>
            <Tracker status={b.status} />
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p><span className="text-slate-500">Current status:</span> <b>{STEPS[STEP_OF[b.status]]}</b></p>
              <p><span className="text-slate-500">Estimated completion:</span> <b>{estimatedDate(b, cats)}</b></p>
              <p><span className="text-slate-500">Estimated cost:</span> <b>{inr(b.estimated_cost)}</b></p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-slate-500">Mechanic: <b className="text-slate-800">{b.mechanic || 'Not assigned yet'}</b></span>
              {b.mechanic_notes && <span className="text-slate-500">Mechanic note: <b className="text-slate-800">{b.mechanic_notes}</b></span>}
              <Link to={base('/bookings')} className="text-blue-600 hover:underline">View timeline</Link>
              {b.status === 'pending' && <button type="button" className="text-red-600 hover:underline" onClick={() => cancel(b.id)}>Cancel booking</button>}
            </div>
          </Card>
        ))}
        {!live.length && <Card><p className="text-slate-400">No active services. Book one above.</p></Card>}
      </div>

      <Card>
        <h3 className="mb-3 font-semibold">Previous completed services</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500"><tr><th className="py-2">Service</th><th>Vehicle</th><th>Date</th><th>Cost</th></tr></thead>
            <tbody>
              {past.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="py-2">#{b.id} · {b.category}</td><td>{b.plate} · {b.make} {b.model}</td>
                  <td>{b.scheduled_date?.slice(0, 10)}</td><td>{inr(b.final_cost ?? b.estimated_cost)}</td>
                </tr>
              ))}
              {!past.length && <tr><td colSpan="4" className="py-4 text-slate-400">No completed services yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
