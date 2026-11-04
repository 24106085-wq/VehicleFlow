import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { api } from '../api.js';
import { Card, Field, Select, Btn, inr } from './ui.jsx';

// Each column is one booking status, so no extra "stage" field is needed in the database.
const COLUMNS = [
  { key: 'pending', title: 'Booking' },
  { key: 'confirmed', title: 'Inspection' },
  { key: 'in_progress', title: 'Repairing' },
  { key: 'completed', title: 'Quality Check' },
  { key: 'delivered', title: 'Delivered' },
];
const PRIORITY_STYLE = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};
const MSG_STYLE = { error: 'bg-red-50 text-red-700', warn: 'bg-amber-50 text-amber-800', ok: 'bg-emerald-50 text-emerald-700' };
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { vehicle_id: '', category_id: '', scheduled_date: today(), priority: 'medium', notes: '' };
const plain = (s) => String(s || '').replace(/[\s-]/g, '').toLowerCase(); // "mh05 ab-1234" -> "mh05ab1234"

// Small number box for a column's WIP limit. Saves when you leave the box or press Enter.
function LimitInput({ title, value, onSave }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const save = async () => { if (v !== String(value) && !(await onSave(v))) setV(String(value)); };
  return (
    <input type="number" min="0" max="99" value={v} aria-label={`WIP limit for ${title}`} title="WIP limit (0 = no limit)"
      onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="w-12 rounded-md border border-slate-200 bg-white px-1 py-0.5 text-center text-xs" />
  );
}

