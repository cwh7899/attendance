// Minimal JSON-file persistence: one file per session in ./data (or $DATA_DIR).
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const cache = new Map();
const file = (id) => path.join(DATA_DIR, `${id}.json`);

function get(id) {
  if (!/^[\w-]+$/.test(id)) return null;
  if (cache.has(id)) return cache.get(id);
  try {
    const session = JSON.parse(fs.readFileSync(file(id), 'utf8'));
    cache.set(id, session);
    return session;
  } catch {
    return null;
  }
}

function save(session) {
  cache.set(session.id, session);
  // Write to a temp file then rename so a crash never leaves a half-written file.
  const tmp = `${file(session.id)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(session, null, 2));
  fs.renameSync(tmp, file(session.id));
}

module.exports = { get, save };
