/* Typora Side Comments — original implementation, MIT license. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TyporaSideCommentsCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FORMAT = 'typora-side-comments';
  const MAX_COMMENT = 12000;
  const CONTEXT = 64;
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function contextMatches(anchor, text) {
    const matches = [];
    for (let at = text.indexOf(anchor.quote); at !== -1; at = text.indexOf(anchor.quote, at + 1)) {
      const end = at + anchor.quote.length;
      const before = anchor.prefix ? text.slice(Math.max(0, at - anchor.prefix.length), at) === anchor.prefix : at === 0;
      const after = anchor.suffix ? text.slice(end, end + anchor.suffix.length) === anchor.suffix : end === text.length;
      if (before && after) matches.push({ start: at, end });
      if (matches.length > 1) break;
    }
    return matches;
  }
  function createAnchor(text, start, end, digest) {
    assert(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= text.length && end > start, '无效的正文选区。');
    const quote = text.slice(start, end);
    assert(quote.trim() && quote.length <= 4000, '请选择 1 至 4000 个字符的正文。');
    const anchor = { quote, prefix: text.slice(Math.max(0, start - CONTEXT), start), suffix: text.slice(end, end + CONTEXT), start, end, digest };
    anchor.contextUnique = contextMatches(anchor, text).length === 1;
    return anchor;
  }
  function locate(anchor, text, digest) {
    if (anchor.digest === digest && text.slice(anchor.start, anchor.end) === anchor.quote) {
      return { status: 'attached', start: anchor.start, end: anchor.end };
    }
    // A duplicate originally present must not become a false unique match after deletion.
    if (!anchor.contextUnique) return { status: 'ambiguous' };
    const candidates = contextMatches(anchor, text);
    if (candidates.length > 1) return { status: 'ambiguous' };
    return candidates.length === 1 ? { status: 'attached', ...candidates[0] } : { status: 'detached' };
  }
  function validate(data) {
    assert(data && data.format === FORMAT && data.version === 1, '批注文件格式不兼容；原文件未修改。');
    assert(typeof data.revision === 'string' && data.revision.length <= 100, '批注文件缺少版本信息。');
    assert(Array.isArray(data.comments) && data.comments.length <= 5000, '批注数量超出限制或数据损坏。');
    const ids = new Set();
    for (const c of data.comments) {
      assert(c && typeof c.id === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(c.id) && !ids.has(c.id), '批注编号重复或无效。'); ids.add(c.id);
      assert(typeof c.body === 'string' && c.body.trim() && c.body.length <= MAX_COMMENT, '批注内容无效。');
      assert(c.status === 'open' || c.status === 'resolved', '批注状态无效。');
      assert(typeof c.createdAt === 'string' && Number.isFinite(Date.parse(c.createdAt)) && typeof c.updatedAt === 'string' && Number.isFinite(Date.parse(c.updatedAt)), '批注时间无效。');
      const a = c.anchor;
      assert(a && typeof a.quote === 'string' && a.quote.trim() && a.quote.length <= 4000, '批注原文无效。');
      assert(typeof a.prefix === 'string' && a.prefix.length <= CONTEXT && typeof a.suffix === 'string' && a.suffix.length <= CONTEXT, '批注上下文无效。');
      assert(Number.isInteger(a.start) && a.start >= 0 && Number.isInteger(a.end) && a.end - a.start === a.quote.length, '批注范围无效。');
      assert(typeof a.digest === 'string' && /^[a-f0-9]{64}$/.test(a.digest), '批注指纹无效。');
      assert(typeof a.contextUnique === 'boolean', '批注上下文唯一性信息无效。');
    }
    return data;
  }
  function empty(name) { return { format: FORMAT, version: 1, revision: '', document: { name }, comments: [] }; }
  return { FORMAT, MAX_COMMENT, CONTEXT, createAnchor, locate, validate, empty };
});
