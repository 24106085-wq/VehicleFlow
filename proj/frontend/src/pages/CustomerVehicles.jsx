import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Calendar, Palette, Gauge, ArrowRight, Car, FilePlus2 } from 'lucide-react';
import { api } from '../api.js';
import { useBase } from '../workspace.jsx';
import { Btn, Field, Modal, Skeleton, useToast } from '../components/ui.jsx';
import { vehicleImage } from '../assets/vehicleImage.js';
import fallback from '../assets/vehicle-fallback.svg';

const EMPTY = { make: '', model: '', year: '', plate: '', color: '', mileage: '' };
const maxYear = new Date().getFullYear() + 1;
const km = (n) => `${Number(n || 0).toLocaleString('en-IN')} km`;

function validate(f, rows, editingId) {
  if (!f.make.trim() || !f.model.trim()) return 'Manufacturer and model are required';
  const y = +f.year;
  if (!Number.isInteger(y) || y < 1980 || y > maxYear) return `Year must be between 1980 and ${maxYear}`;
  const plate = f.plate.trim();
  if (!/^[A-Z0-9 -]{4,15}$/i.test(plate)) return 'Enter a valid registration number (4–15 letters/numbers)';
  if (rows.some((v) => v.id !== editingId && v.plate.toLowerCase() === plate.toLowerCase())) return 'This registration number is already registered';
  if (f.mileage !== '' && (!Number.isInteger(+f.mileage) || +f.mileage < 0)) return 'Mileage must be a whole number, 0 or more';
  return null;
}

function VehicleImg({ v }) {
  const [src, setSrc] = useState(() => vehicleImage(v));
  useEffect(() => setSrc(vehicleImage(v)), [v.model, v.color]);
  return <img src={src} alt={`${v.make} ${v.model}`} loading="lazy" onError={() => src !== fallback && setSrc(fallback)}
    className="h-full w-full object-contain p-2 transition duration-500 ease-out group-hover:scale-110 group-hover:drop-shadow-[0_10px_18px_rgba(0,183,255,.35)]" />;
}

function VehicleCard({ v, onView, onEdit, onDelete }) {
  return (
    <article className="vf-card group relative flex flex-col p-5">
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <button onClick={() => onEdit(v)} aria-label={`Edit ${v.make} ${v.model}`} className="grid h-8 w-8 place-items-center rounded-lg border border-sky-400/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/25"><Pencil size={15} /></button>
        <button onClick={() => onDelete(v)} aria-label={`Delete ${v.make} ${v.model}`} className="grid h-8 w-8 place-items-center rounded-lg border border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/25"><Trash2 size={15} /></button>
      </div>
      <div className="mx-auto mb-3 mt-2 aspect-[16/9] w-full max-w-[260px] overflow-hidden rounded-xl bg-gradient-to-b from-sky-400/10 to-transparent"><VehicleImg v={v} /></div>
      <h3 className="text-lg font-semibold text-white">{v.make} {v.model}</h3>
      <span className="mt-2 w-fit rounded-lg border border-[var(--line)] bg-white/5 px-3 py-1 text-sm font-medium tracking-wide text-white">{v.plate}</span>
      <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
        <div className="flex items-center gap-1.5"><Calendar size={15} aria-hidden="true" /><dt className="sr-only">Year</dt><dd>{v.year}</dd></div>
        <div className="flex items-center gap-1.5"><Palette size={15} aria-hidden="true" /><dt className="sr-only">Colour</dt><dd>{v.color || '—'}</dd></div>
        <div className="flex items-center gap-1.5"><Gauge size={15} aria-hidden="true" /><dt className="sr-only">Mileage</dt><dd>{km(v.mileage)}</dd></div>
      </dl>
      <button onClick={() => onView(v)} className="group/b mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/10 py-2.5 text-sm font-medium text-white hover:bg-sky-500/25">
        View Details <ArrowRight size={16} className="transition-transform group-hover/b:translate-x-1" />
      </button>
    </article>
  );
}

