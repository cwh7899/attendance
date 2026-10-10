const express = require('express');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
// Public base URL used inside QR codes (e.g. https://attendance.example.com).
// Falls back to the host of the incoming request.
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const id = (bytes) => crypto.randomBytes(bytes).toString('base64url');
const baseUrl = (req) => PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

// Strip admin-only fields before sending a session to attendees.
const publicView = (s) => ({ id: s.id, title: s.title, open: s.open, createdAt: s.createdAt });

function requireAdmin(req, res, next) {
  const session = store.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const key = req.get('x-admin-key') || req.query.key;
  if (!key || !safeEqual(key, session.adminKey)) {
    return res.status(403).json({ error: 'Invalid admin key' });
  }
  req.session = session;
  next();
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// Create a new attendance session.
app.post('/api/sessions', (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 120);
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const session = {
    id: id(6),
    adminKey: id(18),
    title,
    open: true,
    createdAt: new Date().toISOString(),
    attendees: [],
  };
  store.save(session);
  res.status(201).json({ id: session.id, adminKey: session.adminKey });
});

// Public info for the check-in page.
app.get('/api/sessions/:id', (req, res) => {
  const session = store.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(publicView(session));
});

// Attendee check-in.
app.post('/api/sessions/:id/checkin', (req, res) => {
  const session = store.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!session.open) return res.status(403).json({ error: 'This session is closed' });

  const name = String(req.body.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your full name' });

  const existing = session.attendees.find((a) => a.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: `${existing.name} is already checked in`, attendee: existing });
  }

  const attendee = { id: id(6), name, time: new Date().toISOString() };
  session.attendees.push(attendee);
  store.save(session);
  res.status(201).json({ attendee });
});

// Admin: full session details with attendee list.
app.get('/api/sessions/:id/admin', requireAdmin, (req, res) => {
  const s = req.session;
  res.json({ ...publicView(s), attendees: s.attendees, checkinUrl: `${baseUrl(req)}/s/${s.id}` });
});

// Admin: open/close the session or rename it.
app.patch('/api/sessions/:id', requireAdmin, (req, res) => {
  const s = req.session;
  if (typeof req.body.open === 'boolean') s.open = req.body.open;
  if (typeof req.body.title === 'string' && req.body.title.trim()) s.title = req.body.title.trim().slice(0, 120);
  store.save(s);
  res.json(publicView(s));
});

// Admin: remove an attendee (e.g. a typo or prank entry).
app.delete('/api/sessions/:id/attendees/:attendeeId', requireAdmin, (req, res) => {
  const s = req.session;
  const i = s.attendees.findIndex((a) => a.id === req.params.attendeeId);
  if (i === -1) return res.status(404).json({ error: 'Attendee not found' });
  s.attendees.splice(i, 1);
  store.save(s);
  res.status(204).end();
});

// Admin: CSV export.
app.get('/api/sessions/:id/export.csv', requireAdmin, (req, res) => {
  const s = req.session;
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  // Prefix formula-like values so spreadsheets don't execute them.
  const cell = (v) => esc(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
  const rows = [['#', 'Name', 'Checked in at (UTC)'].map(esc).join(',')];
  s.attendees.forEach((a, i) => rows.push([esc(i + 1), cell(a.name), esc(a.time)].join(',')));
  const filename = s.title.replace(/[^\w-]+/g, '_').slice(0, 60) || 'attendance';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send('﻿' + rows.join('\r\n'));
});

// QR code (SVG) pointing to the check-in page. Public: it only encodes the public URL.
app.get('/api/sessions/:id/qr.svg', async (req, res) => {
  const session = store.get(req.params.id);
  if (!session) return res.status(404).end();
  const svg = await QRCode.toString(`${baseUrl(req)}/s/${session.id}`, { type: 'svg', margin: 1, width: 512 });
  res.type('image/svg+xml').send(svg);
});

// Page routes.
app.get('/s/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'checkin.html')));
app.get('/admin/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

if (require.main === module) {
  app.listen(PORT, () => console.log(`Attendance app running at http://localhost:${PORT}`));
}

module.exports = app;
