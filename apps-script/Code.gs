const CFG = { sheet: 'Sheet1', title: 'Kartik Maas Nama Bhiksha 2026', start: '2026-10-25', end: '2026-11-24', tz: 'America/New_York', headers: ['confirmation_id','created_at','updated_at','status','name','email','phone','date','time'] };

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents || '{}');
    const secret = PropertiesService.getScriptProperties().getProperty('BFF_SHARED_TOKEN') || '';
    if (!safeEqual_(String(p.token || ''), secret)) throw new Error('Unauthorized request.');
    const actions = { availability: availability_, book: book_, lookup: lookup_, update: update_, cancel: cancel_ };
    if (!actions[p.action]) throw new Error('Unknown booking action.');
    return json_(Object.assign({ ok: true }, actions[p.action](p)));
  } catch (err) { return json_({ ok: false, error: err.message || 'Request could not be completed.' }); }
}

function initializeBookingSheet() {
  const s = sheet_(), h = CFG.headers, current = s.getRange(1, 1, 1, h.length).getDisplayValues()[0];
  if (current.some(String)) { if (current.join('|') !== h.join('|')) throw new Error('Sheet1 is not empty and its headers do not match.'); return 'Already initialized.'; }
  s.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#35684b').setFontColor('#ffffff');
  s.setFrozenRows(1); s.setColumnWidths(1, h.length, 145); s.setColumnWidth(5, 210); s.setColumnWidth(6, 230);
  return 'Booking sheet initialized.';
}

function availability_() {
  const taken = {}; active_().forEach(r => taken[String(r[7])] = true);
  const slots = [];
  for (let d = new Date(2026, 9, 25); d <= new Date(2026, 10, 24); d.setDate(d.getDate() + 1)) {
    const date = key_(d); slots.push({ date: date, label: date, time: time_(date), available: !taken[date] });
  }
  return { slots: slots };
}

function book_(p) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  let b;
  try {
    const x = details_(p); validDate_(x.date);
    if (active_().some(r => String(r[7]) === x.date)) throw new Error('That date was just taken. Choose another available date.');
    const id = newId_(), now = new Date().toISOString(), time = time_(x.date);
    b = { confirmationId: id, name: x.name, email: x.email, phone: x.phone, date: x.date, time: time, status: 'Active' };
    sheet_().appendRow([id, now, now, 'Active', x.name, x.email, x.phone, x.date, time]);
  } finally { lock.releaseLock(); }
  mail_(b, 'New booking', 'confirmed'); return { booking: b, confirmationId: b.confirmationId };
}

function lookup_(p) { return { booking: booking_(find_(p).values) }; }

function update_(p) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  let b;
  try {
    const found = find_(p), r = found.values;
    const x = details_({ name: p.name || r[4], email: r[5], phone: p.phone || r[6], date: p.date || r[7] }); validDate_(x.date);
    if (x.date !== String(r[7]) && active_().some(row => String(row[7]) === x.date)) throw new Error('That date is already taken. Choose another available date.');
    const time = time_(x.date);
    sheet_().getRange(found.row, 3, 1, 7).setValues([[new Date().toISOString(), 'Active', x.name, x.email, x.phone, x.date, time]]);
    b = { confirmationId: String(r[0]), name: x.name, email: x.email, phone: x.phone, date: x.date, time: time, status: 'Active' };
  } finally { lock.releaseLock(); }
  mail_(b, 'Booking updated', 'updated'); return { booking: b };
}

function cancel_(p) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  let b;
  try {
    const f = find_(p), r = f.values;
    sheet_().getRange(f.row, 3, 1, 2).setValues([[new Date().toISOString(), 'Cancelled']]);
    b = booking_(r); b.status = 'Cancelled';
  } finally { lock.releaseLock(); }
  mail_(b, 'Booking cancelled', 'cancelled'); return { message: 'Booking cancelled.' };
}

function find_(p) {
  const id = String(p.confirmationId || '').trim().toLowerCase(), email = String(p.email || '').trim().toLowerCase();
  if (!id || !email) throw new Error('Enter your confirmation ID and booking email.');
  const v = sheet_().getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]).toLowerCase() === id && String(v[i][5]).trim().toLowerCase() === email) {
    if (String(v[i][3]) !== 'Active') throw new Error('This booking is no longer active.');
    return { row: i + 1, values: v[i] };
  }
  throw new Error('No active booking found. Check the confirmation ID and email.');
}

