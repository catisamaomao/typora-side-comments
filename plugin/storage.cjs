'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const Core = require('./core.js');
const LIMIT = 8 * 1024 * 1024;
const hash = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
function coded(code, i18nKey = code) { return Object.assign(new Error(i18nKey), { code, i18nKey }); }
async function regular(file, missing = false) {
  try { const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) throw coded('UNSAFE_FILE', 'UNSAFE_FILE'); return stat; }
  catch (e) { if (missing && e.code === 'ENOENT') return null; throw e; }
}
async function sidecar(documentPath) {
  if (typeof documentPath !== 'string' || !path.isAbsolute(documentPath)) throw coded('UNSAVED', 'UNSAVED');
  await regular(documentPath);
  return documentPath + '.comments.json';
}
async function readRaw(file) {
  const stat = await regular(file, true);
  if (!stat) return null;
  if (stat.size > LIMIT) throw coded('TOO_LARGE', 'READ_TOO_LARGE');
  return fs.readFile(file, 'utf8');
}
async function read(documentPath) {
  const file = await sidecar(documentPath);
  const raw = await readRaw(file);
  if (raw === null) return { data: Core.empty(path.basename(documentPath)), token: null };
  let data;
  try { data = Core.validate(JSON.parse(raw)); }
  catch (e) { throw Object.assign(coded('CORRUPT'), { cause: e }); }
  return { data, token: hash(raw) };
}
async function writeSynced(file, raw) {
  const handle = await fs.open(file, 'wx', 0o600);
  try { await handle.writeFile(raw, 'utf8'); await handle.sync(); } finally { await handle.close(); }
}
async function save(documentPath, data, expectedToken) {
  Core.validate(data);
  const file = await sidecar(documentPath);
  const lockPath = file + '.lock';
  let lock;
  try { lock = await fs.open(lockPath, 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') throw coded('BUSY', 'BUSY'); throw e; }
  const id = crypto.randomUUID();
  const temporary = file + '.' + id + '.tmp';
  const backupTemporary = file + '.' + id + '.bak.tmp';
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, time: new Date().toISOString() }));
    const old = await readRaw(file);
    const token = old === null ? null : hash(old);
    if (token !== expectedToken) throw coded('CONFLICT', 'CONFLICT');
    const next = { ...data, revision: id, document: { name: path.basename(documentPath) } };
    const raw = JSON.stringify(next, null, 2) + '\n';
    if (Buffer.byteLength(raw, 'utf8') > LIMIT) throw coded('TOO_LARGE', 'WRITE_TOO_LARGE');
    await writeSynced(temporary, raw);
    if (old !== null) {
      await regular(file + '.bak', true);
      await writeSynced(backupTemporary, old);
      await fs.rename(backupTemporary, file + '.bak');
    }
    // Recheck just before replacement, including external editors which do not use our lock.
    const latest = await readRaw(file);
    if ((latest === null ? null : hash(latest)) !== expectedToken) throw coded('CONFLICT', 'SAVE_CONFLICT');
    await fs.rename(temporary, file);
    return { data: next, token: hash(raw) };
  } finally {
    await lock.close();
    await Promise.all([temporary, backupTemporary, lockPath].map(f => fs.unlink(f).catch(e => { if (e.code !== 'ENOENT') console.warn('[Side Comments] cleanup:', e.code); })));
  }
}
module.exports = { read, save, hash, sidecar };
