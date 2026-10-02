import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, Check, Clock3, Heart, Leaf, LoaderCircle, Mail, MapPin, Phone, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { Booking, Slot } from './types';

type ApiResult = { ok: boolean; error?: string; slots?: Slot[]; booking?: Booking; confirmationId?: string; message?: string };
const start = new Date(2026, 9, 25);
const end = new Date(2026, 10, 24);
const initialConfirmationId = new URLSearchParams(window.location.search).get('confirmationId') || '';
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (s: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) => fromISO(s).toLocaleDateString('en-US', opts);
const allDays = Array.from({ length: Math.round((end.getTime() - start.getTime()) / 86400000) + 1 }, (_, i) => {
  const date = new Date(2026, 9, 25 + i);
  const key = iso(date);
  const time = key === '2026-11-07' ? '10:00 AM – 10:30 AM' : date.getDay() === 1 ? '7:15 PM – 7:45 PM' : '4:00 PM – 4:30 PM';
  return { date: key, label: fmt(key, { weekday: 'short', day: 'numeric' }), time };
});
const months = [
  { title: 'October 2026', days: allDays.filter(d => d.date.startsWith('2026-10')) },
  { title: 'November 2026', days: allDays.filter(d => d.date.startsWith('2026-11')) }
];

async function request(url: string, data?: unknown): Promise<ApiResult> {
  const response = await fetch(url, { method: data ? 'POST' : 'GET', headers: data ? { 'Content-Type': 'application/json' } : undefined, body: data ? JSON.stringify(data) : undefined });
  const json = await response.json() as ApiResult;
  if (!response.ok || !json.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
  return json;
}

export default function App() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState<'book' | 'manage'>(initialConfirmationId ? 'manage' : 'book');
  const [lookup, setLookup] = useState({ confirmationId: initialConfirmationId, email: '' });
  const [booking, setBooking] = useState<Booking | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const available = useMemo(() => new Map(slots.map(s => [s.date, s.available])), [slots]);

  const refresh = async () => {
    setLoadError('');
    try { const result = await request('/api/availability'); setSlots(result.slots || []); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'We could not load availability.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const reset = () => { setSuccess(''); setError(''); setBooking(null); setLookup({ confirmationId: '', email: '' }); setMode('book'); };
  const submitBook = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      const result = await request('/api/book', { ...form, date: selected });
      setSuccess(`Your Nama Bhiksha is reserved for ${fmt(selected)} at ${slotTime(selected)}. A confirmation email is on its way.`);
      setBooking({ confirmationId: result.confirmationId || '', ...form, date: selected, time: slotTime(selected), status: 'Active' });
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not save your booking.'); await refresh(); }
    finally { setBusy(false); }
  };
  const findBooking = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try { const result = await request('/api/lookup', lookup); setBooking(result.booking || null); if (result.booking) setForm({ name: result.booking.name, email: result.booking.email, phone: result.booking.phone }); }
    catch (err) { setError(err instanceof Error ? err.message : 'We could not find that booking.'); }
    finally { setBusy(false); }
  };
  const saveChange = async (date = booking?.date) => {
    if (!booking || !date) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await request('/api/update', { confirmationId: booking.confirmationId, email: booking.email, name: form.name, phone: form.phone, date });
      setBooking({ ...booking, ...form, date, time: slotTime(date) }); setSuccess(`Your booking is updated to ${fmt(date)} at ${slotTime(date)}. A confirmation email is on its way.`); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not update your booking.'); }
    finally { setBusy(false); }
  };
  const cancelBooking = async () => {
    if (!booking || !window.confirm('Cancel this Nama Bhiksha booking? The date will become available again.')) return;
    setBusy(true); setError('');
    try { await request('/api/cancel', { confirmationId: booking.confirmationId, email: booking.email }); setBooking(null); setSuccess('Your booking is cancelled. The date is available again.'); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'We could not cancel your booking.'); }
    finally { setBusy(false); }
  };
  const slotTime = (date: string) => allDays.find(d => d.date === date)?.time || '';
  const isOpen = (date: string) => available.get(date) ?? true;

  return <main>
    <header className="topbar"><a className="brand" href="/" aria-label="ASP Temple home"><span className="brand-mark"><Leaf size={19} /></span><span>ASP <i>Temple</i></span></a><a className="top-contact" href="tel:+18325151251"><Phone size={15} /> Questions? <b>Sriram</b></a></header>
    <section className="hero">
      <div className="hero-copy">
        <div className="season-tag"><Sparkles size={14} /> A Kartik Maas offering</div>
        <h1>Kartik Maas<br /><em>Nama Bhiksha</em> 2026</h1>
        <p>Welcome Nama Bhiksha into your home. Choose a day for a 30-minute prayer and chanting session.</p>
        <div className="hero-meta"><span><CalendarDays size={16} /> Oct 25 – Nov 24</span><span><Clock3 size={16} /> One family each day</span></div>
      </div>
      <div className="hero-art" aria-label="Decorative illustration of a diya lamp"><div className="sun-halo"></div><div className="sun-ring"></div><div className="diya"><span className="flame"></span><span className="diya-bowl"></span><span className="diya-base"></span></div><div className="art-caption"><span>ॐ</span> A moment of devotion, shared</div></div>
    </section>

    <section className="details-strip" aria-label="Booking details"><div><span className="detail-icon"><Clock3 size={18} /></span><span><b>30 minutes</b><small>One booking per day</small></span></div><div><span className="detail-icon"><MapPin size={18} /></span><span><b>At your home</b><small>Choose any available day</small></span></div><div><span className="detail-icon"><Mail size={18} /></span><span><b>Confirmation by email</b><small>Includes your change ID</small></span></div></section>

    <section className="booking-area" id="book">
      <div className="booking-heading"><div><span className="section-number">01 / SELECT A DAY</span><h2>Find your moment</h2><p>Choose an open date to see its available prayer time.</p></div><button className={`manage-toggle ${mode === 'manage' ? 'active' : ''}`} onClick={() => { setMode(mode === 'book' ? 'manage' : 'book'); setError(''); setSuccess(''); setBooking(null); }}>Manage a booking <ArrowRight size={16} /></button></div>

      {mode === 'manage' && !booking && <form className="lookup-panel" onSubmit={findBooking}><div className="lookup-icon"><Search size={20} /></div><div className="lookup-copy"><h3>Find your booking</h3><p>Use the confirmation ID from your email and the email address used to book.</p></div><label>Confirmation ID<input required value={lookup.confirmationId} onChange={e => setLookup({ ...lookup, confirmationId: e.target.value.trim() })} autoComplete="off" /></label><label>Email address<input required type="email" value={lookup.email} onChange={e => setLookup({ ...lookup, email: e.target.value })} /></label><button className="button dark" disabled={busy}>{busy ? 'Looking…' : 'Find booking'}</button></form>}

      {booking && mode === 'manage' && <div className="manage-panel"><div className="manage-summary"><span className="section-number">YOUR BOOKING · {booking.confirmationId}</span><h3>{fmt(booking.date)}</h3><p>{booking.time} <span>·</span> {booking.name}</p></div><div className="manage-actions"><label>Change to another open date<select value={booking.date} onChange={e => void saveChange(e.target.value)} disabled={busy}>{allDays.filter(d => isOpen(d.date) || d.date === booking.date).map(d => <option value={d.date} key={d.date}>{fmt(d.date)} · {d.time}</option>)}</select></label><button className="button danger-outline" onClick={() => void cancelBooking()} disabled={busy}><X size={16} /> Cancel booking</button></div></div>}
      {mode === 'manage' && success && <div className="inline-alert success"><Check size={18} /><div><b>{success}</b></div><button aria-label="Dismiss" onClick={() => setSuccess('')}><X size={16} /></button></div>}
      {mode === 'manage' && error && <div className="inline-alert error"><span>{error}</span><button aria-label="Dismiss" onClick={() => setError('')}><X size={16} /></button></div>}

      {mode === 'book' && <>
        {loading ? <div className="calendar-loading"><LoaderCircle className="spin" size={20} /> Checking available dates…</div> : <div className="months">{months.map(month => <article className="month" key={month.title}><h3>{month.title}</h3><div className="calendar-grid calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{month.days.map((day, index) => { const weekday = fromISO(day.date).getDay(); return <div key={day.date} className={`day-wrap ${index === 0 ? `offset-${weekday}` : ''}`}><button className={`day ${selected === day.date ? 'selected' : ''} ${!isOpen(day.date) ? 'unavailable' : ''}`} disabled={!isOpen(day.date)} onClick={() => { setSelected(day.date); setError(''); setSuccess(''); }} aria-label={`${fmt(day.date)}, ${isOpen(day.date) ? 'available' : 'unavailable'}`}><b>{fromISO(day.date).getDate()}</b><small>{isOpen(day.date) ? 'Open' : 'Taken'}</small></button></div>; })}</div></article>)}</div>}
        {loadError && <div className="inline-alert error"><span>{loadError}</span><button onClick={() => { setLoading(true); void refresh(); }}>Try again</button></div>}
        {selected && <div className="selected-slot"><span className="slot-calendar"><CalendarDays size={20} /></span><div><small>YOUR SELECTED DATE</small><b>{fmt(selected)}</b></div><span className="slot-time">{slotTime(selected)}</span><Check className="slot-check" size={19} /></div>}

        {success && <div className="inline-alert success"><Check size={18} /><div><b>{success}</b>{booking?.confirmationId && <p>Your confirmation ID: <strong>{booking.confirmationId}</strong> · Save this ID to edit or cancel later.</p>}</div><button aria-label="Dismiss" onClick={reset}><X size={16} /></button></div>}
        {error && <div className="inline-alert error"><span>{error}</span><button aria-label="Dismiss" onClick={() => setError('')}><X size={16} /></button></div>}

        {selected && !booking && <form className="booking-form" onSubmit={submitBook}><div className="form-intro"><h3>Who will we welcome?</h3><p>Enter your contact details. Your confirmation and change ID will arrive by email.</p></div><div className="form-grid"><label>Full name<input required maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label><label>Email address<input required type="email" maxLength={180} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label><label>Phone number<input required type="tel" maxLength={30} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label></div><div className="form-footer"><span><ShieldCheck size={16} /> Your details are only used for this booking.</span><button className="button dark" disabled={busy || !isOpen(selected)}>{busy ? 'Reserving…' : <>Reserve this day <ArrowRight size={17} /></>}</button></div></form>}
      </>}
    </section>

    <aside className="exception-note"><div className="note-icon"><Clock3 size={18} /></div><div><b>A few special times</b><p>Most days: 4:00–4:30 pm · Mondays: 7:15–7:45 pm · Saturday, Nov 7: 10:00–10:30 am</p></div></aside>
    <footer><span>With devotion, from ASP Temple <Heart size={13} fill="currentColor" /></span><a href="tel:+18325151251">Questions? Sriram · 832-515-1251</a></footer>
  </main>;
}
