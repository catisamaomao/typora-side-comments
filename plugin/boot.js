/* Independent loader: no framework installation, network requests, or Markdown writes. */
(function () {
  'use strict';
  if (window.__typoraSideCommentsLoading || window.__typoraSideComments) return;
  window.__typoraSideCommentsLoading = true;
  const scriptURL = document.currentScript.src;
  const until = Date.now() + 60000;
  async function boot() {
    if (!window.File?.editor || !window.reqnode || !document.querySelector('#write') || File.inBusyMode) {
      if (Date.now() < until) { setTimeout(boot, 250); return; }
      fail(new Error('等待 Typora 编辑器就绪超时。')); return;
    }
    try {
      const path = window.reqnode('node:path');
      const directory = window.dirname || window.__dirname;
      if (!directory) throw new Error('当前 Typora 未提供插件加载目录。');
      const root = path.join(directory, 'typora-side-comments');
      const storage = window.reqnode(path.join(root, 'storage.cjs'));
      window.TyporaSideCommentsCore = window.reqnode(path.join(root, 'core.js'));
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('style.css', scriptURL).href; css.id = 'tsc-styles'; document.head.append(css);
      await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = new URL('ui.js', scriptURL).href; script.onload = resolve; script.onerror = () => reject(new Error('无法加载批注界面。')); document.head.append(script); });
      const env = {
        getPath: () => File.filePath || File.bundle?.filePath || '',
        getRoot: () => document.querySelector('#write'),
        isSource: () => !!File.editor?.sourceView?.inSourceMode,
        isBusy: () => !!File.inBusyMode,
        subscribe(listener) {
          // These are the same content-loaded points used by typora_plugin's event hub.
          const owner = typeof File.onSwitchDocumentTarget === 'function' ? File : File.editor.library;
          const key = owner === File ? 'onSwitchDocumentTarget' : 'doSwitchByNode';
          const original = owner?.[key];
          if (typeof original !== 'function') return () => {};
          function wrapped(...args) {
            listener('before');
            let result;
            try { result = original.apply(this, args); }
            catch (error) { listener('after'); throw error; }
            if (result && typeof result.then === 'function') result.then(() => listener('after'), () => listener('after'));
            else queueMicrotask(() => listener('after'));
            return result;
          }
          owner[key] = wrapped;
          return () => { if (owner[key] === wrapped) owner[key] = original; };
        }
      };
      window.__typoraSideComments = new window.TyporaSideComments.SideComments(storage, env);
      await window.__typoraSideComments.start();
      console.info('[Typora Side Comments] 1.0.0 loaded');
    } catch (error) { fail(error); }
  }
  function fail(error) {
    console.error('[Typora Side Comments]', error);
    const banner = document.createElement('div'); banner.textContent = '侧边批注加载失败：' + error.message;
    banner.style.cssText = 'position:fixed;right:16px;top:48px;z-index:99999;max-width:380px;padding:14px;background:#fff0dc;color:#6f480e;border:1px solid #d5b476;font:13px sans-serif';
    document.body.append(banner);
  }
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot, { once: true });
})();