function booking_(r) { return { confirmationId: String(r[0]), name: String(r[4]), email: String(r[5]), phone: String(r[6]), date: String(r[7]), time: String(r[8]), status: String(r[3]) }; }
function active_() { return sheet_().getDataRange().getValues().slice(1).filter(r => String(r[3]) === 'Active'); }
function details_(p) {
  const x = { name: String(p.name || '').trim().replace(/\s+/g, ' '), email: String(p.email || '').trim().toLowerCase(), phone: String(p.phone || '').trim(), date: String(p.date || '').trim() };
  if (x.name.length < 2 || x.name.length > 100) throw new Error('Enter your name (2–100 characters).');
  if (x.email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email)) throw new Error('Enter a valid email address.');
  if (x.phone.length < 7 || x.phone.length > 30) throw new Error('Enter a valid phone number.'); return x;
}
function validDate_(s) { const d = new Date(s + 'T12:00:00'); if (!/^2026-\d{2}-\d{2}$/.test(s) || key_(d) !== s || s < CFG.start || s > CFG.end) throw new Error('Choose a valid date between October 25 and November 24, 2026.'); }
function time_(s) { const d = new Date(s + 'T12:00:00'); return s === '2026-11-07' ? '10:00 AM – 10:30 AM' : d.getDay() === 1 ? '7:15 PM – 7:45 PM' : '4:00 PM – 4:30 PM'; }
function mail_(b, event, action) {
  const props = PropertiesService.getScriptProperties();
  const adminRecipients = (props.getProperty('ADMIN_NOTIFICATION_EMAILS') || props.getProperty('ADMIN_NOTIFICATION_EMAIL') || Session.getEffectiveUser().getEmail()).split(/[;,]/).map(email => email.trim()).filter(Boolean);
  const appUrl = props.getProperty('BOOKING_APP_URL') || '';
  const manageUrl = appUrl ? appUrl + '?confirmationId=' + encodeURIComponent(b.confirmationId) : '';
  const detail = [event, '', 'Confirmation ID: ' + b.confirmationId, 'Name: ' + b.name, 'Email: ' + b.email, 'Phone: ' + b.phone, 'Date: ' + b.date, 'Time: ' + b.time, 'Status: ' + b.status].join('\n');
  const button = manageUrl ? '<p><a style="display:inline-block;padding:11px 16px;background:#35684b;color:#fff;text-decoration:none;border-radius:8px" href="' + manageUrl + '">Open booking page</a></p>' : '';
  const safe = function (s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); };
  const adminHtml = '<div style="font-family:Arial,sans-serif;color:#25312b"><h2>' + safe(event) + '</h2><p><b>Confirmation ID:</b> ' + safe(b.confirmationId) + '<br><b>Name:</b> ' + safe(b.name) + '<br><b>Email:</b> ' + safe(b.email) + '<br><b>Phone:</b> ' + safe(b.phone) + '<br><b>Date:</b> ' + safe(b.date) + '<br><b>Time:</b> ' + safe(b.time) + '<br><b>Status:</b> ' + safe(b.status) + '</p>' + button + '</div>';
  try { if (adminRecipients.length) MailApp.sendEmail({ to: adminRecipients.join(','), subject: event + ': ' + b.date + ' · ' + CFG.title, body: detail, htmlBody: adminHtml }); } catch (err) { console.error('Admin notice failed: ' + err); }
  const intro = action === 'cancelled' ? 'Your booking has been cancelled.' : action === 'updated' ? 'Your booking is updated.' : 'Your Nama Bhiksha booking is confirmed.';
  const body = ['Radhe Radhe ' + b.name + ',', '', intro, '', 'Date: ' + Utilities.formatDate(new Date(b.date + 'T12:00:00'), CFG.tz, 'EEEE, MMMM d, yyyy'), 'Time: ' + b.time, 'Confirmation ID: ' + b.confirmationId, '', action === 'cancelled' ? 'The date is available again.' : 'Keep this ID and your booking email to change or cancel your booking.', '', 'Questions? Contact Sriram at 832-515-1251.', '', 'With devotion,', 'ASP Temple'].join('\n');
  const guestHtml = '<div style="font-family:Arial,sans-serif;max-width:600px;color:#25312b;line-height:1.6"><p>Radhe Radhe ' + safe(b.name) + ',</p><p>' + safe(intro) + '</p><p><b>Date:</b> ' + safe(Utilities.formatDate(new Date(b.date + 'T12:00:00'), CFG.tz, 'EEEE, MMMM d, yyyy')) + '<br><b>Time:</b> ' + safe(b.time) + '<br><b>Confirmation ID:</b> ' + safe(b.confirmationId) + '</p><p>' + (action === 'cancelled' ? 'The date is available again.' : 'Keep this ID and your booking email to change or cancel your booking.') + '</p>' + button + '<p>Questions? Contact Sriram at 832-515-1251.</p><p>With devotion,<br>ASP Temple</p></div>';
  try { MailApp.sendEmail({ to: b.email, subject: 'Nama Bhiksha booking ' + action + ' · ' + CFG.title, body: body, htmlBody: guestHtml }); } catch (err) { console.error('Confirmation email failed: ' + err); }
}
function newId_() { const a = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 8; i++) s += a.charAt(Math.floor(Math.random() * a.length)); return s; }
function sheet_() { const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.sheet); if (!s) throw new Error('Booking sheet not found.'); return s; }
function key_(d) { return Utilities.formatDate(d, CFG.tz, 'yyyy-MM-dd'); }
function safeEqual_(a, b) { if (!b || a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }
function json_(x) { return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON); }
