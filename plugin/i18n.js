/* UI translations only: document text and comment bodies are never translated. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TyporaSideCommentsI18n = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const languages = Object.freeze({ 'zh-CN': '简体中文', en: 'English', ja: '日本語' });
  const storageKey = 'typora-side-comments-language';
  // Every entry contains Simplified Chinese, English and Japanese, in that order.
  const messages = {
    title: ['文稿批注', 'Document comments', '文書の注釈'],
    language: ['界面语言', 'Interface language', '表示言語'],
    close: ['关闭批注侧栏', 'Close comments sidebar', '注釈サイドバーを閉じる'],
    addButton: ['＋ 添加批注', '＋ Add comment', '＋ 注釈を追加'],
    addHint: ['选择正文后按 Ctrl + Alt + M', 'Select text, then press Ctrl + Alt + M', '本文を選択して Ctrl + Alt + M'],
    reload: ['重新加载', 'Reload', '再読み込み'],
    open: ['待处理', 'Open', '未解決'],
    all: ['全部', 'All', 'すべて'],
    resolved: ['已解决', 'Resolved', '解決済み'],
    detached: ['需关联', 'Unlinked', '未関連付け'],
    footer: ['批注保存在文档旁的 .comments.json 文件中', 'Comments are stored beside the document in a .comments.json file.', '注釈は文書と同じフォルダーの .comments.json に保存されます。'],
    launcher: ['批注', 'Comments', '注釈'],
    contextAdd: ['添加批注  Ctrl+Alt+M', 'Add comment  Ctrl+Alt+M', '注釈を追加  Ctrl+Alt+M'],
    untitled: ['未保存文档', 'Unsaved document', '未保存の文書'],
    loading: ['正在读取批注…', 'Loading comments…', '注釈を読み込み中…'],
    switching: ['正在切换文档…', 'Switching documents…', '文書を切り替え中…'],
    sourceMode: ['源码模式下暂停批注定位，请切回正文。', 'Comment navigation is paused in source mode. Switch back to the editor.', 'ソースコードモードでは原文への移動を停止しています。編集画面に戻ってください。'],
    reattachTitle: ['重新关联批注', 'Reattach comment', '注釈を再関連付け'],
    editTitle: ['编辑批注', 'Edit comment', '注釈を編集'],
    addTitle: ['添加批注', 'Add comment', '注釈を追加'],
    placeholder: ['写下你的批注…', 'Write your comment…', '注釈を入力…'],
    commentBody: ['批注内容', 'Comment text', '注釈の内容'],
    saving: ['正在保存…', 'Saving…', '保存中…'],
    save: ['保存批注', 'Save comment', '注釈を保存'],
    cancel: ['取消', 'Cancel', 'キャンセル'],
    emptyOpen: ['暂无待处理批注\n选中正文，点击“＋ 添加批注”开始。', 'No open comments\nSelect text and click “＋ Add comment” to start.', '未解決の注釈はありません\n本文を選択し「＋ 注釈を追加」をクリックしてください。'],
    empty: ['这里暂时没有批注', 'No comments here yet', '注釈はまだありません'],
    needsReattach: ['需重新关联', 'Needs reattachment', '再関連付けが必要'],
    locate: ['定位原文', 'Locate original text', '原文へ移動'],
    edit: ['编辑', 'Edit', '編集'],
    reopen: ['重新打开', 'Reopen', '再開'],
    resolve: ['解决', 'Resolve', '解決'],
    reattach: ['重新关联', 'Reattach', '再関連付け'],
    reattachHint: ['先选中正文中的新位置，再点此按钮', 'Select the new location in the document, then click here.', '本文で新しい位置を選択してからクリックしてください。'],
    delete: ['删除', 'Delete', '削除'],
    detachedHint: ['原文或上下文已变化。选中新位置后，点击“重新关联”。', 'The text or its context has changed. Select a new location, then click “Reattach”.', '原文または前後の文脈が変更されています。新しい位置を選択し「再関連付け」をクリックしてください。'],
    located: ['已定位原文。', 'Original text located.', '原文の位置に移動しました。'],
    savingComment: ['正在保存批注…', 'Saving comment…', '注釈を保存中…'],
    saved: ['批注已保存。', 'Comment saved.', '注釈を保存しました。'],
    statusSaved: ['批注状态已保存。', 'Comment status saved.', '注釈の状態を保存しました。'],
    deleteQuestion: ['删除这条批注？', 'Delete this comment?', 'この注釈を削除しますか？'],
    confirmDelete: ['确认删除', 'Confirm deletion', '削除を確定'],
    deleted: ['批注已删除，正文未改动。', 'Comment deleted. The document text is unchanged.', '注釈を削除しました。本文は変更されていません。'],
    RELOAD_DRAFT: ['请先复制未保存的批注内容并取消编辑，再重新加载。', 'Copy your unsaved comment and cancel editing before reloading.', '未保存の注釈をコピーし、編集をキャンセルしてから再読み込みしてください。'],
    SAME_BLOCK: ['第一版请在同一段正文、标题或列表项中选择文字。暂不支持跨段、代码、表格和公式。', 'Select text within one paragraph, heading or list item. Cross-paragraph selections, code, tables and formulas are not supported.', '同一の段落、見出し、リスト項目内で選択してください。段落をまたぐ選択、コード、表、数式には対応していません。'],
    SPECIAL_SELECTION: ['选区包含公式、图片或特殊编辑标记，请只选择普通正文。', 'The selection includes formulas, images or special editor elements. Select ordinary text only.', '数式、画像、特殊な編集要素が含まれています。通常の本文だけを選択してください。'],
    SELECT_TEXT: ['请先在正文中选中文字。', 'Select text in the document first.', '先に本文の文字を選択してください。'],
    SAVE_FIRST: ['请先保存文档，再添加批注。', 'Save the document before adding comments.', '文書を保存してから注釈を追加してください。'],
    SAVE_WAIT: ['正在保存，请稍候。', 'A save is in progress. Please wait.', '保存中です。しばらくお待ちください。'],
    SWITCH_WAIT: ['文档正在切换，请稍后再试。', 'The document is switching. Try again shortly.', '文書を切り替え中です。しばらくしてからお試しください。'],
    EXIT_SOURCE: ['请退出源码模式后操作批注。', 'Exit source mode before working with comments.', 'ソースコードモードを終了してから注釈を操作してください。'],
    SELECT_ANCHOR: ['请先在正文中选中文字，再添加或重新关联批注。', 'Select document text before adding or reattaching a comment.', '本文を選択してから注釈の追加や再関連付けをしてください。'],
    TEXT_CHANGED: ['正文已经改变，请重新选择要批注的文字。', 'The document text changed. Select the text again.', '本文が変更されました。対象の文字を選択し直してください。'],
    FINISH_DRAFT: ['请先保存或取消正在编辑的批注。', 'Save or cancel the comment you are editing first.', '編集中の注釈を先に保存するか、キャンセルしてください。'],
    COMMENT_MISSING: ['该批注已不存在，请重新加载。', 'This comment no longer exists. Reload the comments.', 'この注釈はもう存在しません。再読み込みしてください。'],
    LOCATION_MISSING: ['无法确定原文位置，请选择正文后重新关联。', 'The original location is uncertain. Select text and reattach the comment.', '原文の位置を特定できません。本文を選択して再関連付けしてください。'],
    STRUCTURE_CHANGED: ['这段原文的结构已经改变，请重新关联。', 'The original text structure changed. Reattach the comment.', '原文の構造が変更されました。再関連付けしてください。'],
    BODY_REQUIRED: ['请填写批注内容。', 'Enter a comment.', '注釈の内容を入力してください。'],
    DRAFT_CONFLICT: ['批注列表已经更新。请复制输入内容，取消编辑后重新操作。', 'The comment list changed. Copy your input, cancel editing, and try again.', '注釈一覧が更新されました。入力内容をコピーし、編集をキャンセルしてやり直してください。'],
    DRAFT_TEXT_CHANGED: ['编辑批注期间正文发生变化。请复制批注内容，取消后重新选择原文。', 'The document changed while you were editing. Copy your comment, cancel, and select the text again.', '注釈の編集中に本文が変更されました。内容をコピーし、キャンセルして原文を選択し直してください。'],
    INVALID_SELECTION: ['无效的正文选区。', 'Invalid text selection.', '本文の選択範囲が無効です。'],
    SELECTION_LENGTH: ['请选择 1 至 4000 个字符的正文。', 'Select between 1 and 4000 characters.', '本文を 1～4000 文字の範囲で選択してください。'],
    INVALID_FORMAT: ['批注文件格式不兼容；原文件未修改。', 'Incompatible comment file format. The original file was not changed.', '注釈ファイルの形式に互換性がありません。元のファイルは変更していません。'],
    INVALID_REVISION: ['批注文件缺少版本信息。', 'The comment file has invalid or missing revision information.', '注釈ファイルのバージョン情報が無効か、存在しません。'],
    INVALID_COUNT: ['批注数量超出限制或数据损坏。', 'Too many comments, or the data is damaged.', '注釈数が上限を超えているか、データが破損しています。'],
    INVALID_ID: ['批注编号重复或无效。', 'A comment ID is duplicated or invalid.', '注釈 ID が重複しているか、無効です。'],
    INVALID_BODY: ['批注内容无效。', 'Invalid comment text.', '注釈の内容が無効です。'],
    INVALID_STATUS: ['批注状态无效。', 'Invalid comment status.', '注釈の状態が無効です。'],
    INVALID_TIME: ['批注时间无效。', 'Invalid comment timestamp.', '注釈の日時が無効です。'],
    INVALID_QUOTE: ['批注原文无效。', 'Invalid quoted text.', '引用した原文が無効です。'],
    INVALID_CONTEXT: ['批注上下文无效。', 'Invalid comment context.', '注釈の前後の文脈が無効です。'],
    INVALID_RANGE: ['批注范围无效。', 'Invalid comment range.', '注釈の範囲が無効です。'],
    INVALID_DIGEST: ['批注指纹无效。', 'Invalid comment fingerprint.', '注釈のフィンガープリントが無効です。'],
    INVALID_UNIQUENESS: ['批注上下文唯一性信息无效。', 'Invalid context uniqueness information.', '文脈の一意性情報が無効です。'],
    UNSAFE_FILE: ['批注路径不是普通文件。', 'The comment path is not a regular file.', '注釈のパスが通常のファイルではありません。'],
    UNSAVED: ['请先保存 Markdown 文档，再添加批注。', 'Save the Markdown document before adding comments.', 'Markdown 文書を保存してから注釈を追加してください。'],
    READ_TOO_LARGE: ['批注文件超过 8 MB，已停止读取。', 'The comment file exceeds 8 MB. Reading was stopped.', '注釈ファイルが 8 MB を超えているため、読み込みを停止しました。'],
    WRITE_TOO_LARGE: ['批注文件将超过 8 MB，未写入。', 'The comment file would exceed 8 MB. Nothing was written.', '注釈ファイルが 8 MB を超えるため、書き込んでいません。'],
    CORRUPT: ['无法读取批注文件。请检查文件格式和同目录的 .bak 备份；原文件未修改。', 'Cannot read the comment file. Check its format and the .bak backup beside it. The original file was not changed.', '注釈ファイルを読み込めません。形式と同じフォルダーの .bak を確認してください。元のファイルは変更していません。'],
    BUSY: ['另一个窗口正在保存批注，或存在中断留下的锁文件。请稍后重试；不要在保存期间删除锁。', 'Another window is saving, or a lock remains from an interrupted save. Retry later; do not remove the lock during a save.', '別のウィンドウで保存中か、中断された保存のロックが残っています。後で再試行してください。保存中はロックを削除しないでください。'],
    CONFLICT: ['批注已被另一个窗口或程序修改。请保留输入内容，重新加载批注后再保存。', 'Another window or program changed the comments. Keep your input, reload the comments, and save again.', '別のウィンドウやプログラムが注釈を変更しました。入力を保管し、再読み込みしてから保存してください。'],
    SAVE_CONFLICT: ['保存时发现批注文件发生变化，已取消覆盖。', 'The comment file changed during saving. Overwriting was cancelled.', '保存中に注釈ファイルが変更されました。上書きを中止しました。'],
    ENOENT: ['文稿或批注目录不存在，请确认文件位置后重新加载。', 'The document or comment directory is missing. Check its location and reload.', '文書または注釈のフォルダーが見つかりません。場所を確認して再読み込みしてください。'],
    PERMISSION: ['无法访问批注文件，请检查文件和目录的读写权限。', 'Cannot access the comment file. Check file and directory permissions.', '注釈ファイルにアクセスできません。ファイルとフォルダーの読み書き権限を確認してください。'],
    ENOSPC: ['磁盘空间不足，批注未保存。请释放空间后重试。', 'The disk is full. The comment was not saved. Free some space and retry.', 'ディスクの空き容量が不足しています。注釈は保存されていません。空き容量を確保して再試行してください。'],
    FILE_BUSY: ['批注文件正被占用，请稍后重试。', 'The comment file is in use. Try again later.', '注釈ファイルが使用中です。後で再試行してください。'],
    UNKNOWN_ERROR: ['操作失败，请检查文件权限、磁盘空间和文件状态后重试。', 'The operation failed. Check permissions, disk space and file state, then retry.', '操作に失敗しました。権限、空き容量、ファイルの状態を確認して再試行してください。'],
    BOOT_TIMEOUT: ['等待 Typora 编辑器就绪超时。', 'Timed out waiting for the Typora editor.', 'Typora エディターの準備待ちがタイムアウトしました。'],
    BOOT_DIRECTORY: ['当前 Typora 未提供插件加载目录。', 'Typora did not provide a plugin loading directory.', 'Typora からプラグインの読み込み先が提供されていません。'],
    BOOT_UI: ['无法加载批注界面。', 'Cannot load the comments interface.', '注釈画面を読み込めません。'],
    BOOT_FAILED: ['侧边批注加载失败：{detail}', 'Side Comments failed to load: {detail}', '注釈プラグインを読み込めません：{detail}'],
    DEMO_SAVE_FAILED: ['模拟写入失败：批注未保存，输入仍然保留。', 'Simulated write failure: the comment was not saved; your input is retained.', '書き込み失敗のシミュレーション：注釈は未保存ですが、入力は保持されています。']
  };
  for (const entry of Object.values(messages)) Object.freeze(entry);
  Object.freeze(messages);
  function normalize(value) {
    if (typeof value !== 'string') return null;
    const base = value.trim().toLowerCase().split(/[-_]/)[0];
    return base === 'zh' ? 'zh-CN' : base === 'en' || base === 'ja' ? base : null;
  }
  function initialLanguage(host) {
    try { const saved = normalize(host.localStorage.getItem(storageKey)); if (saved) return saved; } catch (_) {}
    const nav = host.navigator || {};
    for (const value of [...(nav.languages || []), nav.language]) { const locale = normalize(value); if (locale) return locale; }
    return 'en';
  }
  function remember(host, locale) {
    const valid = normalize(locale); if (!valid) return false;
    try { host.localStorage.setItem(storageKey, valid); return true; } catch (_) { return false; }
  }
  function t(locale, key, params = {}) {
    const lang = normalize(locale) || 'en'; const index = lang === 'zh-CN' ? 0 : lang === 'ja' ? 2 : 1;
    const text = (Object.hasOwn(messages, key) ? messages[key] : messages.UNKNOWN_ERROR)[index];
    return text.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
  }
  function failure(key, code = key) { return Object.assign(new Error(key), { code, i18nKey: key }); }
  function error(locale, value) {
    if (!value) return '';
    if (typeof value === 'string') return t(locale, value);
    const code = value.i18nKey || value.code;
    const key = ['EACCES', 'EPERM', 'EROFS'].includes(code) ? 'PERMISSION' : ['EBUSY', 'EEXIST'].includes(code) ? 'FILE_BUSY' : code;
    return t(locale, key || 'UNKNOWN_ERROR');
  }
  function date(locale, value) {
    const locales = { 'zh-CN': 'zh-CN', en: 'en-US', ja: 'ja-JP' };
    return new Date(value).toLocaleString(locales[normalize(locale) || 'en'], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  return Object.freeze({ languages, storageKey, messages, normalize, initialLanguage, remember, t, failure, error, date });
});