function ServiceCard({ c, mechs, patch }) {
  const [open, setOpen] = useState(false), [hist, setHist] = useState(null);
  // Service activity history: reloaded when opened and whenever the card's stage or mechanic changes.
  useEffect(() => { if (open) api(`/bookings/${c.id}/history`).then(setHist).catch(() => setHist([])); }, [open, c.status, c.mechanic_id]);
  return (
    <div draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(c.id)); e.dataTransfer.effectAllowed = 'move'; }}
      className="cursor-grab space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm active:cursor-grabbing">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Service #{c.id}</span>
        <select aria-label="Priority" value={c.priority} onChange={(e) => patch(c.id, { priority: e.target.value })}
          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_STYLE[c.priority]}`}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
      </div>
      <p className="font-medium">{c.customer}</p>
      <p className="text-slate-600">{c.plate} · {c.make} {c.model}</p>
      <p className="text-slate-500">{c.category}</p>
      <select aria-label="Assigned mechanic" value={c.mechanic_id || ''} onChange={(e) => patch(c.id, { mechanic_id: e.target.value })}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
        <option value="">Unassigned</option>
        {mechs.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button type="button" onClick={() => setOpen(!open)} className="text-xs text-blue-600 hover:underline">{open ? 'Hide history' : 'History'}</button>
      {open && (
        <ul className="max-h-32 space-y-1 overflow-y-auto border-t border-slate-100 pt-1 text-xs text-slate-600">
          {hist === null ? <li>Loading…</li> : hist.length ? hist.map((h) => <li key={h.id}>{h.created_at.slice(5, 16)} · {h.action}{h.actor ? ` (${h.actor})` : ''}</li>) : <li>No activity yet.</li>}
        </ul>
      )}
    </div>
  );
}

export default function KanbanBoard({ onChange }) {
  const [cards, setCards] = useState([]), [mechs, setMechs] = useState([]), [limits, setLimits] = useState({});
  const [vehicles, setVehicles] = useState([]), [cats, setCats] = useState([]);
  const [search, setSearch] = useState(''), [msg, setMsg] = useState({}), [over, setOver] = useState(null);
  const [showForm, setShowForm] = useState(false), [f, setF] = useState(EMPTY);

  // Cancelled bookings have no column, so they are not shown on the board.
  const loadCards = () => api('/bookings').then((rows) => setCards(rows.filter((b) => b.status !== 'cancelled'))).catch((e) => setMsg({ text: e.message, kind: 'error' }));
  useEffect(() => {
    loadCards();
    api('/mechanics').then(setMechs).catch(() => {});
    api('/board/wip-limits').then(setLimits).catch((e) => setMsg({ text: e.message, kind: 'error' }));
    api('/vehicles').then(setVehicles).catch(() => {});
    api('/categories').then(setCats).catch(() => {});
    // New customer bookings appear without a page reload (silent refresh every 30 seconds).
    const t = setInterval(() => api('/bookings').then((rows) => setCards(rows.filter((b) => b.status !== 'cancelled'))).catch(() => {}), 30000);
    return () => clearInterval(t);
  }, []);

  const countIn = (status) => cards.filter((c) => c.status === status).length;

  // Used for mechanic and priority changes made on a card.
  const patch = async (id, body) => {
    try { await api('/bookings/' + id, { method: 'PATCH', body }); setMsg({}); await loadCards(); onChange?.(); }
    catch (e) { setMsg({ text: e.message, kind: 'error' }); }
  };

  // Drag-and-drop move: update the screen straight away, then save; undo if the server says no.
  const move = async (id, to) => {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === to) return;
    if (card.status === 'pending' && to === 'delivered')
      return setMsg({ text: 'A booking cannot move directly from Booking to Delivered. Move it through Inspection, Repairing and Quality Check first.', kind: 'error' });
    const before = cards, limit = limits[to], newCount = countIn(to) + 1;
    setCards(cards.map((c) => (c.id === id ? { ...c, status: to } : c)));
    try {
      await api('/bookings/' + id, { method: 'PATCH', body: { status: to } });
      const title = COLUMNS.find((c) => c.key === to).title;
      setMsg(limit > 0 && newCount > limit ? { text: `${title} is over its WIP limit (${newCount}/${limit}).`, kind: 'warn' } : {});
      onChange?.();
    } catch (e) { setCards(before); setMsg({ text: e.message, kind: 'error' }); }
  };

  const saveLimit = async (status, value) => {
    try { await api('/board/wip-limits/' + status, { method: 'PUT', body: { limit: value } }); setLimits({ ...limits, [status]: Number(value) }); setMsg({}); return true; }
    catch (e) { setMsg({ text: e.message, kind: 'error' }); return false; }
  };

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/bookings', { method: 'POST', body: f });
      setF(EMPTY); setShowForm(false); setMsg({ text: 'Booking created. It appears in the Booking column.', kind: 'ok' });
      await loadCards(); onChange?.();
    } catch (x) { setMsg({ text: x.message, kind: 'error' }); }
  };
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Sprint overview: every card on the board is a task; Delivered = completed.
  const total = cards.length, done = countIn('delivered'), pending = total - done;
  const shown = cards.filter((c) => plain(c.plate).includes(plain(search)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Service Board</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <Search size={16} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle number" aria-label="Search by vehicle number" className="w-44 bg-transparent outline-none" />
          </label>
          <Btn onClick={() => setShowForm(!showForm)} className="flex items-center gap-1"><Plus size={16} />New booking</Btn>
        </div>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Vehicle" required value={f.vehicle_id} onChange={on('vehicle_id')}>
              <option value="">Select vehicle</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} – {v.make} {v.model} ({v.owner})</option>)}
            </Select>
            <Select label="Service type" required value={f.category_id} onChange={on('category_id')}>
              <option value="">Select service</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name} – {inr(c.base_price)}</option>)}
            </Select>
            <Field label="Date" type="date" required min={today()} value={f.scheduled_date} onChange={on('scheduled_date')} />
            <Select label="Priority" value={f.priority} onChange={on('priority')}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </Select>
            <Field label="Notes (optional)" value={f.notes} onChange={on('notes')} />
            <div className="flex items-end"><Btn className="w-full">Create booking</Btn></div>
          </form>
        </Card>
      )}

      <Card className="flex flex-wrap items-center gap-x-8 gap-y-2 !py-3">
        <h3 className="font-semibold">Sprint Overview</h3>
        <p className="text-sm text-slate-600">Total tasks: <b className="text-slate-900">{total}</b></p>
        <p className="text-sm text-slate-600">Completed (Delivered): <b className="text-emerald-700">{done}</b></p>
        <p className="text-sm text-slate-600">Pending: <b className="text-amber-700">{pending}</b></p>
      </Card>

      {msg.text && <p role="alert" className={`rounded-xl px-3 py-2 text-sm ${MSG_STYLE[msg.kind]}`}>{msg.text}</p>}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map(({ key, title }) => {
          const count = countIn(key), limit = limits[key] || 0, full = limit > 0 && count >= limit, exceeded = limit > 0 && count > limit;
          return (
            <section key={key} aria-label={title}
              onDragOver={(e) => { e.preventDefault(); setOver(key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); setOver(null); move(Number(e.dataTransfer.getData('text/plain')), key); }}
              className={`min-w-[15rem] flex-1 rounded-2xl bg-slate-200/60 p-3 ${over === key ? 'ring-2 ring-cyan-400' : ''}`}>
              <div className="mb-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{title} <span className="font-normal text-slate-500">({count}{limit > 0 ? `/${limit}` : ''})</span></h3>
                  <label className="flex items-center gap-1 text-xs text-slate-500">WIP<LimitInput title={title} value={limits[key] || 0} onSave={(v) => saveLimit(key, v)} /></label>
                </div>
                {full && (
                  <p className={`flex items-center gap-1 text-xs font-medium ${exceeded ? 'text-red-600' : 'text-amber-700'}`}>
                    <AlertTriangle size={14} />{exceeded ? 'Over WIP limit' : 'WIP limit reached'}
                  </p>
                )}
              </div>
              <div className="min-h-[6rem] space-y-2">
                {shown.filter((c) => c.status === key).map((c) => <ServiceCard key={c.id} c={c} mechs={mechs} patch={patch} />)}
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">Drag a card to another column to change its status. Assigning a mechanic to a Booking card moves it to Inspection. Set a column's WIP limit to 0 for no limit.</p>
    </div>
  );
}
