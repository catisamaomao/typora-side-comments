/* Independent loader: no framework installation, network requests, or Markdown writes. */
(function () {
  'use strict';
  if (window.__typoraSideCommentsLoading || window.__typoraSideComments) return;
  window.__typoraSideCommentsLoading = true;
  const scriptURL = document.currentScript.src;
  const until = Date.now() + 60000;
  let I18n;
  async function boot() {
    if (!window.File?.editor || !window.reqnode || !document.querySelector('#write') || File.inBusyMode) {
      if (Date.now() < until) { setTimeout(boot, 250); return; }
      fail(I18n.failure('BOOT_TIMEOUT')); return;
    }
    try {
      const path = window.reqnode('node:path');
      const directory = window.dirname || window.__dirname;
      if (!directory) throw I18n.failure('BOOT_DIRECTORY');
      const root = path.join(directory, 'typora-side-comments');
      const storage = window.reqnode(path.join(root, 'storage.cjs'));
      window.TyporaSideCommentsCore = window.reqnode(path.join(root, 'core.js'));
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('style.css', scriptURL).href; css.id = 'tsc-styles'; document.head.append(css);
      await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = new URL('ui.js', scriptURL).href; script.onload = resolve; script.onerror = () => reject(I18n.failure('BOOT_UI')); document.head.append(script); });
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
      console.info('[Typora Side Comments] 1.1.1 loaded');
    } catch (error) { fail(error); }
  }
  function fail(error) {
    console.error('[Typora Side Comments]', error);
    const banner = document.createElement('div'); banner.textContent = I18n ? I18n.t(I18n.initialLanguage(window), 'BOOT_FAILED', { detail: I18n.error(I18n.initialLanguage(window), error) }) : 'Side Comments: language resources could not load. / 无法加载语言资源。 / 言語リソースを読み込めません。';
    banner.style.cssText = 'position:fixed;right:16px;top:48px;z-index:99999;max-width:380px;padding:14px;background:#fff0dc;color:#6f480e;border:1px solid #d5b476;font:13px sans-serif';
    document.body.append(banner);
  }
  function loadLanguage() {
    const script = document.createElement('script'); script.src = new URL('i18n.js', scriptURL).href;
    script.onload = () => { I18n = window.TyporaSideCommentsI18n; if (I18n) boot(); else fail(new Error('Missing language resources')); };
    script.onerror = () => fail(new Error('Missing language resources')); document.head.append(script);
  }
  if (document.readyState === 'complete') loadLanguage(); else window.addEventListener('load', loadLanguage, { once: true });
})();
