(function (global) {
  'use strict';
  const Core = global.TyporaSideCommentsCore;
  const I18n = global.TyporaSideCommentsI18n;
  const UNSUPPORTED = 'pre,table,script,style,textarea,input,.CodeMirror,.md-fences,.md-math,.md-inline-math,.md-image,.md-htmlblock,.md-emoji,.md-entity,[md-inline="emoji"],[md-inline="entity"],[contenteditable="false"]';
  const EXCLUDED = UNSUPPORTED + ',.md-meta';
  const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li';
  const el = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; };
  const button = (text, fn, className = '') => { const b = el('button', className, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  function collect(root) {
    const blocks = [];
    const nodes = [];
    let text = '';
    if (!root) return { text, blocks, nodes };
    for (const block of root.querySelectorAll(BLOCKS)) {
      if (block.closest(EXCLUDED) || block.querySelector(BLOCKS)) continue;
      const accepted = [];
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, { acceptNode: node => node.parentElement.closest(EXCLUDED) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent) accepted.push(node);
      if (!accepted.length) continue;
      if (blocks.length) text += '\n\n';
      const entry = { element: block, start: text.length, end: 0, nodes: [] };
      for (const node of accepted) { const segment = { node, start: text.length, end: text.length + node.textContent.length, block: entry }; text += node.textContent; entry.nodes.push(segment); nodes.push(segment); }
      entry.end = text.length; blocks.push(entry);
    }
    return { text, blocks, nodes };
  }
  function position(block, container, offset) {
    const prefix = document.createRange(); prefix.selectNodeContents(block.element); prefix.setEnd(container, offset);
    let result = block.start;
    for (const part of block.nodes) {
      if (part.node === container) { result += offset; break; }
      if (prefix.intersectsNode(part.node)) result += part.node.textContent.length;
    }
    return result;
  }
  function selected(map, range) {
    const block = map.blocks.find(b => b.element.contains(range.startContainer) && b.element.contains(range.endContainer));
    if (!block) throw I18n.failure('SAME_BLOCK');
    for (const excluded of block.element.querySelectorAll(UNSUPPORTED)) if (range.intersectsNode(excluded)) throw I18n.failure('SPECIAL_SELECTION');
    const start = position(block, range.startContainer, range.startOffset);
    const end = position(block, range.endContainer, range.endOffset);
    if (!map.text.slice(start, end).trim()) throw I18n.failure('SELECT_TEXT');
    return { start, end, text: map.text };
  }
  function makeRange(map, start, end) {
    const first = map.nodes.find(n => start >= n.start && start < n.end);
    const last = map.nodes.find(n => end > n.start && end <= n.end);
    if (!first || !last || first.block !== last.block) return null;
    const range = document.createRange(); range.setStart(first.node, start - first.start); range.setEnd(last.node, end - last.start); return range;
  }
  class SideComments {
    constructor(io, env) {
      this.io = io; this.env = env; this.epoch = 0; this.refreshVersion = 0;
      this.state = { path: null, data: null, token: null, loading: false, error: '', source: false };
      this.filter = 'open'; this.open = true; this.drafts = new Map(); this.locations = new Map(); this.map = collect(null); this.saving = false;
      this.handlers = []; this.cleanups = []; this.destroyed = false;
      this.language = I18n.initialLanguage(global); this.noticeValue = ''; this.noticeError = false; this.pendingDeleteId = null;
    }
    t(key) { return I18n.t(this.language, key); }
    setLanguage(value) {
      const language = I18n.normalize(value); if (!language) return false;
      const input = this.textarea;
      const caret = input && { focused: document.activeElement === input, start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection, scroll: input.scrollTop };
      this.language = language; I18n.remember(global, language);
      this.renderLabels(); this.renderComposer(); this.renderList(); this.renderNotice();
      if (caret && this.textarea?.isConnected) {
        this.textarea.setSelectionRange(caret.start, caret.end, caret.direction); this.textarea.scrollTop = caret.scroll;
        if (caret.focused) this.textarea.focus({ preventScroll: true });
      }
      return true;
    }
    renderLabels() {
      this.panel.lang = this.language; this.launcher.lang = this.language; this.contextButton.lang = this.language;
      this.panel.setAttribute('aria-label', this.t('title')); this.titleText.textContent = this.t('title');
      this.closeButton.setAttribute('aria-label', this.t('close'));
      this.languageLabel.textContent = this.t('language'); this.languageSelect.setAttribute('aria-label', this.t('language')); this.languageSelect.value = this.language;
      this.addButton.textContent = this.t('addButton'); this.addButton.title = this.t('addHint');
      this.reloadButton.textContent = this.t('reload');
      for (const b of this.filters.children) b.textContent = this.t(b.dataset.filter);
      this.footer.textContent = this.t('footer'); this.launcher.textContent = this.t('launcher'); this.contextButton.textContent = this.t('contextAdd');
      this.fileLabel.textContent = this.state.path ? this.state.path.split(/[\\/]/).pop() : this.t('untitled');
    }
    on(target, event, fn, opts) { target.addEventListener(event, fn, opts); this.handlers.push(() => target.removeEventListener(event, fn, opts)); }
    async start() {
      this.build();
      this.on(document, 'selectionchange', () => this.capture());
      this.on(document, 'keydown', e => {
        if (e.ctrlKey && e.altKey && e.code === 'KeyM') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) this.toggle(); else this.begin(); }
        if (e.key === 'Escape' && this.contextButton) this.contextButton.hidden = true;
      }, true);
      this.on(document, 'contextmenu', e => {
        if (!this.env.getRoot()?.contains(e.target) || global.getSelection()?.isCollapsed) return;
        this.capture(); if (!this.selection) return;
        e.preventDefault(); e.stopImmediatePropagation();
        this.contextButton.hidden = false;
        const rect = this.contextButton.getBoundingClientRect();
        this.contextButton.style.left = Math.max(0, Math.min(e.clientX, global.innerWidth - rect.width)) + 'px';
        this.contextButton.style.top = Math.max(0, Math.min(e.clientY, global.innerHeight - rect.height)) + 'px';
      }, true);
      this.on(document, 'pointerdown', e => { if (!this.contextButton.contains(e.target)) this.contextButton.hidden = true; });
      this.on(global, 'beforeunload', e => {
        if (this.saving || [...this.drafts.values()].some(d => d.body.trim())) { e.preventDefault(); e.returnValue = ''; }
      });
      if (this.env.subscribe) this.cleanups.push(this.env.subscribe(event => {
        if (event === 'before') { this.transition = true; this.selection = null; this.clearHighlights(); this.render(); }
        else { this.transition = false; this.load(true); }
      }));
      this.timer = global.setInterval(() => this.poll(), 500);
      this.toggle(true); await this.load(); return this;
    }
    build() {
      this.panel = el('aside', 'tsc-panel'); this.panel.id = 'tsc-panel';
      const top = el('div', 'tsc-top'); const title = el('div', 'tsc-title'); this.titleText = el('span'); this.count = el('span', 'tsc-count', '0'); title.append(this.titleText, this.count);
      this.closeButton = button('×', () => this.toggle(false), 'tsc-icon'); top.append(title, this.closeButton);
      this.fileLabel = el('div', 'tsc-file');
      const languageRow = el('div', 'tsc-language-row'); this.languageLabel = el('label'); this.languageLabel.htmlFor = 'tsc-language';
      this.languageSelect = el('select', 'tsc-language'); this.languageSelect.id = 'tsc-language';
      for (const [value, label] of Object.entries(I18n.languages)) { const option = el('option', '', label); option.value = value; this.languageSelect.append(option); }
      this.on(this.languageSelect, 'pointerdown', () => this.capture());
      this.on(this.languageSelect, 'change', () => this.setLanguage(this.languageSelect.value));
      languageRow.append(this.languageLabel, this.languageSelect);
      const tools = el('div', 'tsc-toolbar'); this.addButton = button('', () => this.begin(), 'tsc-primary');
      this.on(this.addButton, 'pointerdown', e => { this.capture(); e.preventDefault(); });
      this.reloadButton = button('', () => this.reload(), 'tsc-link'); tools.append(this.addButton, this.reloadButton);
      this.filters = el('div', 'tsc-filters'); for (const key of ['open', 'all', 'resolved', 'detached']) {
        const b = button('', () => { this.filter = key; this.renderList(); }); b.dataset.filter = key; this.filters.append(b);
      }
      this.notice = el('div', 'tsc-notice'); this.notice.setAttribute('role', 'status');
      this.composer = el('div', 'tsc-composer'); this.composer.hidden = true;
      this.list = el('div', 'tsc-list'); this.footer = el('div', 'tsc-footer');
      this.panel.append(top, this.fileLabel, languageRow, tools, this.filters, this.notice, this.composer, this.list, this.footer);
      this.launcher = button('', () => this.toggle(), 'tsc-launcher'); this.launcher.title = 'Ctrl + Alt + Shift + M';
      this.contextButton = button('', () => { this.contextButton.hidden = true; this.begin(); }, 'tsc-context'); this.contextButton.hidden = true;
      this.on(this.contextButton, 'pointerdown', e => e.preventDefault());
      document.body.append(this.panel, this.launcher, this.contextButton); this.renderLabels();
    }
    toggle(value) { this.open = value === undefined ? !this.open : value; this.panel.hidden = !this.open; document.body.classList.toggle('tsc-open', this.open); this.launcher.classList.toggle('tsc-active', this.open); }
    clearHighlights() { if (global.CSS?.highlights) { CSS.highlights.delete('tsc-comments'); CSS.highlights.delete('tsc-focus'); } }
    message(value, error = false) { this.noticeValue = value; this.noticeError = error; this.renderNotice(); }
    renderNotice() { const text = I18n.error(this.language, this.noticeValue); this.notice.textContent = text; this.notice.classList.toggle('tsc-error', this.noticeError); this.notice.hidden = !text; }
    capture() {
      if (this.transition || this.state.source || this.state.loading) return;
      const selection = global.getSelection(); const root = this.env.getRoot();
      if (!selection?.rangeCount || !root) return;
      const range = selection.getRangeAt(0);
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
      if (selection.isCollapsed) { this.selection = null; return; }
      try { this.selection = { ...selected(collect(root), range), path: this.state.path, epoch: this.epoch }; this.selectionError = ''; }
      catch (e) { this.selection = null; this.selectionError = e; }
    }
    async poll() {
      if (this.destroyed) return;
      const path = this.env.getPath() || '';
      if (path !== this.state.path) { await this.load(); return; }
      const source = !!this.env.isSource();
      if (source !== this.state.source) { this.state.source = source; this.selection = null; this.refresh(); this.render(); }
      const root = this.env.getRoot();
      if (root !== this.observedRoot) this.observe(root);
      // Also covers Typora rebuilding the entire editor without changing the file path.
      if (this.dirty && !this.transition) { this.dirty = false; this.refresh(); }
    }
    observe(root) {
      this.observer?.disconnect(); this.observedRoot = root;
      if (!root) return;
      this.observer = new MutationObserver(() => { this.dirty = true; });
      this.observer.observe(root, { childList: true, characterData: true, subtree: true });
    }
    async load(force = false) {
      const path = this.env.getPath() || '';
      if (!force && path === this.state.path) return;
      const epoch = ++this.epoch; ++this.refreshVersion; this.selection = null; this.pendingDeleteId = null; this.clearHighlights();
      this.state = { path, data: null, token: null, loading: true, error: '', source: !!this.env.isSource() };
      this.observe(this.env.getRoot()); this.render();
      try {
        if (!path) throw I18n.failure('SAVE_FIRST');
        const loaded = await this.io.read(path);
        if (epoch !== this.epoch || path !== this.env.getPath()) return;
        this.state.data = Core.validate(loaded.data); this.state.token = loaded.token;
      } catch (e) { if (epoch === this.epoch) this.state.error = e; }
      if (epoch === this.epoch) { this.state.loading = false; await this.refresh(); this.render(); }
    }
    async refresh() {
      const version = ++this.refreshVersion, epoch = this.epoch;
      const map = collect(this.env.getRoot()); const digest = await this.io.hash(map.text);
      if (this.destroyed || version !== this.refreshVersion || epoch !== this.epoch || this.state.path !== this.env.getPath()) return;
      this.map = map; this.digest = digest; this.locations.clear();
      for (const comment of this.state.data?.comments || []) {
        comment.anchor = Core.upgradeAnchor(comment.anchor, map.text, digest);
        this.locations.set(comment.id, Core.locate(comment.anchor, map.text, digest));
      }
      this.highlight(); this.renderList();
    }
    highlight() {
      this.clearHighlights();
      if (!global.CSS?.highlights || !global.Highlight || this.state.source || this.transition) return;
      const ranges = [];
      for (const c of this.state.data?.comments || []) {
        const loc = this.locations.get(c.id);
        if (c.status === 'open' && loc?.status === 'attached') { const r = makeRange(this.map, loc.start, loc.end); if (r) ranges.push(r); }
      }
      CSS.highlights.set('tsc-comments', new Highlight(...ranges));
    }
    available() {
      if (this.saving) throw I18n.failure('SAVE_WAIT');
      if (this.transition || this.env.isBusy?.() || this.state.loading || this.state.path !== this.env.getPath()) throw I18n.failure('SWITCH_WAIT');
      if (this.state.source || this.env.isSource()) throw I18n.failure('EXIT_SOURCE');
      if (this.state.error || !this.state.data) throw (this.state.error || I18n.failure('SAVE_FIRST'));
    }
    async selectionAnchor() {
      const selection = this.selection;
      if (!selection || selection.path !== this.state.path || selection.epoch !== this.epoch) throw (this.selectionError || I18n.failure('SELECT_ANCHOR'));
      const map = collect(this.env.getRoot());
      if (selection.text !== map.text) throw I18n.failure('TEXT_CHANGED');
      const epoch = this.epoch, digest = await this.io.hash(map.text);
      if (epoch !== this.epoch || map.text !== collect(this.env.getRoot()).text) throw I18n.failure('TEXT_CHANGED');
      return Core.createAnchor(map.text, selection.start, selection.end, digest);
    }
    async begin(id = null, reattach = false) {
      this.toggle(true);
      try {
        this.available();
        const existing = this.drafts.get(this.state.path);
        if (existing) { this.renderComposer(); this.textarea?.focus(); throw I18n.failure('FINISH_DRAFT'); }
        const comment = id && this.state.data.comments.find(c => c.id === id);
        if (id && !comment) throw I18n.failure('COMMENT_MISSING');
        const path = this.state.path, epoch = this.epoch;
        const anchor = !comment || reattach ? await this.selectionAnchor() : comment.anchor;
        if (path !== this.state.path || epoch !== this.epoch) return;
        this.drafts.set(path, { id, body: comment?.body || '', anchor, reattach, baseToken: this.state.token, documentText: collect(this.env.getRoot()).text });
        this.renderComposer(); this.message(''); this.textarea.focus();
      } catch (e) { this.message(e, true); }
    }
    render() {
      this.fileLabel.textContent = this.state.path ? this.state.path.split(/[\\/]/).pop() : this.t('untitled');
      this.count.textContent = String((this.state.data?.comments || []).filter(c => c.status === 'open').length);
      this.addButton.disabled = this.saving || this.state.loading || this.transition || this.state.source || !this.state.data;
      this.reloadButton.disabled = this.saving || this.state.loading;
      const info = this.state.loading ? 'loading' : this.state.error || (this.transition ? 'switching' : this.state.source ? 'sourceMode' : '');
      this.message(info, !!this.state.error); this.renderComposer(); this.renderList();
    }
    renderComposer() {
      const draft = this.drafts.get(this.state.path); this.composer.replaceChildren(); this.composer.hidden = !draft;
      if (!draft) return;
      this.composer.append(el('div', 'tsc-composer-title', draft.reattach ? this.t('reattachTitle') : draft.id ? this.t('editTitle') : this.t('addTitle')), el('blockquote', 'tsc-quote', draft.anchor.quote));
      this.textarea = el('textarea', 'tsc-textarea'); this.textarea.placeholder = this.t('placeholder'); this.textarea.setAttribute('aria-label', this.t('commentBody')); this.textarea.maxLength = Core.MAX_COMMENT; this.textarea.value = draft.body;
      this.textarea.disabled = this.saving;
      this.textarea.addEventListener('input', () => { draft.body = this.textarea.value; });
      this.textarea.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); this.submit(); } });
      const actions = el('div', 'tsc-actions'); const save = button(this.saving ? this.t('saving') : this.t('save'), () => this.submit(), 'tsc-primary'); save.disabled = this.saving;
      const cancel = button(this.t('cancel'), () => { this.drafts.delete(this.state.path); this.renderComposer(); this.message(''); }, 'tsc-link'); cancel.disabled = this.saving;
      actions.append(cancel, save); this.composer.append(this.textarea, actions);
    }
    renderList() {
      if (!this.list) return;
      for (const b of this.filters.children) { const active = b.dataset.filter === this.filter; b.classList.toggle('tsc-selected', active); b.setAttribute('aria-pressed', String(active)); }
      this.list.replaceChildren();
      if (this.state.loading || this.state.error) return;
      const comments = (this.state.data?.comments || []).filter(c => this.filter === 'all' || this.filter === 'detached' ? (this.filter === 'all' || this.locations.get(c.id)?.status !== 'attached') : c.status === this.filter);
      if (!comments.length) { this.list.append(el('div', 'tsc-empty', this.filter === 'open' ? this.t('emptyOpen') : this.t('empty'))); return; }
      for (const c of comments) {
        const loc = this.locations.get(c.id); const detached = loc?.status !== 'attached';
        const card = el('article', 'tsc-card' + (c.status === 'resolved' ? ' tsc-resolved' : '')); card.dataset.commentId = c.id;
        const meta = el('div', 'tsc-meta'); meta.append(el('span', 'tsc-badge', detached ? this.t('needsReattach') : c.status === 'resolved' ? this.t('resolved') : this.t('open')), el('time', '', I18n.date(this.language, c.createdAt)));
        const quote = button(c.anchor.quote, () => this.navigate(c.id), 'tsc-quote tsc-quote-button'); quote.title = this.t('locate');
        const body = el('div', 'tsc-body', c.body); const actions = el('div', 'tsc-card-actions');
        actions.append(button(this.t('edit'), () => this.begin(c.id)), button(c.status === 'resolved' ? this.t('reopen') : this.t('resolve'), () => this.change(c.id, c.status === 'resolved' ? 'open' : 'resolved')));
        const relink = button(this.t('reattach'), () => this.begin(c.id, true)); relink.title = this.t('reattachHint'); actions.append(relink, button(this.t('delete'), () => this.remove(c.id), 'tsc-danger'));
        for (const b of actions.children) b.disabled = this.saving || this.transition || this.state.source;
        card.append(meta, quote, body, actions); if (detached) card.append(el('div', 'tsc-detached', this.t('detachedHint')));
        if (this.pendingDeleteId === c.id) this.addDeletePrompt(card, c.id);
        this.list.append(card);
      }
    }
    async navigate(id) {
      try {
        this.available(); await this.refresh(); const location = this.locations.get(id);
        if (location?.status !== 'attached') throw I18n.failure('LOCATION_MISSING');
        const range = makeRange(this.map, location.start, location.end);
        if (!range) throw I18n.failure('STRUCTURE_CHANGED');
        const node = range.startContainer.parentElement; node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (global.CSS?.highlights && global.Highlight) CSS.highlights.set('tsc-focus', new Highlight(range));
        this.message('located');
      } catch (e) { this.message(e, true); }
    }
    async commit(data, savedDraft = null, expectedToken = this.state.token) {
      this.available(); const path = this.state.path, epoch = this.epoch;
      this.saving = true; this.renderComposer(); this.renderList(); this.message('savingComment');
      try {
        const result = await this.io.save(path, data, expectedToken);
        if (savedDraft && this.drafts.get(path) === savedDraft) this.drafts.delete(path);
        if (this.epoch !== epoch || this.state.path !== path) {
          if (this.state.path === path && this.env.getPath() === path) await this.load(true);
          return false;
        }
        this.state.data = result.data; this.state.token = result.token; return true;
      } finally { this.saving = false; await this.refresh(); this.render(); }
    }
    async submit() {
      const path = this.state.path, draft = this.drafts.get(path);
      if (!draft) return;
      try {
        this.available();
        if (!draft.body.trim()) throw I18n.failure('BODY_REQUIRED');
        if (draft.baseToken !== this.state.token) throw I18n.failure('DRAFT_CONFLICT');
        if ((!draft.id || draft.reattach) && draft.documentText !== collect(this.env.getRoot()).text) throw I18n.failure('DRAFT_TEXT_CHANGED');
        const data = JSON.parse(JSON.stringify(this.state.data)); const now = new Date().toISOString();
        if (draft.id) { const c = data.comments.find(c => c.id === draft.id); if (!c) throw I18n.failure('COMMENT_MISSING'); Object.assign(c, { body: draft.body.trim(), anchor: draft.anchor, updatedAt: now }); }
        else data.comments.push({ id: global.crypto.randomUUID(), body: draft.body.trim(), status: 'open', anchor: draft.anchor, createdAt: now, updatedAt: now });
        if (await this.commit(data, draft, draft.baseToken)) { this.renderComposer(); this.message('saved'); }
      } catch (e) { this.message(e, true); }
    }
    async change(id, status) {
      try { this.available(); if (this.drafts.has(this.state.path)) throw I18n.failure('FINISH_DRAFT'); const data = JSON.parse(JSON.stringify(this.state.data)); const c = data.comments.find(c => c.id === id); if (!c) return; c.status = status; c.updatedAt = new Date().toISOString(); if (await this.commit(data)) this.message('statusSaved'); }
      catch (e) { this.message(e, true); }
    }
    addDeletePrompt(card, id) {
      const prompt = el('div', 'tsc-confirm'); prompt.append(el('span', '', this.t('deleteQuestion')), button(this.t('confirmDelete'), async () => {
        try {
          this.available();
          if (this.drafts.has(this.state.path)) throw I18n.failure('FINISH_DRAFT');
          const data = JSON.parse(JSON.stringify(this.state.data)); data.comments = data.comments.filter(c => c.id !== id);
          if (await this.commit(data)) { this.pendingDeleteId = null; this.message('deleted'); }
        } catch (e) { this.message(e, true); }
      }, 'tsc-danger'), button(this.t('cancel'), () => { this.pendingDeleteId = null; this.renderList(); }));
      for (const b of prompt.querySelectorAll('button')) b.disabled = this.saving || this.transition || this.state.source;
      card.append(prompt);
    }
    async remove(id) {
      try {
        this.available(); if (this.drafts.has(this.state.path)) throw I18n.failure('FINISH_DRAFT');
        if (!this.state.data.comments.some(c => c.id === id)) return;
        this.pendingDeleteId = id; this.renderList();
      } catch (e) { this.message(e, true); }
    }
    async reload() {
      if (this.drafts.has(this.state.path)) { this.message('RELOAD_DRAFT', true); return; }
      await this.load(true);
    }
    destroy() {
      this.destroyed = true; ++this.epoch; global.clearInterval(this.timer); this.observer?.disconnect(); this.handlers.forEach(fn => fn()); this.cleanups.forEach(fn => fn?.()); this.clearHighlights(); this.panel.remove(); this.launcher.remove(); this.contextButton.remove(); document.body.classList.remove('tsc-open');
    }
  }
  global.TyporaSideComments = { SideComments, collect, selected, makeRange };
})(window);
