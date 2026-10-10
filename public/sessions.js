// Remembers sessions this browser created (and their admin keys) in localStorage.
window.MySessions = {
  list() {
    try { return JSON.parse(localStorage.getItem('mySessions') || '[]'); } catch { return []; }
  },
  add(session) {
    const all = this.list().filter((s) => s.id !== session.id);
    all.unshift(session);
    try { localStorage.setItem('mySessions', JSON.stringify(all.slice(0, 50))); } catch {}
  },
  keyFor(id) {
    const s = this.list().find((s) => s.id === id);
    return s && s.key;
  },
};
