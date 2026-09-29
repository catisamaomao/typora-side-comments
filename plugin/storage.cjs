'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const Core = require('./core.js');
const LIMIT = 8 * 1024 * 1024;
const hash = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
function coded(code, message) { return Object.assign(new Error(message), { code }); }
async function regular(file, missing = false) {
  try { const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) throw coded('UNSAFE_FILE', '批注路径不是普通文件。'); return stat; }
  catch (e) { if (missing && e.code === 'ENOENT') return null; throw e; }
}
async function sidecar(documentPath) {
  if (typeof documentPath !== 'string' || !path.isAbsolute(documentPath)) throw coded('UNSAVED', '请先保存 Markdown 文档，再添加批注。');
  await regular(documentPath);
  return documentPath + '.comments.json';
}
async function readRaw(file) {
  const stat = await regular(file, true);
  if (!stat) return null;
  if (stat.size > LIMIT) throw coded('TOO_LARGE', '批注文件超过 8 MB，已停止读取。');
  return fs.readFile(file, 'utf8');
}
async function read(documentPath) {
  const file = await sidecar(documentPath);
  const raw = await readRaw(file);
  if (raw === null) return { data: Core.empty(path.basename(documentPath)), token: null };
  let data;
  try { data = Core.validate(JSON.parse(raw)); }
  catch (e) { throw coded('CORRUPT', '无法读取批注文件：' + e.message + ' 可检查同目录的 .bak 备份。'); }
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
  catch (e) { if (e.code === 'EEXIST') throw coded('BUSY', '另一个窗口正在保存批注，或存在中断留下的锁文件。请稍后重试；不要在保存期间删除锁。'); throw e; }
  const id = crypto.randomUUID();
  const temporary = file + '.' + id + '.tmp';
  const backupTemporary = file + '.' + id + '.bak.tmp';
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, time: new Date().toISOString() }));
    const old = await readRaw(file);
    const token = old === null ? null : hash(old);
    if (token !== expectedToken) throw coded('CONFLICT', '批注已被另一个窗口或程序修改。请保留输入内容，重新加载批注后再保存。');
    const next = { ...data, revision: id, document: { name: path.basename(documentPath) } };
    const raw = JSON.stringify(next, null, 2) + '\n';
    if (Buffer.byteLength(raw, 'utf8') > LIMIT) throw coded('TOO_LARGE', '批注文件将超过 8 MB，未写入。');
    await writeSynced(temporary, raw);
    if (old !== null) {
      await regular(file + '.bak', true);
      await writeSynced(backupTemporary, old);
      await fs.rename(backupTemporary, file + '.bak');
    }
    // Recheck just before replacement, including external editors which do not use our lock.
    const latest = await readRaw(file);
    if ((latest === null ? null : hash(latest)) !== expectedToken) throw coded('CONFLICT', '保存时发现批注文件发生变化，已取消覆盖。');
    await fs.rename(temporary, file);
    return { data: next, token: hash(raw) };
  } finally {
    await lock.close();
    await Promise.all([temporary, backupTemporary, lockPath].map(f => fs.unlink(f).catch(e => { if (e.code !== 'ENOENT') console.warn('[Side Comments] cleanup:', e.code); })));
  }
}
module.exports = { read, save, hash, sidecar };
