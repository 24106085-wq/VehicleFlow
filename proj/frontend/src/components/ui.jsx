import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

const BADGE = {
  pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-blue-100 text-blue-700', in_progress: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-emerald-100 text-emerald-700', delivered: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-slate-200 text-slate-600',
  low: 'bg-emerald-100 text-emerald-700', medium: 'bg-amber-100 text-amber-700', high: 'bg-red-100 text-red-700',
  todo: 'bg-slate-200 text-slate-700', review: 'bg-violet-100 text-violet-700', done: 'bg-emerald-100 text-emerald-700',
  planned: 'bg-blue-100 text-blue-700', active: 'bg-cyan-100 text-cyan-700', open: 'bg-slate-200 text-slate-700', in_sprint: 'bg-blue-100 text-blue-700',
  available: 'bg-emerald-100 text-emerald-700', busy: 'bg-amber-100 text-amber-700', off: 'bg-slate-200 text-slate-600',
};
const TONE = {
  blue: 'bg-blue-100 text-blue-600', cyan: 'bg-cyan-100 text-cyan-600', amber: 'bg-amber-100 text-amber-600', green: 'bg-emerald-100 text-emerald-600',
};
const input = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100';

export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* Animated counter: numbers and strings like "₹12,500" count up on mount; anything else renders as-is. */
export function CountUp({ value }) {
  const m = typeof value === 'string' ? value.match(/^(\D*)([\d,]+)(\D*)$/) : null;
  const target = typeof value === 'number' ? value : m ? Number(m[2].replace(/,/g, '')) : null;
  const [n, setN] = useState(target === null || reduced() ? target : 0);
  useEffect(() => {
    if (target === null || reduced()) { setN(target); return undefined; }
    let raf; const t0 = performance.now(), dur = 900;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  if (target === null) return value;
  if (typeof value === 'number') return n;
  return `${m[1]}${n.toLocaleString(m[1].includes('₹') ? 'en-IN' : 'en-US')}${m[3]}`;
}

export const Card = ({ className = '', children }) => <div className={`vf-card p-5 ${className}`}>{children}</div>;
export const Stat = ({ label, value, icon: Icon, tone = 'blue' }) => (
  <Card className="flex items-center gap-4">
    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TONE[tone]}`}><Icon size={20} /></div>
    <div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-semibold text-white"><CountUp value={value} /></p></div>
  </Card>
);
export const Badge = ({ v, label }) => (
  <span className={`whitespace-nowrap rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium capitalize ${BADGE[v] || ''}`}>{label || String(v).replace('_', ' ')}</span>
);
export const Field = ({ label, ...p }) => (<label className="block text-sm"><span className="text-slate-600">{label}</span><input {...p} className={input} /></label>);
export const Select = ({ label, children, ...p }) => (<label className="block text-sm"><span className="text-slate-600">{label}</span><select {...p} className={input}>{children}</select></label>);
export const Btn = ({ className = '', ...p }) => <button {...p} className={`vf-btn px-4 py-2 font-medium disabled:opacity-50 ${className}`} />;

export const Skeleton = ({ className = 'h-24' }) => <div className={`skeleton ${className}`} aria-hidden="true" />;
export const DashboardSkeleton = () => (
  <div className="space-y-6" role="status" aria-label="Loading">
    <Skeleton className="h-8 w-64" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
    <Skeleton className="h-64" />
  </div>
);

/* Toasts */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);
  const dismiss = useCallback((i) => setItems((l) => l.filter((t) => t.id !== i)), []);
  const push = useCallback((msg, type = 'success') => {
    const i = ++id.current;
    setItems((l) => [...l.slice(-3), { id: i, msg, type }]);
    setTimeout(() => dismiss(i), 4000);
  }, [dismiss]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className="toast pointer-events-auto flex items-start gap-3 rounded-xl border border-cyan-400/30 bg-[#0a2042] p-3 text-sm text-white shadow-2xl">
            {t.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-red-400" />}
            <span className="flex-1">{t.msg}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-white"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* Success messages become toasts; errors stay inline so forms keep their context. */
export function Alert({ msg, ok }) {
  const toast = useToast();
  useEffect(() => { if (msg && ok) toast(msg, 'success'); }, [msg, ok]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!msg || ok) return null;
  return <p role="alert" className="rounded-xl border border-red-400/30 bg-red-100 px-3 py-2 text-sm text-red-700">{msg}</p>;
}

/* Accessible modal: Esc / backdrop click closes, focus moves into the dialog and returns on close. */
export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const first = ref.current?.querySelector('input,select,textarea,button:not([data-close])');
    (first || ref.current)?.focus();
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll('a[href],button:not(:disabled),input,select,textarea')];
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#061329]/80 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`modal-panel relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl border border-cyan-400/25 bg-[#0a2042] p-6 shadow-2xl outline-none`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button type="button" data-close onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
