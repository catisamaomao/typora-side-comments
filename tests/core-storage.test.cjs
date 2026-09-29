'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const Core = require('../plugin/core.js');
const Store = require('../plugin/storage.cjs');
const anchor = (s, q, offset = s.indexOf(q)) => Core.createAnchor(s, offset, offset + q.length, Store.hash(s));
const locate = (a, s) => Core.locate(a, s, Store.hash(s));
function data(text = '这是一段用于测试的正文。') { const d = Core.empty('demo.md'); d.comments.push({ id: crypto.randomUUID(), body: '请补充说明。', status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), anchor: anchor(text, '正文') }); return d; }
test('unchanged document preserves the exact selected occurrence', () => {
  const s = '相同文字。\n\n相同文字。'; const at = s.lastIndexOf('相同'); assert.equal(locate(anchor(s, '相同', at), s).start, at);
});
test('distant insertion relocates using both contexts', () => {
  const s = 'a'.repeat(90) + '目标文字' + 'b'.repeat(90); const a = anchor(s, '目标文字');
  assert.equal(locate(a, '新增章节\n\n' + s).start, a.start + 6);
});
test('deletion does not attach to unrelated equal text', () => {
  const s = '甲段的目标文字在这里。\n\n乙段的目标文字在另一处。'; const a = anchor(s, '目标文字'); assert.equal(locate(a, s.replace('甲段的目标文字在这里。', '')).status, 'detached');
});
test('original duplicate full contexts never become a false unique target', () => {
  const p = 'a'.repeat(64) + 'Q' + 'b'.repeat(64); const s = p + '\n\n' + p; const a = anchor(s, 'Q');
  assert.equal(a.contextUnique, false); assert.equal(locate(a, s.replace('Q', 'R')).status, 'ambiguous');
});
test('changed adjacent context asks for reassociation', () => { const s = '前文目标后文'; assert.equal(locate(anchor(s, '目标'), '前言目标后文').status, 'detached'); });
test('deleted target stays detached; undo restores it', () => { const s = '前文目标后文'; const a = anchor(s, '目标'); assert.equal(locate(a, '前文后文').status, 'detached'); assert.equal(locate(a, s).status, 'attached'); });
test('emoji and rich-text projection use UTF-16 offsets consistently', () => { const s = '前😊批注🚀后'; const a = anchor(s, '批注🚀'); assert.equal(s.slice(locate(a, s).start, locate(a, s).end), '批注🚀'); });
test('empty and oversized ranges are rejected', () => { assert.throws(() => anchor('   ', ' ')); assert.throws(() => anchor('x'.repeat(4001), 'x'.repeat(4001))); });
test('schema rejects duplicate IDs, bad status, and broken anchors', () => {
  const d = data(); assert.equal(Core.validate(d), d); const duplicate = structuredClone(d); duplicate.comments.push(duplicate.comments[0]); assert.throws(() => Core.validate(duplicate));
  const bad = structuredClone(d); bad.comments[0].status = 'unknown'; assert.throws(() => Core.validate(bad)); bad.comments[0].status = 'open'; bad.comments[0].anchor.contextUnique = undefined; assert.throws(() => Core.validate(bad));
});
test('roundtrip, backup, conflict protection and unchanged Markdown', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'typora-comments-test-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const doc = path.join(dir, '测试 文档.md'); const original = '# 用户的正文\r\n保持原始字节。'; await fs.writeFile(doc, original);
  const fresh = await Store.read(doc); assert.equal(fresh.token, null); const one = await Store.save(doc, data(), null); const read = await Store.read(doc); assert.deepEqual(read, one);
  const twoData = structuredClone(one.data); twoData.comments[0].body = '第二版批注'; const two = await Store.save(doc, twoData, one.token);
  const backup = JSON.parse(await fs.readFile(doc + '.comments.json.bak', 'utf8')); assert.equal(backup.comments[0].body, '请补充说明。');
  await assert.rejects(Store.save(doc, one.data, one.token), { code: 'CONFLICT' }); assert.equal((await Store.read(doc)).token, two.token); assert.equal(await fs.readFile(doc, 'utf8'), original);
  assert.equal((await fs.readdir(dir)).some(x => x.endsWith('.lock') || x.endsWith('.tmp')), false);
});
test('multiple plugin windows cannot lose a completed save', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'typora-comments-concurrency-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const doc = path.join(dir, 'x.md'); await fs.writeFile(doc, 'x'); const outcomes = await Promise.allSettled([Store.save(doc, data(), null), Store.save(doc, data(), null)]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1); assert.equal(outcomes.filter(x => x.status === 'rejected').length, 1); assert.equal((await Store.read(doc)).data.comments.length, 1);
});
test('corrupt data is never silently reset and creates no new sidecar', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'typora-comments-corrupt-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const doc = path.join(dir, 'x.md'); await fs.writeFile(doc, 'x'); const file = doc + '.comments.json'; await fs.writeFile(file, '{bad');
  await assert.rejects(Store.read(doc), { code: 'CORRUPT' }); await assert.rejects(Store.save(doc, data(), null), { code: 'CONFLICT' }); assert.equal(await fs.readFile(file, 'utf8'), '{bad');
});
test('stale lock fails safely with actionable instructions', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'typora-comments-lock-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const doc = path.join(dir, 'x.md'); await fs.writeFile(doc, 'x'); await fs.writeFile(doc + '.comments.json.lock', '{}'); await assert.rejects(Store.save(doc, data(), null), { code: 'BUSY' });
});
test('missing documents and oversized sidecars are refused', async t => {
  await assert.rejects(Store.read('relative.md'), { code: 'UNSAVED' });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'typora-comments-limit-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const doc = path.join(dir, 'x.md'); await fs.writeFile(doc, 'x'); await fs.writeFile(doc + '.comments.json', 'x'.repeat(8 * 1024 * 1024 + 1)); await assert.rejects(Store.read(doc), { code: 'TOO_LARGE' });
});
