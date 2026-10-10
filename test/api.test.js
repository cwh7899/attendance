const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'attendance-test-'));
const app = require('../server');

let server, base;
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); }); }));
after(() => { server.close(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); });

const json = (method, url, body, headers = {}) =>
  fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body && JSON.stringify(body) });

test('full attendance flow', async () => {
  let res = await json('POST', '/api/sessions', { title: 'Team meeting' });
  assert.equal(res.status, 201);
  const { id, adminKey } = await res.json();
  const admin = { 'x-admin-key': adminKey };

  res = await json('GET', `/api/sessions/${id}`);
  const pub = await res.json();
  assert.equal(pub.title, 'Team meeting');
  assert.equal(pub.adminKey, undefined, 'admin key must not leak');

  res = await json('POST', `/api/sessions/${id}/checkin`, { name: '  Ada   Lovelace ' });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).attendee.name, 'Ada Lovelace');

  res = await json('POST', `/api/sessions/${id}/checkin`, { name: 'ada lovelace' });
  assert.equal(res.status, 409, 'duplicate names are rejected');

  res = await json('POST', `/api/sessions/${id}/checkin`, { name: '=HYPERLINK("x")' });
  assert.equal(res.status, 201);

  res = await json('GET', `/api/sessions/${id}/admin`);
  assert.equal(res.status, 403, 'admin view requires key');

  res = await json('GET', `/api/sessions/${id}/admin`, null, admin);
  const full = await res.json();
  assert.equal(full.attendees.length, 2);
  assert.match(full.checkinUrl, new RegExp(`/s/${id}$`));

  res = await fetch(`${base}/api/sessions/${id}/export.csv`, { headers: admin });
  const csv = await res.text();
  assert.match(csv, /"Ada Lovelace"/);
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/, 'formula injection is neutralised');

  res = await json('DELETE', `/api/sessions/${id}/attendees/${full.attendees[1].id}`, null, admin);
  assert.equal(res.status, 204);

  res = await json('PATCH', `/api/sessions/${id}`, { open: false }, admin);
  assert.equal((await res.json()).open, false);
  res = await json('POST', `/api/sessions/${id}/checkin`, { name: 'Late Larry' });
  assert.equal(res.status, 403, 'closed sessions reject check-ins');

  res = await fetch(`${base}/api/sessions/${id}/qr.svg`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<svg/);
});
