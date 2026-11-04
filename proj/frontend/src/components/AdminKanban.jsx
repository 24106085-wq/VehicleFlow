import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Car, ClipboardList, RefreshCw, CheckCircle2, Search, Wrench, Hourglass, User, Calendar, Hash } from 'lucide-react';
import { api } from '../api.js';
import { Badge, Modal, Select, Btn, Skeleton, useToast } from './ui.jsx';

// Exactly three columns. Each one groups the booking statuses the backend already stores (see backend/src/serviceBoard.js).
const COLUMNS = [
  { key: 'todo', title: 'To Do', icon: ClipboardList, head: 'border-blue-400/40 bg-blue-500/10 text-blue-300', zone: 'border-blue-400/25 bg-blue-500/[.06]', over: 'ring-blue-400' },
  { key: 'in_progress', title: 'In Progress', icon: RefreshCw, head: 'border-violet-400/40 bg-violet-500/10 text-violet-300', zone: 'border-violet-400/25 bg-violet-500/[.06]', over: 'ring-violet-400' },
  { key: 'done', title: 'Done', icon: CheckCircle2, head: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300', zone: 'border-emerald-400/25 bg-emerald-500/[.06]', over: 'ring-emerald-400' },
];
const TITLE = Object.fromEntries(COLUMNS.map((c) => [c.key, c.title]));
const plain = (s) => String(s || '').replace(/[\s-]/g, '').toLowerCase();
const when = (s) => (s ? new Date(String(s).replace(' ', 'T') + (/[TZ]/.test(String(s)) ? '' : 'Z')).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const count = (tasks) => { const s = { total: 0, todo: 0, in_progress: 0, done: 0 }; tasks.forEach((t) => { s[t.column]++; s.total++; }); return s; };

function StatCard({ label, value, icon: Icon, tone }) {
  return (
    <div className={`vf-card flex flex-col items-center gap-1 p-4 text-center ${tone.box}`}>
      <Icon size={22} className={tone.icon} aria-hidden="true" />
      <p className="text-3xl font-semibold text-white">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function TaskCard({ t, onOpen, onMove, busy }) {
  return (
    <div data-card={t.id} draggable={!busy} role="button" tabIndex={0} aria-label={`${t.title}, ${t.plate}. Open details`}
      onClick={() => onOpen(t.id)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(t.id); }}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('opacity-50'); }}
      onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
      className="cursor-grab space-y-2 rounded-xl border border-white/10 bg-[#0b2447]/90 p-3 text-sm shadow-md transition-colors hover:border-cyan-400/50 active:cursor-grabbing">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-white">{t.title}</p>
        <Badge v={t.priority} />
      </div>
      <p className="text-xs text-slate-500"><span className="font-medium text-slate-600">{t.plate}</span> · {t.make} {t.model}</p>
      <p className="flex items-center gap-1 text-xs text-slate-500"><Wrench size={12} aria-hidden="true" />{t.category}</p>
      <select aria-label={`Status of ${t.title}`} value={t.column} disabled={busy}
        onClick={(e) => e.stopPropagation()} onChange={(e) => onMove(t.id, e.target.value)}
        className="w-full rounded-lg border border-white/10 px-2 py-1 text-xs">
        {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
      </select>
    </div>
  );
}

function Details({ id, mechs, onClose, onSaved }) {
  const toast = useToast();
  const [d, setD] = useState(null), [f, setF] = useState(null), [err, setErr] = useState(''), [saving, setSaving] = useState(false);
  useEffect(() => {
    api('/service-board/' + id).then((x) => { setD(x); setF({ status: x.column, priority: x.priority, mechanic_id: x.mechanic_id || '', resolution_notes: x.resolution_notes || '' }); }).catch((e) => setErr(e.message));
  }, [id]);
  const save = async () => {
    setSaving(true); setErr('');
    try {
      const r = await api('/service-board/' + id, { method: 'PATCH', body: f });
      toast(r.changed ? 'Service request updated' : 'No changes to save');
      onSaved(r); onClose();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };
  const Row = ({ icon: I, k, v }) => <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2 text-sm"><span className="flex items-center gap-2 text-slate-500"><I size={15} aria-hidden="true" />{k}</span><span className="text-right font-medium text-white">{v}</span></div>;
  return (
    <Modal title="Service Request Details" onClose={onClose} wide>
      {err && !d && <p role="alert" className="text-red-600">{err}</p>}
      {!d || !f ? (!err && <Skeleton className="h-64" />) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-start justify-between gap-2"><h3 className="text-lg font-semibold">{d.title}</h3><Badge v={d.priority} label={`${d.priority} priority`} /></div>
            <p className="mb-3 text-sm text-slate-600">{d.description || 'No description provided.'}</p>
            <Row icon={User} k="Customer" v={d.customer} />
            <Row icon={Car} k="Vehicle" v={`${d.make} ${d.model}`} />
            <Row icon={Hash} k="Registration" v={d.plate} />
            <Row icon={Calendar} k="Reported on" v={when(d.reported_at)} />
            <Row icon={Hourglass} k="Current status" v={TITLE[d.column]} />
            {d.history.length > 0 && (
              <ul className="mt-3 max-h-24 space-y-1 overflow-y-auto text-xs text-slate-500">{d.history.map((h) => <li key={h.id}>{h.created_at.slice(5, 16)} · {h.action}{h.actor ? ` (${h.actor})` : ''}</li>)}</ul>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold">Actions</h3>
            <Select label="Update status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}</Select>
            <Select label="Change priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select>
            <Select label="Assign mechanic" value={f.mechanic_id} onChange={(e) => setF({ ...f, mechanic_id: e.target.value })}><option value="">Unassigned</option>{mechs.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
            <label className="block text-sm"><span className="text-slate-600">Resolution notes</span>
              <textarea rows={4} maxLength={2000} value={f.resolution_notes} onChange={(e) => setF({ ...f, resolution_notes: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none" /></label>
            {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/20 px-4 py-2 font-medium text-white hover:bg-white/5">Cancel</button><Btn type="button" onClick={save} disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Update'}</Btn></div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AdminKanban() {
  const toast = useToast();
  const [tasks, setTasks] = useState(null), [mechs, setMechs] = useState([]), [err, setErr] = useState('');
  const [search, setSearch] = useState(''), [over, setOver] = useState(null), [openId, setOpenId] = useState(null), [busy, setBusy] = useState(false);
  const rects = useRef(new Map()), pending = useRef(0);

  const refresh = () => api('/service-board').then((r) => { if (!pending.current) setTasks(r.tasks); setErr(''); }).catch((e) => setErr(e.message));
  useEffect(() => {
    refresh(); api('/mechanics').then(setMechs).catch(() => {});
    const t = setInterval(refresh, 30000); // new customer problems appear without a page reload
    return () => clearInterval(t);
  }, []);

  // Smooth card movement (FLIP): remember where every card was, then slide it from the old spot to the new one.
  useLayoutEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('[data-card]').forEach((el) => {
      const id = el.dataset.card, now = el.getBoundingClientRect(), was = rects.current.get(id);
      if (was && !reduce && (was.left !== now.left || was.top !== now.top)) {
        el.animate([{ transform: `translate(${was.left - now.left}px, ${was.top - now.top}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      rects.current.set(id, now);
    });
  }, [tasks, search]);
  const snapshot = () => document.querySelectorAll('[data-card]').forEach((el) => rects.current.set(el.dataset.card, el.getBoundingClientRect()));

  // Drag-and-drop and the status dropdown both land here: the screen moves first, SQLite is updated through the API, and a failure puts the card back.
  const move = async (id, to) => {
    const t = tasks.find((x) => x.id === Number(id));
    if (!t || t.column === to) return;
    const before = tasks; snapshot(); pending.current++; setBusy(true);
    setTasks(tasks.map((x) => (x.id === t.id ? { ...x, column: to } : x)));
    try {
      const r = await api('/service-board/' + t.id, { method: 'PATCH', body: { status: to } });
      setTasks((cur) => cur.map((x) => (x.id === t.id ? r.task : x)));
      toast(`"${t.title}" moved to ${TITLE[to]}`);
    } catch (e) { snapshot(); setTasks(before); toast(e.message, 'error'); }
    finally { pending.current--; setBusy(false); }
  };
  const saved = (r) => { snapshot(); setTasks((cur) => cur.map((x) => (x.id === r.task.id ? r.task : x))); };

  const stats = useMemo(() => count(tasks || []), [tasks]); // statistics always follow the board, so they refresh on every move
  if (err && !tasks) return <p role="alert" className="text-red-600">{err}</p>;
  if (!tasks) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>;
  const shown = tasks.filter((t) => [t.plate, t.title, t.make, t.model, t.customer].some((v) => plain(v).includes(plain(search))));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Admin Dashboard</h1><p className="text-sm text-slate-500">Manage service requests, track progress, and handle vehicle issues.</p></div>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm">
          <Search size={16} className="text-slate-400" aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle, problem, customer" aria-label="Search tasks" className="w-56 bg-transparent outline-none" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-live="polite">
        <StatCard label="Total Requests" value={stats.total} icon={Car} tone={{ box: 'border-cyan-400/30', icon: 'text-cyan-400' }} />
        <StatCard label="To Do" value={stats.todo} icon={ClipboardList} tone={{ box: 'border-violet-400/30', icon: 'text-violet-300' }} />
        <StatCard label="In Progress" value={stats.in_progress} icon={RefreshCw} tone={{ box: 'border-blue-400/30', icon: 'text-blue-400' }} />
        <StatCard label="Done" value={stats.done} icon={CheckCircle2} tone={{ box: 'border-emerald-400/30 bg-emerald-500/[.08]', icon: 'text-emerald-400' }} />
      </div>

      <section aria-label="Service Kanban Board">
        <h2 className="mb-3 text-lg font-semibold">Service Kanban Board <span className="text-sm font-normal text-slate-500">(Vehicle Issues)</span></h2>
        {err && <p role="alert" className="mb-2 text-sm text-red-600">{err}</p>}
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((c) => {
            const col = shown.filter((t) => t.column === c.key);
            return (
              <div key={c.key} aria-label={c.title}
                onDragOver={(e) => { e.preventDefault(); setOver(c.key); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
                onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData('text/plain'), c.key); }}
                className={`min-h-[14rem] rounded-2xl border p-3 transition-shadow ${c.zone} ${over === c.key ? `ring-2 ${c.over}` : ''}`}>
                <div className={`mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold ${c.head}`}><c.icon size={16} aria-hidden="true" />{c.title} ({stats[c.key]})</div>
                <div className="space-y-2.5">
                  {col.map((t) => <TaskCard key={t.id} t={t} onOpen={setOpenId} onMove={move} busy={busy} />)}
                  {!col.length && <p className="px-1 py-6 text-center text-sm text-slate-500">{search ? 'No matching tasks.' : 'No tasks here.'}</p>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Drag a card to another column, or use the status dropdown on the card. Click a card for full details.</p>
      </section>
      {openId && <Details id={openId} mechs={mechs} onClose={() => setOpenId(null)} onSaved={saved} />}
    </div>
  );
}
