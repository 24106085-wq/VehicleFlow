import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Wrench, ClipboardList } from 'lucide-react';
import { api, apiBlobUrl } from '../api.js';
import { useBase } from '../workspace.jsx';
import { Badge, Modal, Skeleton } from '../components/ui.jsx';
import { Tracker } from '../components/CustomerServices.jsx';
import { GROUP_OF, GROUP_LABEL, GROUP_BADGE, fmtDate } from '../lib.js';

const FILTERS = [['all', 'All'], ['todo', 'To Do'], ['progress', 'In Progress'], ['done', 'Done']];
const STAGE = { pending: 'Booking received', confirmed: 'Inspection', in_progress: 'Repairing', completed: 'Quality check', delivered: 'Delivered', cancelled: 'Cancelled' };
const titleOf = (b) => b.title || b.category;

function Detail({ b, onClose }) {
  const [img, setImg] = useState('');
  useEffect(() => {
    let url = '';
    if (b.image_path) apiBlobUrl(`/problems/${b.id}/image`).then((u) => { url = u; setImg(u); }).catch(() => {});
    return () => url && URL.revokeObjectURL(url);
  }, [b.id, b.image_path]);
  const g = GROUP_OF[b.status];
  const rows = [['Vehicle', `${b.plate} · ${b.make} ${b.model}`], ['Category', b.category], ['Priority', <Badge key="p" v={b.priority} />], ['Status', <Badge key="s" v={GROUP_BADGE[g]} label={GROUP_LABEL[g]} />],
    ['Stage', STAGE[b.status]], ['Reported on', fmtDate(b.created_at)], ['Last updated', fmtDate(b.updated_at)], ['Mechanic', b.mechanic || 'Not assigned yet']];
  return (
    <Modal title={titleOf(b)} onClose={onClose} wide>
      {b.notes && <p className="mb-4 text-sm text-slate-600">{b.notes}</p>}
      <dl className="grid gap-x-8 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3 border-b border-white/10 py-2"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-white">{v}</dd></div>)}
      </dl>
      {b.status !== 'cancelled' && <div className="my-5"><Tracker status={b.status} /></div>}
      {b.mechanic_notes && <div className="mb-4 rounded-xl bg-white/5 p-3 text-sm"><p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Update from the workshop</p>{b.mechanic_notes}</div>}
      {img && <img src={img} alt="Uploaded problem" className="max-h-56 rounded-xl border border-[var(--line)] object-contain" />}
    </Modal>
  );
}

export default function MyProblems() {
  const base = useBase();
  const [rows, setRows] = useState(null), [err, setErr] = useState(''), [flt, setFlt] = useState('all'), [search, setSearch] = useState(''), [open, setOpen] = useState(null);

  // The backend is the source of truth: re-read every 15 s and whenever the tab regains focus,
  // so a status change made by an admin on the Kanban board appears here without a reload.
  useEffect(() => {
    let live = true;
    const load = () => api('/bookings').then((r) => { if (live) { setRows(r); setErr(''); } }).catch((e) => live && setErr(e.message));
    load();
    const t = setInterval(load, 15000), vis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', vis);
    return () => { live = false; clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, []);
  useEffect(() => { if (open && rows) setOpen(rows.find((r) => r.id === open.id) || null); }, [rows]); // keep the open dialog in sync

  const counts = useMemo(() => {
    const c = { all: rows?.length || 0, todo: 0, progress: 0, done: 0 };
    rows?.forEach((b) => { const g = GROUP_OF[b.status]; if (c[g] !== undefined) c[g]++; });
    return c;
  }, [rows]);
  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (rows || []).filter((b) => (flt === 'all' || GROUP_OF[b.status] === flt)
      && (!t || `${titleOf(b)} ${b.plate} ${b.make} ${b.model} ${b.category}`.toLowerCase().includes(t)));
  }, [rows, flt, search]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">My Reported Problems</h1>
        <p className="text-sm text-slate-500">Track the status of your vehicle service requests.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
          {FILTERS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={flt === k} onClick={() => setFlt(k)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${flt === k ? 'border-cyan-400 bg-cyan-400/20 text-white shadow-[0_0_14px_rgba(0,183,255,.25)]' : 'border-[var(--line)] text-slate-500 hover:text-white'}`}>
              {label} ({counts[k]})
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:w-72"><Search size={16} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or vehicle…" aria-label="Search problems" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none" /></label>
      </div>

      {err && !rows && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-100 px-3 py-2 text-sm text-red-700">{err}</p>}
      {!rows && !err && <div className="space-y-3" role="status" aria-label="Loading problems">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>}
      {rows?.length === 0 && (
        <div className="vf-card grid place-items-center gap-3 px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><ClipboardList size={28} /></span>
          <h2 className="text-lg font-semibold">No problems reported yet</h2>
          <p className="max-w-sm text-sm text-slate-500">When something goes wrong with your vehicle, report it and follow the progress here.</p>
          <Link to={base('/report')} className="vf-btn px-4 py-2 font-medium">Report a Problem</Link>
        </div>
      )}
      {rows?.length > 0 && !shown.length && <p className="vf-card p-6 text-center text-slate-500">No problems match this filter or search.</p>}

      <ul className="space-y-3">
        {shown.map((b, i) => {
          const g = GROUP_OF[b.status];
          return (
            <li key={b.id} className="vf-card page-enter flex flex-wrap items-center gap-x-5 gap-y-3 p-4" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><Wrench size={20} aria-hidden="true" /></span>
              <div className="min-w-[10rem] flex-1">
                <p className="font-semibold text-white">{titleOf(b)}</p>
                <p className="text-xs text-slate-500">{b.plate} · {b.make} {b.model} · {b.category}</p>
              </div>
              <Badge v={b.priority} />
              <Badge v={GROUP_BADGE[g]} label={GROUP_LABEL[g]} />
              <span className="text-sm text-slate-500">{fmtDate(b.created_at)}</span>
              <button onClick={() => setOpen(b)} aria-label={`View ${titleOf(b)}`} className="rounded-xl border border-[var(--line)] px-5 py-1.5 text-sm font-medium text-white hover:border-cyan-400 hover:bg-cyan-400/10">View</button>
            </li>
          );
        })}
      </ul>
      {open && <Detail b={open} onClose={() => setOpen(null)} />}
    </>
  );
}
