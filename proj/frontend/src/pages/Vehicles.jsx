import { useEffect, useState } from 'react';
import { Trash2, Pencil, Search } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Field, Select, Btn, Alert } from '../components/ui.jsx';
import CustomerVehicles from './CustomerVehicles.jsx';

const EMPTY = { make: '', model: '', year: '', plate: '', color: '', mileage: '', customer_id: '' };
const maxYear = new Date().getFullYear() + 1;

function validate(f, isAdmin, editing) {
  if (isAdmin && !editing && !f.customer_id) return 'Select the vehicle owner';
  if (!f.make.trim() || !f.model.trim()) return 'Make and model are required';
  const y = +f.year;
  if (!Number.isInteger(y) || y < 1980 || y > maxYear) return `Year must be between 1980 and ${maxYear}`;
  if (!/^[A-Z0-9 -]{4,15}$/i.test(f.plate.trim())) return 'Enter a valid registration plate (4–15 letters/numbers)';
  if (f.mileage !== '' && (!Number.isInteger(+f.mileage) || +f.mileage < 0)) return 'Mileage must be a whole number, 0 or more';
  return null;
}

function AdminVehicles() {
  const { user } = useAuth(), isAdmin = user.role === 'admin';
  const [rows, setRows] = useState([]), [cust, setCust] = useState([]), [f, setF] = useState(EMPTY), [msg, setMsg] = useState({});
  const [editing, setEditing] = useState(null), [search, setSearch] = useState('');
  const load = () => api('/vehicles').then(setRows).catch((e) => setMsg({ m: e.message }));
  useEffect(() => { load(); if (isAdmin) api('/customers').then(setCust).catch(() => {}); }, []);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const reset = () => { setF(EMPTY); setEditing(null); };
  const submit = async (e) => {
    e.preventDefault();
    const err = validate(f, isAdmin, editing);
    if (err) return setMsg({ m: err });
    try {
      if (editing) await api('/vehicles/' + editing, { method: 'PUT', body: f });
      else await api('/vehicles', { method: 'POST', body: f });
      setMsg({ m: editing ? 'Vehicle updated' : 'Vehicle added', ok: 1 }); reset(); load();
    } catch (x) { setMsg({ m: x.message }); }
  };
  const edit = (v) => {
    setEditing(v.id); setMsg({});
    setF({ make: v.make, model: v.model, year: v.year, plate: v.plate, color: v.color || '', mileage: v.mileage ?? '', customer_id: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const del = async (id) => {
    if (!confirm('Delete this vehicle?')) return;
    try { await api('/vehicles/' + id, { method: 'DELETE' }); setMsg({ m: 'Vehicle deleted', ok: 1 }); if (editing === id) reset(); load(); }
    catch (x) { setMsg({ m: x.message }); }
  };
  const t = search.trim().toLowerCase();
  const shown = rows.filter((v) => !t || `${v.make} ${v.model} ${v.plate} ${v.owner || ''}`.toLowerCase().includes(t));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{isAdmin ? 'Vehicles' : 'My vehicles'}</h1>
      <Card>
        <h3 className="mb-3 font-semibold">{editing ? 'Edit vehicle' : 'Add a vehicle'}</h3>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isAdmin && !editing && (
            <Select label="Owner" required value={f.customer_id} onChange={on('customer_id')}>
              <option value="">Select customer</option>{cust.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
          <Field label="Make" required value={f.make} onChange={on('make')} />
          <Field label="Model" required value={f.model} onChange={on('model')} />
          <Field label="Year" type="number" required min="1980" max={maxYear} value={f.year} onChange={on('year')} />
          <Field label="Registration plate" required maxLength={15} value={f.plate} onChange={on('plate')} />
          <Field label="Colour" value={f.color} onChange={on('color')} />
          <Field label="Mileage (km)" type="number" min="0" value={f.mileage} onChange={on('mileage')} />
          <div className="flex items-end gap-2">
            <Btn>{editing ? 'Save changes' : 'Add vehicle'}</Btn>
            {editing && <button type="button" onClick={reset} className="rounded-xl border border-slate-200 bg-white px-4 py-2">Cancel</button>}
          </div>
        </form>
        <div className="mt-3"><Alert msg={msg.m} ok={msg.ok} /></div>
      </Card>
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold">{shown.length} vehicle{shown.length === 1 ? '' : 's'}</h3>
          <label className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plate, make, model" aria-label="Search vehicles"
              className="w-56 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500" /></label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500"><tr><th className="py-2">Vehicle</th><th>Plate</th><th>Year</th><th>Mileage</th>{isAdmin && <th>Owner</th>}<th /></tr></thead>
            <tbody>
              {shown.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="py-2 font-medium">{v.make} {v.model} <span className="font-normal text-slate-400">{v.color}</span></td>
                  <td>{v.plate}</td><td>{v.year}</td><td>{Number(v.mileage).toLocaleString('en-IN')} km</td>
                  {isAdmin && <td>{v.owner}</td>}
                  <td className="space-x-3 whitespace-nowrap text-right">
                    <button onClick={() => edit(v)} aria-label="Edit vehicle" className="text-slate-400 hover:text-blue-600"><Pencil size={16} /></button>
                    <button onClick={() => del(v.id)} aria-label="Delete vehicle" className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan="6" className="py-4 text-slate-400">{rows.length ? 'No vehicles match your search.' : 'No vehicles yet. Add one above to book a service.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function Vehicles() {
  const { user } = useAuth();
  return user.role === 'admin' ? <AdminVehicles /> : <CustomerVehicles />;
}
