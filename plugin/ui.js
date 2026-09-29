(function (global) {
  'use strict';
  const Core = global.TyporaSideCommentsCore;
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
    if (!block) throw new Error('第一版请在同一段正文、标题或列表项中选择文字。暂不支持跨段、代码、表格和公式。');
    for (const excluded of block.element.querySelectorAll(UNSUPPORTED)) if (range.intersectsNode(excluded)) throw new Error('选区包含公式、图片或特殊编辑标记，请只选择普通正文。');
    const start = position(block, range.startContainer, range.startOffset);
    const end = position(block, range.endContainer, range.endOffset);
    if (!map.text.slice(start, end).trim()) throw new Error('请先在正文中选中文字。');
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
        this.contextButton.style.left = Math.min(e.clientX, global.innerWidth - 170) + 'px';
        this.contextButton.style.top = Math.min(e.clientY, global.innerHeight - 45) + 'px'; this.contextButton.hidden = false;
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
      this.panel = el('aside', 'tsc-panel'); this.panel.id = 'tsc-panel'; this.panel.setAttribute('aria-label', '文稿批注');
      const top = el('div', 'tsc-top'); const title = el('div', 'tsc-title', '文稿批注'); this.count = el('span', 'tsc-count', '0'); title.append(this.count);
      const close = button('×', () => this.toggle(false), 'tsc-icon'); close.setAttribute('aria-label', '关闭批注侧栏'); top.append(title, close);
      this.fileLabel = el('div', 'tsc-file');
      const tools = el('div', 'tsc-toolbar'); this.addButton = button('＋ 添加批注', () => this.begin(), 'tsc-primary'); this.addButton.title = '选择正文后按 Ctrl + Alt + M';
      this.on(this.addButton, 'pointerdown', e => { this.capture(); e.preventDefault(); });
      this.reloadButton = button('重新加载', () => this.reload(), 'tsc-link'); tools.append(this.addButton, this.reloadButton);
      this.filters = el('div', 'tsc-filters'); for (const [key, label] of [['open', '待处理'], ['all', '全部'], ['resolved', '已解决'], ['detached', '需关联']]) {
        const b = button(label, () => { this.filter = key; this.renderList(); }); b.dataset.filter = key; this.filters.append(b);
      }
      this.notice = el('div', 'tsc-notice'); this.notice.setAttribute('role', 'status');
      this.composer = el('div', 'tsc-composer'); this.composer.hidden = true;
      this.list = el('div', 'tsc-list');
      const footer = el('div', 'tsc-footer', '批注保存在文档旁的 .comments.json 文件中');
      this.panel.append(top, this.fileLabel, tools, this.filters, this.notice, this.composer, this.list, footer);
      this.launcher = button('批注', () => this.toggle(), 'tsc-launcher'); this.launcher.title = 'Ctrl + Alt + Shift + M';
      this.contextButton = button('添加批注  Ctrl+Alt+M', () => { this.contextButton.hidden = true; this.begin(); }, 'tsc-context'); this.contextButton.hidden = true;
      this.on(this.contextButton, 'pointerdown', e => e.preventDefault());
      document.body.append(this.panel, this.launcher, this.contextButton);
    }
    toggle(value) { this.open = value === undefined ? !this.open : value; this.panel.hidden = !this.open; document.body.classList.toggle('tsc-open', this.open); this.launcher.classList.toggle('tsc-active', this.open); }
    clearHighlights() { if (global.CSS?.highlights) { CSS.highlights.delete('tsc-comments'); CSS.highlights.delete('tsc-focus'); } }
    message(text, error = false) { this.notice.textContent = text; this.notice.classList.toggle('tsc-error', error); this.notice.hidden = !text; }
    capture() {
      if (this.transition || this.state.source || this.state.loading) return;
      const selection = global.getSelection(); const root = this.env.getRoot();
      if (!selection?.rangeCount || !root) return;
      const range = selection.getRangeAt(0);
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
      if (selection.isCollapsed) { this.selection = null; return; }
      try { this.selection = { ...selected(collect(root), range), path: this.state.path, epoch: this.epoch }; this.selectionError = ''; }
      catch (e) { this.selection = null; this.selectionError = e.message; }
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
      const epoch = ++this.epoch; ++this.refreshVersion; this.selection = null; this.clearHighlights();
      this.state = { path, data: null, token: null, loading: true, error: '', source: !!this.env.isSource() };
      this.observe(this.env.getRoot()); this.render();
      try {
        if (!path) throw new Error('请先保存文档，再添加批注。');
        const loaded = await this.io.read(path);
        if (epoch !== this.epoch || path !== this.env.getPath()) return;
        this.state.data = Core.validate(loaded.data); this.state.token = loaded.token;
      } catch (e) { if (epoch === this.epoch) this.state.error = e.message; }
      if (epoch === this.epoch) { this.state.loading = false; await this.refresh(); this.render(); }
    }
    async refresh() {
      const version = ++this.refreshVersion, epoch = this.epoch;
      const map = collect(this.env.getRoot()); const digest = await this.io.hash(map.text);
      if (this.destroyed || version !== this.refreshVersion || epoch !== this.epoch || this.state.path !== this.env.getPath()) return;
      this.map = map; this.digest = digest; this.locations.clear();
      for (const comment of this.state.data?.comments || []) this.locations.set(comment.id, Core.locate(comment.anchor, map.text, digest));
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
      if (this.saving) throw new Error('正在保存，请稍候。');
      if (this.transition || this.env.isBusy?.() || this.state.loading || this.state.path !== this.env.getPath()) throw new Error('文档正在切换，请稍后再试。');
      if (this.state.source || this.env.isSource()) throw new Error('请退出源码模式后操作批注。');
      if (this.state.error || !this.state.data) throw new Error(this.state.error || '请先保存文档。');
    }
    async selectionAnchor() {
      const selection = this.selection;
      if (!selection || selection.path !== this.state.path || selection.epoch !== this.epoch) throw new Error(this.selectionError || '请先在正文中选中文字，再添加或重新关联批注。');
      const map = collect(this.env.getRoot());
      if (selection.text !== map.text) throw new Error('正文已经改变，请重新选择要批注的文字。');
      const epoch = this.epoch, digest = await this.io.hash(map.text);
      if (epoch !== this.epoch || map.text !== collect(this.env.getRoot()).text) throw new Error('正文已经改变，请重新选择文字。');
      return Core.createAnchor(map.text, selection.start, selection.end, digest);
    }
    async begin(id = null, reattach = false) {
      this.toggle(true);
      try {
        this.available();
        const existing = this.drafts.get(this.state.path);
        if (existing) { this.renderComposer(); this.textarea?.focus(); throw new Error('请先保存或取消正在编辑的批注。'); }
        const comment = id && this.state.data.comments.find(c => c.id === id);
        if (id && !comment) throw new Error('该批注已不存在，请重新加载。');
        const path = this.state.path, epoch = this.epoch;
        const anchor = !comment || reattach ? await this.selectionAnchor() : comment.anchor;
        if (path !== this.state.path || epoch !== this.epoch) return;
        this.drafts.set(path, { id, body: comment?.body || '', anchor, reattach, baseToken: this.state.token, documentText: collect(this.env.getRoot()).text });
        this.renderComposer(); this.message(''); this.textarea.focus();
      } catch (e) { this.message(e.message, true); }
    }
    render() {
      this.fileLabel.textContent = this.state.path ? this.state.path.split(/[\\/]/).pop() : '未保存文档';
      this.count.textContent = String((this.state.data?.comments || []).filter(c => c.status === 'open').length);
      this.addButton.disabled = this.saving || this.state.loading || this.transition || this.state.source || !this.state.data;
      this.reloadButton.disabled = this.saving || this.state.loading;
      const info = this.state.loading ? '正在读取批注…' : this.state.error || (this.transition ? '正在切换文档…' : this.state.source ? '源码模式下暂停批注定位，请切回正文。' : '');
      this.message(info, !!this.state.error); this.renderComposer(); this.renderList();
    }
    renderComposer() {
      const draft = this.drafts.get(this.state.path); this.composer.replaceChildren(); this.composer.hidden = !draft;
      if (!draft) return;
      this.composer.append(el('div', 'tsc-composer-title', draft.reattach ? '重新关联批注' : draft.id ? '编辑批注' : '添加批注'), el('blockquote', 'tsc-quote', draft.anchor.quote));
      this.textarea = el('textarea', 'tsc-textarea'); this.textarea.placeholder = '写下你的批注…'; this.textarea.setAttribute('aria-label', '批注内容'); this.textarea.maxLength = Core.MAX_COMMENT; this.textarea.value = draft.body;
      this.textarea.disabled = this.saving;
      this.textarea.addEventListener('input', () => { draft.body = this.textarea.value; });
      this.textarea.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); this.submit(); } });
      const actions = el('div', 'tsc-actions'); const save = button(this.saving ? '正在保存…' : '保存批注', () => this.submit(), 'tsc-primary'); save.disabled = this.saving;
      const cancel = button('取消', () => { this.drafts.delete(this.state.path); this.renderComposer(); this.message(''); }, 'tsc-link'); cancel.disabled = this.saving;
      actions.append(cancel, save); this.composer.append(this.textarea, actions);
    }
    renderList() {
      if (!this.list) return;
      for (const b of this.filters.children) { const active = b.dataset.filter === this.filter; b.classList.toggle('tsc-selected', active); b.setAttribute('aria-pressed', String(active)); }
      this.list.replaceChildren();
      if (this.state.loading || this.state.error) return;
      const comments = (this.state.data?.comments || []).filter(c => this.filter === 'all' || this.filter === 'detached' ? (this.filter === 'all' || this.locations.get(c.id)?.status !== 'attached') : c.status === this.filter);
      if (!comments.length) { this.list.append(el('div', 'tsc-empty', this.filter === 'open' ? '暂无待处理批注\n选中正文，按 Ctrl + Alt + M 开始。' : '这里暂时没有批注')); return; }
      for (const c of comments) {
        const loc = this.locations.get(c.id); const detached = loc?.status !== 'attached';
        const card = el('article', 'tsc-card' + (c.status === 'resolved' ? ' tsc-resolved' : '')); card.dataset.commentId = c.id;
        const meta = el('div', 'tsc-meta'); meta.append(el('span', 'tsc-badge', detached ? '需重新关联' : c.status === 'resolved' ? '已解决' : '待处理'), el('time', '', new Date(c.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })));
        const quote = button(c.anchor.quote, () => this.navigate(c.id), 'tsc-quote tsc-quote-button'); quote.title = '定位原文';
        const body = el('div', 'tsc-body', c.body); const actions = el('div', 'tsc-card-actions');
        actions.append(button('编辑', () => this.begin(c.id)), button(c.status === 'resolved' ? '重新打开' : '解决', () => this.change(c.id, c.status === 'resolved' ? 'open' : 'resolved')));
        const relink = button('重新关联', () => this.begin(c.id, true)); relink.title = '先选中正文中的新位置，再点此按钮'; actions.append(relink, button('删除', () => this.remove(c.id), 'tsc-danger'));
        for (const b of actions.children) b.disabled = this.saving || this.transition || this.state.source;
        card.append(meta, quote, body, actions); if (detached) card.append(el('div', 'tsc-detached', '原文或上下文已变化。选中新位置后，点击“重新关联”。'));
        this.list.append(card);
      }
    }
    async navigate(id) {
      try {
        this.available(); await this.refresh(); const location = this.locations.get(id);
        if (location?.status !== 'attached') throw new Error('无法确定原文位置，请选择正文后重新关联。');
        const range = makeRange(this.map, location.start, location.end);
        if (!range) throw new Error('这段原文的结构已经改变，请重新关联。');
        const node = range.startContainer.parentElement; node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (global.CSS?.highlights && global.Highlight) CSS.highlights.set('tsc-focus', new Highlight(range));
        this.message('已定位原文。');
      } catch (e) { this.message(e.message, true); }
    }
    async commit(data, savedDraft = null, expectedToken = this.state.token) {
      this.available(); const path = this.state.path, epoch = this.epoch;
      this.saving = true; this.renderComposer(); this.renderList(); this.message('正在保存批注…');
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
        if (!draft.body.trim()) throw new Error('请填写批注内容。');
        if (draft.baseToken !== this.state.token) throw new Error('批注列表已经更新。请复制输入内容，取消编辑后重新操作。');
        if ((!draft.id || draft.reattach) && draft.documentText !== collect(this.env.getRoot()).text) throw new Error('编辑批注期间正文发生变化。请复制批注内容，取消后重新选择原文。');
        const data = JSON.parse(JSON.stringify(this.state.data)); const now = new Date().toISOString();
        if (draft.id) { const c = data.comments.find(c => c.id === draft.id); if (!c) throw new Error('原批注已不存在。'); Object.assign(c, { body: draft.body.trim(), anchor: draft.anchor, updatedAt: now }); }
        else data.comments.push({ id: global.crypto.randomUUID(), body: draft.body.trim(), status: 'open', anchor: draft.anchor, createdAt: now, updatedAt: now });
        if (await this.commit(data, draft, draft.baseToken)) { this.renderComposer(); this.message('批注已保存。'); }
      } catch (e) { this.message(e.message, true); }
    }
    async change(id, status) {
      try { this.available(); if (this.drafts.has(this.state.path)) throw new Error('请先保存或取消正在编辑的批注。'); const data = JSON.parse(JSON.stringify(this.state.data)); const c = data.comments.find(c => c.id === id); if (!c) return; c.status = status; c.updatedAt = new Date().toISOString(); if (await this.commit(data)) this.message('批注状态已保存。'); }
      catch (e) { this.message(e.message, true); }
    }
    async remove(id) {
      try {
        this.available(); if (this.drafts.has(this.state.path)) throw new Error('请先保存或取消正在编辑的批注。');
        const card = this.list.querySelector('[data-comment-id="' + id + '"]'); if (!card) return;
        if (card.querySelector('.tsc-confirm')) return;
        const confirm = el('div', 'tsc-confirm'); confirm.append(el('span', '', '删除这条批注？'), button('确认删除', async () => {
          try { const data = JSON.parse(JSON.stringify(this.state.data)); data.comments = data.comments.filter(c => c.id !== id); if (await this.commit(data)) this.message('批注已删除，正文未改动。'); } catch (e) { this.message(e.message, true); }
        }, 'tsc-danger'), button('取消', () => confirm.remove())); card.append(confirm);
      } catch (e) { this.message(e.message, true); }
    }
    async reload() {
      if (this.drafts.has(this.state.path)) { this.message('请先复制未保存的批注内容并取消编辑，再重新加载。', true); return; }
      await this.load(true);
    }
    destroy() {
      this.destroyed = true; ++this.epoch; global.clearInterval(this.timer); this.observer?.disconnect(); this.handlers.forEach(fn => fn()); this.cleanups.forEach(fn => fn?.()); this.clearHighlights(); this.panel.remove(); this.launcher.remove(); this.contextButton.remove(); document.body.classList.remove('tsc-open');
    }
  }
  global.TyporaSideComments = { SideComments, collect, selected, makeRange };
})(window);