export default function CustomerVehicles() {
  const base = useBase(), toast = useToast();
  const [rows, setRows] = useState(null), [loadErr, setLoadErr] = useState(''), [search, setSearch] = useState('');
  const [form, setForm] = useState(null);           // { id|null, f }
  const [formErr, setFormErr] = useState(''), [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null), [del, setDel] = useState(null), [delErr, setDelErr] = useState('');

  const load = () => api('/vehicles').then((r) => { setRows(r); setLoadErr(''); }).catch((e) => setLoadErr(e.message));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (rows || []).filter((v) => !t || `${v.make} ${v.model} ${v.plate}`.toLowerCase().includes(t));
  }, [rows, search]);

  const openAdd = () => { setForm({ id: null, f: EMPTY }); setFormErr(''); };
  const openEdit = (v) => { setForm({ id: v.id, f: { make: v.make, model: v.model, year: v.year, plate: v.plate, color: v.color || '', mileage: v.mileage ?? '' } }); setFormErr(''); setDetail(null); };
  const on = (k) => (e) => setForm({ ...form, f: { ...form.f, [k]: e.target.value } });

  const save = async (e) => {
    e.preventDefault();
    const err = validate(form.f, rows || [], form.id);
    if (err) return setFormErr(err);
    setBusy(true);
    try {
      await api(form.id ? '/vehicles/' + form.id : '/vehicles', { method: form.id ? 'PUT' : 'POST', body: form.f });
      toast(form.id ? 'Vehicle updated' : 'Vehicle added');
      setForm(null); load();
    } catch (x) { setFormErr(x.message); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    try { await api('/vehicles/' + del.id, { method: 'DELETE' }); toast('Vehicle deleted'); setDel(null); setDelErr(''); load(); }
    catch (x) { setDelErr(x.message); }
    setBusy(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold"><span className="text-cyan-400">My</span> Vehicles</h1>
          <p className="text-sm text-slate-500">View and manage your registered vehicles</p>
        </div>
        <button onClick={openAdd} className="vf-btn flex items-center gap-2 px-4 py-2 text-sm font-medium"><Plus size={16} />Add Vehicle</button>
      </div>

      {rows?.length > 0 && (
        <label className="relative block max-w-md">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by registration, make or model" aria-label="Search vehicles"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none" />
        </label>
      )}

      {loadErr && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-100 px-3 py-2 text-sm text-red-700">{loadErr} <button className="underline" onClick={load}>Retry</button></p>}
      {!rows && !loadErr && <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading vehicles">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80" />)}</div>}

      {rows?.length === 0 && (
        <div className="vf-card grid place-items-center gap-3 px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-300"><Car size={28} /></span>
          <h2 className="text-lg font-semibold">No vehicles yet</h2>
          <p className="max-w-sm text-sm text-slate-500">Add your first vehicle to start reporting problems and tracking service.</p>
          <Btn onClick={openAdd}>Add Vehicle</Btn>
        </div>
      )}
      {rows?.length > 0 && !shown.length && <p className="vf-card p-6 text-center text-slate-500">No vehicles match “{search.trim()}”.</p>}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((v) => <VehicleCard key={v.id} v={v} onView={setDetail} onEdit={openEdit} onDelete={(x) => { setDel(x); setDelErr(''); }} />)}
      </div>

      {form && (
        <Modal title={form.id ? 'Edit Vehicle' : 'Add Vehicle'} onClose={() => !busy && setForm(null)} wide>
          <form onSubmit={save} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Manufacturer *" value={form.f.make} onChange={on('make')} placeholder="e.g. Maruti Suzuki" />
              <Field label="Model *" value={form.f.model} onChange={on('model')} placeholder="e.g. Swift" />
              <Field label="Registration number *" maxLength={15} value={form.f.plate} onChange={on('plate')} placeholder="MH05AB1234" />
              <Field label="Year *" type="number" min="1980" max={maxYear} value={form.f.year} onChange={on('year')} />
              <Field label="Colour" value={form.f.color} onChange={on('color')} placeholder="e.g. Red" />
              <Field label="Mileage (km)" type="number" min="0" value={form.f.mileage} onChange={on('mileage')} />
            </div>
            {formErr && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-100 px-3 py-2 text-sm text-red-700">{formErr}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setForm(null)} disabled={busy} className="rounded-xl border border-[var(--line)] px-4 py-2 text-white hover:bg-white/5">Cancel</button>
              <Btn disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Add Vehicle'}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title="Vehicle Details" onClose={() => setDetail(null)}>
          <div className="mx-auto mb-4 aspect-[16/9] w-full max-w-[280px] overflow-hidden rounded-xl bg-gradient-to-b from-sky-400/10 to-transparent"><VehicleImg v={detail} /></div>
          <p className="text-lg font-semibold text-white">{detail.make} {detail.model}</p>
          <dl className="mt-3 divide-y divide-white/10 text-sm">
            {[['Registration', detail.plate], ['Year', detail.year], ['Colour', detail.color || '—'], ['Mileage', km(detail.mileage)], ['Added on', detail.created_at ? String(detail.created_at).slice(0, 10) : '—']].map(([k, val]) => (
              <div key={k} className="flex justify-between py-2"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-white">{val}</dd></div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button onClick={() => openEdit(detail)} className="flex items-center gap-2 rounded-xl border border-sky-400/40 px-4 py-2 text-white hover:bg-sky-500/15"><Pencil size={15} />Edit</button>
            <Link to={base('/report')} className="vf-btn flex items-center gap-2 px-4 py-2 text-sm font-medium"><FilePlus2 size={15} />Report a Problem</Link>
          </div>
        </Modal>
      )}

      {del && (
        <Modal title="Delete vehicle?" onClose={() => !busy && setDel(null)}>
          <p className="text-sm text-slate-600">This will permanently remove <b className="text-white">{del.make} {del.model}</b> ({del.plate}). This cannot be undone.</p>
          {delErr && <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-100 px-3 py-2 text-sm text-red-700">{delErr}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setDel(null)} disabled={busy} className="rounded-xl border border-[var(--line)] px-4 py-2 text-white hover:bg-white/5">Cancel</button>
            <button onClick={remove} disabled={busy} className="rounded-xl bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-400 disabled:opacity-50">{busy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
