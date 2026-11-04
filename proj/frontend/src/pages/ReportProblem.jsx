import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, UploadCloud, X, Car } from 'lucide-react';
import { api } from '../api.js';
import { useBase } from '../workspace.jsx';
import { Btn, Skeleton, useToast } from '../components/ui.jsx';
import { PROBLEM_CATEGORIES } from '../lib.js';

const EMPTY = { vehicle_id: '', category_id: '', title: '', priority: 'medium', description: '' };
const MAX = 5 * 1024 * 1024;
const input = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none';
const readB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('Could not read the image')); r.readAsDataURL(file); });

export default function ReportProblem() {
  const base = useBase(), nav = useNavigate(), toast = useToast();
  const [vehicles, setVehicles] = useState(null), [cats, setCats] = useState([]), [loadErr, setLoadErr] = useState('');
  const [f, setF] = useState(EMPTY), [errs, setErrs] = useState({}), [formErr, setFormErr] = useState('');
  const [file, setFile] = useState(null), [preview, setPreview] = useState(''), [busy, setBusy] = useState(false), [drag, setDrag] = useState(false);
  const pick = useRef(null);

  useEffect(() => {
    Promise.all([api('/vehicles'), api('/categories')])
      .then(([v, c]) => { setVehicles(v); setCats(PROBLEM_CATEGORIES.map((n) => c.find((x) => x.name === n)).filter(Boolean)); })
      .catch((e) => setLoadErr(e.message));
  }, []);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const on = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrs({ ...errs, [k]: '' }); };
  const setImage = (fl) => {
    if (!fl) return;
    if (!['image/png', 'image/jpeg'].includes(fl.type)) return setErrs({ ...errs, image: 'Only PNG or JPG images are allowed' });
    if (fl.size > MAX) return setErrs({ ...errs, image: 'Image must be 5 MB or smaller' });
    setErrs({ ...errs, image: '' }); setFile(fl); setPreview(URL.createObjectURL(fl));
  };
  const clearImage = () => { setFile(null); setPreview(''); if (pick.current) pick.current.value = ''; };

  const validate = () => {
    const e = {};
    if (!f.vehicle_id) e.vehicle_id = 'Select a vehicle';
    if (!f.category_id) e.category_id = 'Select a category';
    if (f.title.trim().length < 3) e.title = 'Enter a title (at least 3 characters)';
    if (f.description.trim().length < 10) e.description = 'Describe the problem (at least 10 characters)';
    return e;
  };
  const submit = async (ev) => {
    ev.preventDefault();
    if (busy) return; // prevents duplicate submissions
    const e = validate(); setErrs(e); setFormErr('');
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const body = { ...f, title: f.title.trim(), description: f.description.trim() };
      if (file) body.image = { type: file.type, name: file.name, data: await readB64(file) };
      await api('/problems', { method: 'POST', body });
      toast('Problem submitted. Our team will review it shortly.');
      nav(base('/problems'));
    } catch (x) { setFormErr(x.message); toast(x.message, 'error'); setBusy(false); }
  };

  const err = (k) => errs[k] && <span role="alert" className="mt-1 block text-xs text-red-400">{errs[k]}</span>;
  const border = (k) => (errs[k] ? 'border-red-400/60' : '');

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Report a Vehicle Problem</h1>
        <p className="text-sm text-slate-500">Tell us what’s wrong with your vehicle and we’ll take care of it.</p>
      </div>
      {loadErr && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-100 px-3 py-2 text-sm text-red-700">{loadErr}</p>}
      {!vehicles && !loadErr && <Skeleton className="h-96" />}
      {vehicles?.length === 0 && (
        <div className="vf-card grid place-items-center gap-3 px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-300"><Car size={28} /></span>
          <h2 className="text-lg font-semibold">Add a vehicle first</h2>
          <p className="max-w-sm text-sm text-slate-500">You need a registered vehicle before you can report a problem.</p>
          <Link to={base('/vehicles')} className="vf-btn px-4 py-2 font-medium">Go to My Vehicles</Link>
        </div>
      )}
      {vehicles?.length > 0 && (
        <form onSubmit={submit} noValidate className="vf-card grid gap-5 p-6 lg:grid-cols-2">
          <label className="block text-sm"><span className="text-slate-600">Select Vehicle <b className="text-red-400">*</b></span>
            <select value={f.vehicle_id} onChange={on('vehicle_id')} className={`${input} ${border('vehicle_id')}`}>
              <option value="">Choose a vehicle</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>)}
            </select>{err('vehicle_id')}</label>
          <label className="block text-sm"><span className="text-slate-600">Problem Category <b className="text-red-400">*</b></span>
            <select value={f.category_id} onChange={on('category_id')} className={`${input} ${border('category_id')}`}>
              <option value="">Choose a category</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>{err('category_id')}</label>
          <label className="block text-sm"><span className="text-slate-600">Problem Title <b className="text-red-400">*</b></span>
            <input value={f.title} onChange={on('title')} maxLength={100} placeholder="e.g. Engine noise" className={`${input} ${border('title')}`} />{err('title')}</label>
          <label className="block text-sm"><span className="text-slate-600">Priority <b className="text-red-400">*</b></span>
            <select value={f.priority} onChange={on('priority')} className={input}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select></label>
          <label className="block text-sm"><span className="text-slate-600">Problem Description <b className="text-red-400">*</b></span>
            <textarea value={f.description} onChange={on('description')} maxLength={1000} rows={6} placeholder="Describe what you are noticing, and when it happens" className={`${input} resize-none ${border('description')}`} />{err('description')}</label>
          <div className="text-sm">
            <span className="text-slate-600">Upload Image (Optional)</span>
            <input ref={pick} type="file" accept="image/png,image/jpeg" className="sr-only" id="problem-image" onChange={(e) => setImage(e.target.files[0])} />
            {preview ? (
              <div className="relative mt-1 grid h-[10.5rem] place-items-center overflow-hidden rounded-xl border border-[var(--line)] bg-black/20">
                <img src={preview} alt="Selected upload preview" className="max-h-full max-w-full object-contain" />
                <button type="button" onClick={clearImage} aria-label="Remove image" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-red-500"><X size={16} /></button>
              </div>
            ) : (
              <label htmlFor="problem-image" onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); setImage(e.dataTransfer.files[0]); }}
                className={`mt-1 grid h-[10.5rem] cursor-pointer place-items-center rounded-xl border border-dashed text-center transition ${drag ? 'border-cyan-400 bg-cyan-400/10' : 'border-cyan-400/40 hover:bg-cyan-400/5'}`}>
                <span><UploadCloud className="mx-auto mb-2 text-slate-200" size={30} /><span className="block text-slate-300">Click to upload or drag &amp; drop</span><span className="block text-xs text-slate-500">PNG, JPG (Max 5 MB)</span></span>
              </label>
            )}
            {err('image')}
          </div>
          {formErr && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-100 px-3 py-2 text-sm text-red-700 lg:col-span-2">{formErr}</p>}
          <div className="flex justify-end gap-3 lg:col-span-2">
            <button type="button" onClick={() => nav(base('/'))} disabled={busy} className="rounded-xl border border-[var(--line)] px-5 py-2 text-white hover:bg-white/5">Cancel</button>
            <Btn disabled={busy} className="flex items-center gap-2"><Send size={16} />{busy ? 'Submitting…' : 'Submit Problem'}</Btn>
          </div>
        </form>
      )}
    </>
  );
}
