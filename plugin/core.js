/* Typora Side Comments — original implementation, MIT license. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TyporaSideCommentsCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FORMAT = 'typora-side-comments';
  const MAX_COMMENT = 12000;
  const CONTEXT = 64;
  function assert(ok, code) { if (!ok) throw Object.assign(new Error(code), { code }); }
  function matchingQuotes(anchor, text, accept) {
    const matches = [];
    for (let at = text.indexOf(anchor.quote); at !== -1; at = text.indexOf(anchor.quote, at + 1)) {
      const end = at + anchor.quote.length;
      const before = anchor.prefix ? text.slice(Math.max(0, at - anchor.prefix.length), at) === anchor.prefix : at === 0;
      const after = anchor.suffix ? text.slice(end, end + anchor.suffix.length) === anchor.suffix : end === text.length;
      if (accept(before, after)) matches.push({ start: at, end });
      if (matches.length > 1) break;
    }
    return matches;
  }
  function contextMatches(anchor, text) { return matchingQuotes(anchor, text, (before, after) => before && after); }
  function withEvidence(anchor, text) {
    return { ...anchor, quoteUnique: matchingQuotes(anchor, text, () => true).length === 1 };
  }
  function upgradeAnchor(anchor, text, digest) {
    // Legacy sidecars do not prove whether the quote was unique.
    // Enrich them only when we can verify their original document, never from a survivor.
    if (typeof anchor.quoteUnique === 'boolean') return anchor;
    return anchor.digest === digest && text.slice(anchor.start, anchor.end) === anchor.quote ? withEvidence(anchor, text) : anchor;
  }
  function createAnchor(text, start, end, digest) {
    assert(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= text.length && end > start, 'INVALID_SELECTION');
    const quote = text.slice(start, end);
    assert(quote.trim() && quote.length <= 4000, 'SELECTION_LENGTH');
    const anchor = { quote, prefix: text.slice(Math.max(0, start - CONTEXT), start), suffix: text.slice(end, end + CONTEXT), start, end, digest };
    anchor.contextUnique = contextMatches(anchor, text).length === 1;
    return withEvidence(anchor, text);
  }
  function locate(anchor, text, digest) {
    if (anchor.digest === digest && text.slice(anchor.start, anchor.end) === anchor.quote) {
      return { status: 'attached', start: anchor.start, end: anchor.end };
    }
    // A duplicate originally present must not become a false unique match after deletion.
    if (!anchor.contextUnique) return { status: 'ambiguous' };
    const candidates = contextMatches(anchor, text);
    if (candidates.length > 1) return { status: 'ambiguous' };
    if (candidates.length === 1) return { status: 'attached', ...candidates[0] };
    // A duplicate becoming unique after deletion is not proof of identity.
    // Even an originally unique single side can transfer to another occurrence
    // when the selected quote is deleted, so never use one-sided fallback.
    if (anchor.quoteUnique === true) {
      const quotes = matchingQuotes(anchor, text, () => true);
      if (quotes.length > 1) return { status: 'ambiguous' };
      if (quotes.length === 1) return { status: 'attached', ...quotes[0] };
    }
    return { status: 'detached' };
  }
  function validate(data) {
    assert(data && data.format === FORMAT && data.version === 1, 'INVALID_FORMAT');
    assert(typeof data.revision === 'string' && data.revision.length <= 100, 'INVALID_REVISION');
    assert(Array.isArray(data.comments) && data.comments.length <= 5000, 'INVALID_COUNT');
    const ids = new Set();
    for (const c of data.comments) {
      assert(c && typeof c.id === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(c.id) && !ids.has(c.id), 'INVALID_ID'); ids.add(c.id);
      assert(typeof c.body === 'string' && c.body.trim() && c.body.length <= MAX_COMMENT, 'INVALID_BODY');
      assert(c.status === 'open' || c.status === 'resolved', 'INVALID_STATUS');
      assert(typeof c.createdAt === 'string' && Number.isFinite(Date.parse(c.createdAt)) && typeof c.updatedAt === 'string' && Number.isFinite(Date.parse(c.updatedAt)), 'INVALID_TIME');
      const a = c.anchor;
      assert(a && typeof a.quote === 'string' && a.quote.trim() && a.quote.length <= 4000, 'INVALID_QUOTE');
      assert(typeof a.prefix === 'string' && a.prefix.length <= CONTEXT && typeof a.suffix === 'string' && a.suffix.length <= CONTEXT, 'INVALID_CONTEXT');
      assert(Number.isInteger(a.start) && a.start >= 0 && Number.isInteger(a.end) && a.end - a.start === a.quote.length, 'INVALID_RANGE');
      assert(typeof a.digest === 'string' && /^[a-f0-9]{64}$/.test(a.digest), 'INVALID_DIGEST');
      assert(typeof a.contextUnique === 'boolean', 'INVALID_UNIQUENESS');
      assert(a.quoteUnique === undefined || typeof a.quoteUnique === 'boolean', 'INVALID_UNIQUENESS');
    }
    return data;
  }
  function empty(name) { return { format: FORMAT, version: 1, revision: '', document: { name }, comments: [] }; }
  return { FORMAT, MAX_COMMENT, CONTEXT, createAnchor, upgradeAnchor, locate, validate, empty };
});
