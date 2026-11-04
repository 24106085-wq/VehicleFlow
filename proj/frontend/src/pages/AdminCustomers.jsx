import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api.js';
import { Card, Field, Btn, Badge, Alert, inr } from '../components/ui.jsx';

function Detail({ id, onSaved, close }) {
  const [d, setD] = useState(null), [f, setF] = useState({ name: '', phone: '', address: '' }), [msg, setMsg] = useState({});
  useEffect(() => { api('/admin/customers/' + id).then((x) => { setD(x); setF({ name: x.name, phone: x.phone || '', address: x.address || '' }); }).catch((e) => setMsg({ m: e.message })); }, [id]);
  const save = async (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return setMsg({ m: 'Name must be at least 2 characters' });
    if (f.phone && !/^[0-9+\-\s]{7,20}$/.test(f.phone)) return setMsg({ m: 'Enter a valid phone number' });
    try { await api('/admin/customers/' + id, { method: 'PUT', body: f }); setMsg({ m: 'Customer saved', ok: 1 }); onSaved(); } catch (x) { setMsg({ m: x.message }); }
  };
  if (!d) return <Card><Alert msg={msg.m} /><p className="text-slate-400">Loading…</p></Card>;
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between"><h3 className="font-semibold">{d.name} <span className="font-normal text-slate-500">· {d.email}</span></h3><button onClick={close} className="text-sm text-slate-500 hover:underline">Close</button></div>
      <form onSubmit={save} noValidate className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Field label="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        <div><Btn className="!py-1.5 text-sm">Save customer</Btn></div>
      </form>
      <Alert msg={msg.m} ok={msg.ok} />
      <div className="grid gap-4 lg:grid-cols-2 text-sm">
        <div><h4 className="mb-1 font-semibold">Vehicles ({d.vehicles.length})</h4>
          <ul className="space-y-1">{d.vehicles.map((v) => <li key={v.id}>{v.plate} · {v.make} {v.model} ({v.year})</li>)}{!d.vehicles.length && <li className="text-slate-400">None</li>}</ul></div>
        <div><h4 className="mb-1 font-semibold">Service history ({d.bookings.length})</h4>
          <ul className="space-y-1">{d.bookings.map((b) => <li key={b.id} className="flex items-center gap-2">#{b.id} {b.category} · {b.plate} <Badge v={b.status} /> {inr(b.final_cost ?? b.estimated_cost)}</li>)}{!d.bookings.length && <li className="text-slate-400">None</li>}</ul></div>
      </div>
    </Card>
  );
}

export default function AdminCustomers() {
  const [rows, setRows] = useState([]), [s, setS] = useState(''), [sort, setSort] = useState('name'), [only, setOnly] = useState(''), [sel, setSel] = useState(null), [err, setErr] = useState('');
  const load = () => api('/admin/customers').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const shown = useMemo(() => {
    const t = s.trim().toLowerCase();
    const by = { name: (a, b) => a.name.localeCompare(b.name), spent: (a, b) => b.spent - a.spent, bookings: (a, b) => b.bookings - a.bookings, newest: (a, b) => b.id - a.id };
    return rows.filter((c) => (!t || `${c.name} ${c.email} ${c.phone || ''}`.toLowerCase().includes(t)) && (only !== 'active' || c.active > 0)).sort(by[sort]);
  }, [rows, s, sort, only]);
  const sc = 'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm';
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Customers</h1>
      <Card className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={s} onChange={(e) => setS(e.target.value)} placeholder="Search name, email, phone" aria-label="Search customers" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" /></label>
        <select aria-label="Filter" className={sc} value={only} onChange={(e) => setOnly(e.target.value)}><option value="">All customers</option><option value="active">With active services</option></select>
        <select aria-label="Sort" className={sc} value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">Name A–Z</option><option value="spent">Most spent</option><option value="bookings">Most bookings</option><option value="newest">Newest</option></select>
      </Card>
      {err && <p className="text-red-600">{err}</p>}
      {sel && <Detail key={sel} id={sel} onSaved={load} close={() => setSel(null)} />}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500"><tr><th className="py-2">Customer</th><th>Phone</th><th>Vehicles</th><th>Bookings</th><th>Active</th><th>Spent</th><th /></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-2"><p className="font-medium">{c.name}</p><p className="text-slate-400">{c.email}</p></td>
                  <td>{c.phone || '—'}</td><td>{c.vehicles}</td><td>{c.bookings}</td><td>{c.active}</td><td>{inr(c.spent)}</td>
                  <td className="text-right"><button className="text-blue-600 hover:underline" onClick={() => { setSel(c.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>View / edit</button></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan="7" className="py-4 text-slate-400">No customers found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
