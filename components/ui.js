'use client';

// ---- dates and numbers -------------------------------------------------
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const fmtD = (d, o) => d.toLocaleDateString(undefined, o);
const at = s => new Date(s + 'T00:00');
export const short = s => fmtD(at(s), { day: 'numeric', month: 'short', year: 'numeric' });
export const shortDay = s => fmtD(at(s), { day: 'numeric', month: 'short' });
export const daysBetween = (a, b) => Math.round((at(b) - at(a)) / 864e5);
export const sum = a => a.reduce((t, x) => t + (x.amt || 0), 0);

// Weekly periods run Monday to Sunday and are keyed by their Monday; monthly ones by YYYY-MM.
export function period(type, off) {
  const f = d => fmtD(d, { day: 'numeric', month: 'short' });
  if (type === 'annual') {
    const year = new Date().getFullYear() + off;
    return { key: String(year), label: String(year) };
  }
  if (type === 'weekly') {
    const a = new Date(); a.setDate(a.getDate() - (a.getDay() + 6) % 7 + off * 7);
    const b = new Date(a); b.setDate(b.getDate() + 6);
    return { key: ymd(a), label: `${f(a)} – ${f(b)}` };
  }
  const n = new Date(), d = new Date(n.getFullYear(), n.getMonth() + off, 1);
  return { key: ymd(d).slice(0, 7), label: fmtD(d, { month: 'long', year: 'numeric' }) };
}

// Read a form's values, run fn, then clear the form.
export const submit = fn => e => {
  e.preventDefault();
  const f = e.currentTarget;
  fn(Object.fromEntries(new FormData(f)));
  f.reset();
};

// ---- small shared components -------------------------------------------
const ICONS = {
  ov: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  work: 'M3 7h18v13H3zM8 7V4h8v3M3 12h18M10 12v2h4v-2',
  clients: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M16 4.2a3.5 3.5 0 0 1 0 6.6M17.5 15h1A3.5 3.5 0 0 1 22 18.5V20',
  diary: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5zM4 4.5v16M8 6h8M8 10h8M8 14h5',
  view: 'M3 5h8v6H3zM13 5h8v6h-8zM3 13h8v6H3zM13 13h8v6h-8z',
  grid: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  list: 'M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  cal: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  goals: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  proj: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
  money: 'M3 6h18v12H3zM3 10h18M7 15h3',
  set: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  check: 'M20 6L9 17l-5-5',
};
export const Icon = ({ n }) => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[n]} /></svg>
);

export const Empty = ({ children }) => <div className="empty"><Icon n="check" /><p>{children}</p></div>;

// Segmented control for switching between sibling views.
export const Seg = ({ items, value, onChange }) => (
  <div className="seg" role="tablist">
    {items.map(i => (
      <button key={i.id} role="tab" aria-selected={value === i.id} className={value === i.id ? 'on' : ''} onClick={() => onChange(i.id)}>
        {i.label}{i.count != null && <span className="ct">{i.count}</span>}
      </button>
    ))}
  </div>
);

// A summary figure that is also a button into its detail view.
export const Hub = ({ title, big, note, onClick }) => (
  <button className="hub" onClick={onClick}>
    <span className="hl">{title}</span><b>{big}</b><small>{note}</small><i className="go" aria-hidden="true">›</i>
  </button>
);

export const More = ({ n, onClick, children }) => n > 0 ? <button className="more" onClick={onClick}>{children || `${n} more`} ›</button> : null;
