import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Field, Btn, Alert, Stat, inr } from '../components/ui.jsx';
import { Car, CalendarCheck, IndianRupee } from 'lucide-react';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', password: '' }), [msg, setMsg] = useState({});
  const [d, setD] = useState(null);
  useEffect(() => { if (user.role === 'customer') api('/dashboard').then(setD).catch(() => {}); }, []);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return setMsg({ m: 'Name must be at least 2 characters' });
    if (f.phone && !/^[0-9+\-\s]{7,20}$/.test(f.phone)) return setMsg({ m: 'Enter a valid phone number' });
    if (f.password && f.password.length < 8) return setMsg({ m: 'Password must be at least 8 characters' });
    try { const d = await api('/auth/me', { method: 'PUT', body: f }); setUser(d.user); setF({ ...f, password: '' }); setMsg({ m: 'Profile saved', ok: 1 }); }
    catch (x) { setMsg({ m: x.message }); }
  };
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Profile and settings</h1>
      {d?.stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Vehicles" value={d.stats.vehicles} icon={Car} />
          <Stat label="Completed" value={d.stats.completed} icon={CalendarCheck} tone="green" />
          <Stat label="Total spent" value={inr(d.stats.spent)} icon={IndianRupee} tone="cyan" />
        </div>
      )}
      <Card>
        <form onSubmit={save} className="space-y-4">
          <Alert msg={msg.m} ok={msg.ok} />
          <Field label="Email" value={user.email} disabled />
          <Field label="Full name" required value={f.name} onChange={on('name')} />
          <Field label="Phone" value={f.phone} onChange={on('phone')} />
          <Field label="New password (leave blank to keep current)" type="password" minLength={8} value={f.password} onChange={on('password')} />
          <Btn>Save changes</Btn>
        </form>
      </Card>
    </div>
  );
}
