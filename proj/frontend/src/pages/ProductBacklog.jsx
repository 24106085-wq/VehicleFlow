import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown, Info, MoreHorizontal } from 'lucide-react';
import { api } from '../api.js';
import { useBase } from '../workspace.jsx';
import { Card, Badge, Skeleton } from '../components/ui.jsx';
import { problemId, statusLabel, statusBadge, fmtDateTime } from '../serviceUi.js';

const RANK = { high: 3, medium: 2, low: 1 };
const FILTERS = [['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
const plain = (s) => String(s || '').replace(/[\s-]/g, '').toLowerCase();

// Product Backlog = every customer-reported vehicle problem. Reports land here automatically (same SQLite record as the Kanban card).
export default function ProductBacklog() {
  const nav = useNavigate(), base = useBase();
  const [rows, setRows] = useState(null), [err, setErr] = useState('');
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const [sort, setSort] = useState('priority'), [dir, setDir] = useState('desc');

  useEffect(() => {
    const load = () => api('/service-board/backlog').then((r) => { setRows(r.problems); setErr(''); }).catch((e) => setErr(e.message));
    load(); const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);

  const shown = useMemo(() => {
    if (!rows) return [];
    const s = plain(search);
    const list = rows.filter((r) => (filter === 'all' || r.priority === filter)
      && (!s || [r.title, r.plate, r.make + r.model, r.customer, problemId(r.id)].some((v) => plain(v).includes(s))));
    const sign = dir === 'asc' ? 1 : -1;
    // second key keeps the order stable: newest first inside the same priority, higher priority first for the same date
    return list.sort((a, b) => (sort === 'priority'
      ? sign * (RANK[a.priority] - RANK[b.priority]) || b.reported_at.localeCompare(a.reported_at)
      : sign * a.reported_at.localeCompare(b.reported_at) || RANK[b.priority] - RANK[a.priority]) || b.id - a.id);
  }, [rows, filter, search, sort, dir]);

  if (err && !rows) return <p role="alert" className="text-red-600">{err}</p>;
  if (!rows) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-72" /></div>;
  const n = (p) => (p === 'all' ? rows.length : rows.filter((r) => r.priority === p).length);
  const chip = { all: 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300', high: 'border-red-400/50 bg-red-500/10 text-red-300', medium: 'border-amber-400/50 bg-amber-500/10 text-amber-300', low: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-300' };

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold">Product Backlog</h1><p className="text-sm text-slate-500">All reported vehicle problems (prioritized and ready for service).</p></div>
      <p className="flex items-start gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm text-slate-600">
        <Info size={18} className="mt-0.5 shrink-0 text-cyan-400" aria-hidden="true" />
        <span>Every problem a customer reports is added to this Product Backlog automatically and prioritized for resolution. Work through it from the top: high-priority problems first. Changing a status here also moves the card on the Admin Kanban Board and updates what the customer sees.</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${filter === k ? chip[k] : 'border-white/10 text-slate-500 hover:text-white'}`}>{l} ({n(k)})</button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm"><Search size={16} className="text-slate-400" aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle, customer, problem" aria-label="Search backlog" className="w-56 bg-transparent outline-none" /></label>
          <label className="flex items-center gap-2 text-sm text-slate-500">Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-white/10 px-2 py-1.5"><option value="priority">Priority</option><option value="date">Reported date</option></select></label>
          <button type="button" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')} aria-label={`Sort direction: ${dir === 'asc' ? 'ascending' : 'descending'}`} className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-sm text-slate-500 hover:text-white">
            <ArrowUpDown size={14} aria-hidden="true" />{dir === 'asc' ? 'Low → High / Oldest' : 'High → Low / Newest'}</button>
        </div>
      </div>

      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="text-left text-slate-500"><tr>{['Problem ID', 'Problem Title', 'Vehicle', 'Customer', 'Priority', 'Status', 'Action'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={() => nav(base('/backlog/' + r.id))} className="cursor-pointer border-t hover:bg-white/5">
                  <td className="px-4 py-3 text-slate-500">{problemId(r.id)}</td>
                  <td className="px-4 py-3 font-medium text-white">{r.title}<span className="block text-xs font-normal text-slate-500">{fmtDateTime(r.reported_at)}</span></td>
                  <td className="px-4 py-3">{r.make} {r.model}<span className="block text-xs text-slate-500">{r.plate}</span></td>
                  <td className="px-4 py-3">{r.customer}</td>
                  <td className="px-4 py-3"><Badge v={r.priority} /></td>
                  <td className="px-4 py-3"><Badge v={statusBadge(r)} label={statusLabel(r)} /></td>
                  <td className="px-4 py-3"><button type="button" onClick={(e) => { e.stopPropagation(); nav(base('/backlog/' + r.id)); }} aria-label={`Open ${r.title}`} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"><MoreHorizontal size={18} /></button></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-500">{rows.length ? 'No problems match your filters.' : 'No problems have been reported yet.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-slate-500">Showing {shown.length} of {rows.length} problems. Click a row to open its service request details.</p>
    </div>
  );
}
