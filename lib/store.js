'use strict';
/* A JSON file kept in memory and written back safely: temp file + rename, one write at a time, one backup per day. */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const wait = ms => new Promise(r => setTimeout(r, ms));

class JsonFile {
  constructor(file, initial, opts = {}) {
    this.file = file;
    this.backupDir = opts.backupDir || null;
    this.keep = opts.keep || 14;
    this._chain = Promise.resolve();
    this._next = null;
    this._backedUp = '';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      try { this.data = JSON.parse(raw); }
      catch (e) { throw new Error(`Cannot read ${file}: it is not valid JSON (${e.message}). Restore a copy from the backups folder, then start again.`); }
    } else {
      this.data = initial();
    }
  }

  /* Ask for the data to be written. Calls made while a write is waiting share that write. */
  save() {
    if (!this._next) {
      this._next = this._chain.then(() => { this._next = null; return this._write(); });
      this._chain = this._next.catch(err => { console.error('[store] SAVE FAILED for ' + this.file + ':', err.message); });
    }
    return this._next;
  }

  async _write() {
    const json = JSON.stringify(this.data, null, 1);
    if (this.backupDir) await this._backup().catch(err => console.error('[store] backup skipped:', err.message));
    const tmp = this.file + '.tmp';
    await fsp.writeFile(tmp, json, 'utf8');
    for (let i = 0; ; i++) {
      try { await fsp.rename(tmp, this.file); break; }
      catch (e) { if (i >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; await wait(60 * (i + 1)); }
    }
  }

  /* Before the first write of each day, keep yesterday's state as backups/db-YYYY-MM-DD.json. */
  async _backup() {
    const now = new Date();
    const day = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    if (this._backedUp === day) return;
    this._backedUp = day;
    if (!fs.existsSync(this.file)) return;
    await fsp.mkdir(this.backupDir, { recursive: true });
    const dest = path.join(this.backupDir, `db-${day}.json`);
    if (!fs.existsSync(dest)) await fsp.copyFile(this.file, dest);
    const old = (await fsp.readdir(this.backupDir)).filter(f => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const f of old.slice(0, Math.max(0, old.length - this.keep))) await fsp.unlink(path.join(this.backupDir, f)).catch(() => {});
  }

  flushSync() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1), 'utf8');
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { JsonFile };
