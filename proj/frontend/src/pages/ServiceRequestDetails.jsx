import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, Car, Hash, Calendar, Hourglass, Check } from 'lucide-react';
import { api } from '../api.js';
import { useBase } from '../workspace.jsx';
import { Card, Badge, Select, Btn, Skeleton, useToast } from '../components/ui.jsx';
import { problemId, statusLabel, statusBadge, fmtDateTime, COLUMN_LABEL } from '../serviceUi.js';

const Row = ({ icon: I, k, children }) => <div className="flex items-center justify-between gap-4 border-b border-white/5 py-3 text-sm"><span className="flex items-center gap-2 text-slate-500"><I size={16} aria-hidden="true" />{k}</span><span className="text-right font-medium text-white">{children}</span></div>;

export default function ServiceRequestDetails() {
  const { id } = useParams(), nav = useNavigate(), base = useBase(), toast = useToast();
  const [d, setD] = useState(null), [f, setF] = useState(null), [mechs, setMechs] = useState([]), [err, setErr] = useState(''), [saving, setSaving] = useState(false);
  const fill = (x) => { setD(x); setF({ status: x.column || '', priority: x.priority, mechanic_id: x.mechanic_id || '', notes: x.resolution_notes || '' }); };
  useEffect(() => { api('/service-board/' + id).then(fill).catch((e) => setErr(e.message)); api('/mechanics').then(setMechs).catch(() => {}); }, [id]);
  const back = () => nav(base('/backlog'));

  const update = async () => {
    setSaving(true); setErr('');
    try {
      const r = await api('/service-board/' + id, { method: 'PATCH', body: { status: f.status, priority: f.priority, mechanic_id: f.mechanic_id, resolution_notes: f.notes } });
      toast(r.changed ? 'Service request updated' : 'No changes to save');
      const x = await api('/service-board/' + id); fill(x);
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  if (err && !d) return <div className="space-y-3"><button onClick={back} className="text-cyan-400">← Back to Product Backlog</button><p role="alert" className="text-red-600">{err}</p></div>;
  if (!d || !f) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-80" /></div>;
  const closed = !d.column; // cancelled by the customer: read-only

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={back} aria-label="Back to Product Backlog" className="rounded-xl border border-white/15 p-2 text-white hover:bg-white/5"><ArrowLeft size={18} /></button>
        <div><h1 className="text-2xl font-semibold">Service Request Details</h1><p className="text-sm text-slate-500">View complete details, customer info and update the task status.</p></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-xl font-semibold">{d.title}</h2><p className="text-xs text-slate-500">Problem ID: {problemId(d.id)} · {d.category}</p></div>
            <Badge v={d.priority} label={`${d.priority} priority`} />
          </div>
          <p className="my-4 whitespace-pre-line text-sm text-slate-600">{d.description || 'No description provided.'}</p>
          <Row icon={User} k="Customer">{d.customer}</Row>
          <Row icon={Car} k="Vehicle">{d.make} {d.model}</Row>
          <Row icon={Hash} k="Registration">{d.plate}</Row>
          <Row icon={Calendar} k="Reported On">{fmtDateTime(d.reported_at)}</Row>
          <Row icon={Hourglass} k="Current Status"><Badge v={statusBadge(d)} label={statusLabel(d)} /></Row>
          <h3 className="mb-1 mt-5 text-sm font-semibold">Activity</h3>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-slate-500">{d.history.length ? d.history.map((h) => <li key={h.id}>{h.created_at.slice(5, 16)} · {h.action}{h.actor ? ` (${h.actor})` : ''}</li>) : <li>No activity yet.</li>}</ul>
        </Card>

        <Card className="space-y-4 self-start">
          <h3 className="font-semibold">Actions</h3>
          {closed && <p className="rounded-xl bg-slate-200 px-3 py-2 text-sm text-slate-600">This request was cancelled by the customer and can no longer be changed.</p>}
          <fieldset disabled={closed || saving} className="space-y-4">
            <Select label="Update Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {closed && <option value="">Cancelled</option>}
              {Object.entries(COLUMN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Select label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select>
            <Select label="Assign To" value={f.mechanic_id} onChange={(e) => setF({ ...f, mechanic_id: e.target.value })}><option value="">Unassigned</option>{mechs.map((m) => <option key={m.id} value={m.id}>Technician – {m.name}</option>)}</Select>
            <label className="block text-sm"><span className="text-slate-600">Add Service Notes</span>
              <textarea rows={5} maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Findings, work done, resolution…" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none" /></label>
          </fieldset>
          {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={back} className="flex-1 rounded-xl border border-white/20 px-4 py-2 font-medium text-white hover:bg-white/5">Cancel</button>
            <Btn type="button" onClick={update} disabled={closed || saving} className="flex flex-1 items-center justify-center gap-1"><Check size={16} aria-hidden="true" />{saving ? 'Saving…' : 'Update'}</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
