import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, Check, Clock3, Heart, Leaf, LoaderCircle, Phone, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { Booking, BookingDetails, Slot } from './types';

type ApiResult = { ok: boolean; error?: string; slots?: Slot[]; booking?: Booking; confirmationId?: string; message?: string };
const start = new Date(2026, 9, 25);
const end = new Date(2026, 10, 24);
const initialConfirmationId = new URLSearchParams(window.location.search).get('confirmationId') || '';
type Page = 'calendar' | 'booking' | 'confirmation';
const routePage = (pathname: string): Page => pathname.replace(/\/$/, '') === '/booking' ? 'booking' : pathname.replace(/\/$/, '') === '/confirmation' ? 'confirmation' : 'calendar';
const emptyForm: BookingDetails = { name: '', email: '', phone: '', street: '', city: '', state: 'GA', zipCode: '', fullAddress: '', occasion: '', additionalNotes: '', date: '', time: '' };
function readConfirmedBooking(): Booking | null {
  try { return (window.history.state?.booking as Booking | undefined) || JSON.parse(sessionStorage.getItem('confirmedBooking') || 'null') as Booking | null; }
  catch { return null; }
}
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
  const [page, setPage] = useState<Page>(() => routePage(window.location.pathname));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get('date') || '');
  const [mode, setMode] = useState<'book' | 'manage'>(initialConfirmationId ? 'manage' : 'book');
  const [lookup, setLookup] = useState({ confirmationId: initialConfirmationId, email: '' });
  const [booking, setBooking] = useState<Booking | null>(null);
  const [form, setForm] = useState<BookingDetails>(emptyForm);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(readConfirmedBooking);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const available = useMemo(() => new Map(slots.map(s => [s.date, s.available])), [slots]);

  const navigate = (path: string, nextBooking?: Booking) => {
    window.history.pushState(nextBooking ? { booking: nextBooking } : {}, '', path);
    setPage(routePage(window.location.pathname));
    if (nextBooking) setConfirmedBooking(nextBooking);
    setSelected(new URLSearchParams(window.location.search).get('date') || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const refresh = async () => {
    setLoadError('');
    try { const result = await request('/api/availability'); setSlots(result.slots || []); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'We could not load availability.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    const syncRoute = () => {
      setPage(routePage(window.location.pathname));
      setSelected(new URLSearchParams(window.location.search).get('date') || '');
      setConfirmedBooking(readConfirmedBooking());
    };
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const submitBook = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      const phone = form.phone.replace(/\D/g, '');
      if (phone.length !== 10) throw new Error('Enter a 10-digit phone number.');
      const details = { ...form, phone, email: form.email.trim(), fullAddress: `${form.street.trim()}, ${form.city.trim()}, ${form.state} ${form.zipCode.trim()}`, date: selected, time: slotTime(selected) };
      const result = await request('/api/book', details);
      const saved: Booking = { ...(result.booking || details), confirmationId: result.confirmationId || result.booking?.confirmationId || '', status: 'Active' };
      sessionStorage.setItem('confirmedBooking', JSON.stringify(saved));
      setBooking(saved);
      await refresh();
      navigate('/confirmation', saved);
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not save your booking.'); await refresh(); }
    finally { setBusy(false); }
  };
  const findBooking = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try { const result = await request('/api/lookup', lookup); setBooking(result.booking || null); if (result.booking) setForm({ ...result.booking }); }
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
  const header = <header className="topbar"><a className="brand" href="/" aria-label="ASP Temple home"><span className="brand-mark"><Leaf size={19} /></span><span>ASP <i>Temple</i></span></a><div className="top-contact"><Phone size={19} /><span>Questions? Contact <b>Sriram</b> at <strong>832-515-1251</strong></span></div></header>;
  const footer = <footer><span>With devotion, from ASP Temple <Heart size={16} fill="currentColor" /></span><span className="footer-contact">Questions? Contact Sriram at <strong>832-515-1251</strong></span></footer>;

  if (page === 'booking') {
    const dayExists = allDays.some(day => day.date === selected);
    const dateTaken = !loading && dayExists && !isOpen(selected);
    return <main>{header}<section className="step-page"><div className="step-shell"><button className="back-link" type="button" onClick={() => navigate('/')}>← Back to available days</button><div className="step-heading"><span className="section-number">02 / YOUR DETAILS</span><h1>Book your Nama Bhiksha</h1><p>Share the details our home-program team needs to prepare for your visit.</p></div>
      {!dayExists ? <div className="inline-alert error">Choose an available date from the calendar to continue.<button className="button dark" onClick={() => navigate('/')}>View available days</button></div> : dateTaken ? <div className="inline-alert error">That day was just booked. Please choose another available date.<button className="button dark" onClick={() => navigate('/')}>View available days</button></div> : <>
        <div className="booking-summary"><div><span className="summary-label">YOUR SELECTED DAY</span><strong>{fmt(selected)}</strong></div><div><span className="summary-label">SESSION TIME</span><strong>{slotTime(selected)}</strong></div><span className="summary-duration">30 minutes</span></div>
        <form className="booking-form step-form" onSubmit={submitBook}>
          <div className="form-intro"><h2>Host and contact information</h2><p>Fields marked * are required. We’ll send your confirmation and change ID by email.</p></div>
          <div className="form-grid step-form-grid">
            <label>Full name *<input required maxLength={100} autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <label>Email address *<input required type="email" maxLength={180} autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
            <label>Phone number *<input required type="tel" inputMode="numeric" maxLength={14} autoComplete="tel" placeholder="10-digit phone number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></label>
            <label className="span-two">Street address *<input required maxLength={200} autoComplete="street-address" placeholder="123 Bhakti Way" value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></label>
            <label>City *<input required maxLength={100} autoComplete="address-level2" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label>
            <label>State *<select required autoComplete="address-level1" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}>{['GA','AL','TN','NC','SC','FL'].map(state => <option key={state}>{state}</option>)}</select></label>
            <label>ZIP code *<input required maxLength={10} autoComplete="postal-code" value={form.zipCode} onChange={e => setForm({ ...form, zipCode: e.target.value })} /></label>
            <label className="span-two">Occasion / reason *<input required maxLength={120} placeholder="e.g. Housewarming, birthday, or prayer" value={form.occasion} onChange={e => setForm({ ...form, occasion: e.target.value })} /></label>
            <label className="span-three">Additional notes<textarea rows={4} maxLength={2000} placeholder="Any special requests or information for the organizers?" value={form.additionalNotes} onChange={e => setForm({ ...form, additionalNotes: e.target.value })} /></label>
          </div>
          {error && <div className="inline-alert error" role="alert">{error}</div>}
          <div className="form-footer step-form-footer"><span><ShieldCheck size={16} /> Your information is used to coordinate this booking.</span><button className="button dark" disabled={busy}>{busy ? 'Submitting…' : <>Confirm booking <ArrowRight size={17} /></>}</button></div>
        </form>
      </>}</div></section>{footer}</main>;
  }

  if (page === 'confirmation') {
    return <main>{header}<section className="step-page confirmation-page"><div className="step-shell"><div className="confirmation-banner"><span className="confirmation-check"><Check size={26} /></span><span className="section-number">03 / CONFIRMED</span><h1>Your Nama Bhiksha is booked</h1><p>A confirmation email with your change ID is on its way.</p></div>
      {confirmedBooking ? <article className="confirmation-card"><div className="confirmation-id"><span>CONFIRMATION ID</span><strong>{confirmedBooking.confirmationId}</strong></div><div className="confirmation-details"><div><span>Date</span><strong>{fmt(confirmedBooking.date)}</strong></div><div><span>Time</span><strong>{confirmedBooking.time}</strong></div><div><span>Host</span><strong>{confirmedBooking.name}</strong></div><div><span>Email</span><strong>{confirmedBooking.email}</strong></div><div><span>Phone</span><strong>{confirmedBooking.phone}</strong></div><div><span>Home address</span><strong>{confirmedBooking.fullAddress}</strong></div><div><span>Occasion / reason</span><strong>{confirmedBooking.occasion}</strong></div>{confirmedBooking.additionalNotes && <div className="notes-detail"><span>Additional notes</span><strong>{confirmedBooking.additionalNotes}</strong></div>}</div><p className="confirmation-help">Keep your confirmation ID and booking email to manage your reservation. For questions, contact Sriram at <strong>832-515-1251</strong>.</p></article> : <div className="inline-alert">Confirmation details aren’t available in this browser. Check your email for your confirmation ID.</div>}
      <button className="button dark confirmation-home" onClick={() => { setConfirmedBooking(null); sessionStorage.removeItem('confirmedBooking'); navigate('/'); }}>Return to available days</button></div></section>{footer}</main>;
  }

  return <main>
    {header}
    <section className="hero">
      <div className="hero-copy">
        <div className="season-tag"><Sparkles size={14} /> A Kartik Maas offering</div>
        <h1>Kartik Maas<br /><em>Nama Bhiksha</em> 2026</h1>
        <p>Welcome Nama Bhiksha into your home. Choose a day for a 30-minute prayer and chanting session.</p>
        <div className="hero-meta"><span><CalendarDays size={16} /> Oct 25 – Nov 24</span><span><Clock3 size={16} /> One family each day</span></div>
      </div>
      <div className="mantra-widget" aria-label="Hare Rama Mahamantra">
        <p>Hare Rama Hare Rama</p>
        <p>Rama Rama Hare Hare</p>
        <p>Hare Krishna Hare Krishna</p>
        <p>Krishna Krishna Hare Hare</p>
      </div>
    </section>

    <section className="booking-area" id="book">
      <div className="booking-heading"><div><span className="section-number">01 / SELECT A DAY</span><h2>Find your moment</h2><p>Choose an open date to see its available prayer time.</p></div><button className={`manage-toggle ${mode === 'manage' ? 'active' : ''}`} onClick={() => { setMode(mode === 'book' ? 'manage' : 'book'); setError(''); setSuccess(''); setBooking(null); }}>Manage a booking <ArrowRight size={16} /></button></div>

      {mode === 'manage' && !booking && <form className="lookup-panel" onSubmit={findBooking}><div className="lookup-icon"><Search size={20} /></div><div className="lookup-copy"><h3>Find your booking</h3><p>Use the confirmation ID from your email and the email address used to book.</p></div><label>Confirmation ID<input required value={lookup.confirmationId} onChange={e => setLookup({ ...lookup, confirmationId: e.target.value.trim() })} autoComplete="off" /></label><label>Email address<input required type="email" value={lookup.email} onChange={e => setLookup({ ...lookup, email: e.target.value })} /></label><button className="button dark" disabled={busy}>{busy ? 'Looking…' : 'Find booking'}</button></form>}

      {booking && mode === 'manage' && <div className="manage-panel"><div className="manage-summary"><span className="section-number">YOUR BOOKING · {booking.confirmationId}</span><h3>{fmt(booking.date)}</h3><p>{booking.time} <span>·</span> {booking.name}</p></div><div className="manage-actions"><label>Change to another open date<select value={booking.date} onChange={e => void saveChange(e.target.value)} disabled={busy}>{allDays.filter(d => isOpen(d.date) || d.date === booking.date).map(d => <option value={d.date} key={d.date}>{fmt(d.date)} · {d.time}</option>)}</select></label><button className="button danger-outline" onClick={() => void cancelBooking()} disabled={busy}><X size={16} /> Cancel booking</button></div></div>}
      {mode === 'manage' && success && <div className="inline-alert success"><Check size={18} /><div><b>{success}</b></div><button aria-label="Dismiss" onClick={() => setSuccess('')}><X size={16} /></button></div>}
      {mode === 'manage' && error && <div className="inline-alert error"><span>{error}</span><button aria-label="Dismiss" onClick={() => setError('')}><X size={16} /></button></div>}

      {mode === 'book' && <>
        {loading ? <div className="calendar-loading"><LoaderCircle className="spin" size={20} /> Checking available dates…</div> : <div className="months">{months.map(month => <article className="month" key={month.title}><h3>{month.title}</h3><div className="calendar-grid calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{month.days.map((day, index) => { const weekday = fromISO(day.date).getDay(); return <div key={day.date} className={`day-wrap ${index === 0 ? `offset-${weekday}` : ''}`}><button className={`day ${selected === day.date ? 'selected' : ''} ${!isOpen(day.date) ? 'unavailable' : ''}`} disabled={!isOpen(day.date)} onClick={() => { setError(''); setSuccess(''); navigate(`/booking?date=${day.date}`); }} aria-label={`${fmt(day.date)}, ${isOpen(day.date) ? 'available' : 'unavailable'}`}><b>{fromISO(day.date).getDate()}</b><small>{isOpen(day.date) ? 'Open' : 'Taken'}</small></button></div>; })}</div></article>)}</div>}
        {loadError && <div className="inline-alert error"><span>{loadError}</span><button onClick={() => { setLoading(true); void refresh(); }}>Try again</button></div>}
      </>}
    </section>

    <aside className="exception-note"><div className="note-icon"><Clock3 size={18} /></div><div><b>A few special times</b><p>Most days: 4:00–4:30 pm · Mondays: 7:15–7:45 pm · Saturday, Nov 7: 10:00–10:30 am</p></div></aside>
    {footer}
  </main>;
}
