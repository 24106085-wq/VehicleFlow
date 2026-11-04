import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, Field, Select, Btn, Alert } from '../../components/ui.jsx';

const EMPTY = { yesterday: '', today_plan: '', blockers: '' };
const area = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100';

export default function DailyScrum() {
  const { user } = useAuth(), isAdmin = user.role === 'admin';
  const [f, setF] = useState(EMPTY), [rows, setRows] = useState([]), [team, setTeam] = useState([]);
  const [date, setDate] = useState(''), [who, setWho] = useState(''), [msg, setMsg] = useState({});
  const load = () => {
    const qs = new URLSearchParams(); if (date) qs.set('date', date); if (who) qs.set('user_id', who);
    return api('/scrum/daily?' + qs).then(setRows).catch((e) => setMsg({ m: e.message }));
  };
  useEffect(() => { load(); }, [date, who]);
  useEffect(() => { if (isAdmin) api('/scrum/team').then(setTeam).catch(() => {}); }, []);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try { await api('/scrum/daily', { method: 'POST', body: f }); setMsg({ m: "Today's update saved", ok: 1 }); setF(EMPTY); load(); }
    catch (x) { setMsg({ m: x.message }); }
  };
  const byDate = rows.reduce((g, r) => { const d = r.scrum_date.slice(0, 10); (g[d] = g[d] || []).push(r); return g; }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Daily Scrum</h1>
      <Card>
        <h3 className="mb-1 font-semibold">Your update for today</h3>
        <p className="mb-3 text-sm text-slate-500">Submitting again today replaces your earlier answer.</p>
        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
          <label className="block text-sm"><span className="text-slate-600">What did I complete yesterday?</span><textarea rows={3} required maxLength={500} className={area} value={f.yesterday} onChange={on('yesterday')} /></label>
          <label className="block text-sm"><span className="text-slate-600">What will I do today?</span><textarea rows={3} required maxLength={500} className={area} value={f.today_plan} onChange={on('today_plan')} /></label>
          <label className="block text-sm"><span className="text-slate-600">Are there any blockers?</span><textarea rows={3} maxLength={500} className={area} value={f.blockers} onChange={on('blockers')} placeholder="Leave empty if none" /></label>
          <div className="lg:col-span-3"><Btn>Submit update</Btn></div>
        </form>
        <div className="mt-3"><Alert msg={msg.m} ok={msg.ok} /></div>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="mr-auto text-xl font-bold">{isAdmin ? 'Team updates' : 'My updates'}</h2>
          <div className="w-44"><Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {isAdmin && <div className="w-48"><Select label="Team member" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Everyone</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></div>}
        </div>
        {Object.entries(byDate).map(([d, list]) => (
          <div key={d} className="space-y-2">
            <h3 className="font-semibold text-slate-700">{d}</h3>
            {list.map((r) => (
              <Card key={r.id} className="space-y-1 text-sm">
                <p className="font-semibold">{r.name}</p>
                <p><b className="text-slate-500">Yesterday:</b> {r.yesterday}</p>
                <p><b className="text-slate-500">Today:</b> {r.today_plan}</p>
                <p><b className="text-slate-500">Blockers:</b> <span className={r.blockers !== 'None' ? 'font-medium text-red-600' : ''}>{r.blockers}</span></p>
              </Card>
            ))}
          </div>
        ))}
        {!rows.length && <Card><p className="text-slate-400">No Daily Scrum updates found.</p></Card>}
      </div>
    </div>
  );
}
