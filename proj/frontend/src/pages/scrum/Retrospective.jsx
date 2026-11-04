import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, Select, Btn, Alert } from '../../components/ui.jsx';

const EMPTY = { went_well: '', not_well: '', improve: '' };
const area = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100';

export default function Retrospective() {
  const { user } = useAuth(), isAdmin = user.role === 'admin';
  const [sprints, setSprints] = useState(null), [sel, setSel] = useState(null), [rows, setRows] = useState([]), [f, setF] = useState(EMPTY), [msg, setMsg] = useState({});
  useEffect(() => {
    api('/scrum/sprints').then((all) => { const done = all.filter((s) => s.status === 'completed'); setSprints(done); setSel(done[0]?.id ?? null); }).catch((e) => { setSprints([]); setMsg({ m: e.message }); });
  }, []);
  const load = () => (sel ? api('/scrum/retros?sprint_id=' + sel).then(setRows).catch((e) => setMsg({ m: e.message })) : setRows([]));
  useEffect(() => { setF(EMPTY); load(); }, [sel]);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try { await api('/scrum/retros', { method: 'POST', body: { ...f, sprint_id: sel } }); setMsg({ m: 'Retrospective feedback saved', ok: 1 }); setF(EMPTY); load(); }
    catch (x) { setMsg({ m: x.message }); }
  };
  const improve = async (r) => {
    try { await api(`/scrum/retros/${r.id}/improvement`, { method: 'POST' }); setMsg({ m: 'Improvement task added to the Product Backlog', ok: 1 }); load(); }
    catch (x) { setMsg({ m: x.message }); }
  };

  if (!sprints) return <p className="text-slate-500">Loading…</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sprint Retrospective</h1>
      {!sprints.length ? <Card><p className="text-slate-500">Retrospectives open after a sprint is completed. No sprint has been completed yet.</p></Card> : (
        <>
          <div className="max-w-sm"><Select label="Completed sprint" value={sel || ''} onChange={(e) => setSel(Number(e.target.value))}>
            {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select></div>
          <Card>
            <h3 className="mb-1 font-semibold">Your feedback</h3>
            <p className="mb-3 text-sm text-slate-500">Submitting again replaces your earlier answer.</p>
            <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
              <label className="block text-sm"><span className="text-slate-600">What went well?</span><textarea rows={3} required maxLength={500} className={area} value={f.went_well} onChange={on('went_well')} /></label>
              <label className="block text-sm"><span className="text-slate-600">What did not go well?</span><textarea rows={3} required maxLength={500} className={area} value={f.not_well} onChange={on('not_well')} /></label>
              <label className="block text-sm"><span className="text-slate-600">What should be improved?</span><textarea rows={3} required maxLength={500} className={area} value={f.improve} onChange={on('improve')} /></label>
              <div className="lg:col-span-3"><Btn>Submit feedback</Btn></div>
            </form>
            <div className="mt-3"><Alert msg={msg.m} ok={msg.ok} /></div>
          </Card>
          <div className="space-y-3">
            <h2 className="text-xl font-bold">Team feedback</h2>
            {rows.map((r) => (
              <Card key={r.id} className="space-y-1 text-sm">
                <p className="font-semibold">{r.name}</p>
                <p><b className="text-emerald-700">Went well:</b> {r.went_well}</p>
                <p><b className="text-red-600">Did not go well:</b> {r.not_well}</p>
                <p><b className="text-blue-700">Improve:</b> {r.improve}</p>
                {isAdmin && (r.improvement_id
                  ? <p className="pt-1 text-xs text-emerald-700">Improvement task created in the Product Backlog (#{r.improvement_id})</p>
                  : <button className="pt-1 text-blue-600 hover:underline" onClick={() => improve(r)}>Create improvement task</button>)}
              </Card>
            ))}
            {!rows.length && <Card><p className="text-slate-400">No feedback for this sprint yet.</p></Card>}
          </div>
        </>
      )}
    </div>
  );
}
