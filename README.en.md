# Typora Side Comments 1.1.1

[简体中文](README.md) | English | [日本語](README.ja.md)

The plugin interface and documentation support **Simplified Chinese, English and Japanese**.

Select text and leave a comment in the right sidebar. This extension targets Typora for Windows and was developed against the loading structure and interfaces of **Typora 1.14.10**.

This is an independent, unofficial extension under the MIT license. It does not require the full `typora_plugin` framework. In version 1.0.0, installation, sidebar display, selected-text quotes, and opening the comment editor have been checked in Windows Typora 1.14.10. **Saving comments, restoring them after reopening a document, and keyboard shortcuts still need verification in the actual application.** Try it on the sample document first.

![Interface demo](preview.png)

## Interface language

Use **界面语言 / Interface language / 表示言語** at the top of the sidebar. Changes take effect immediately. On startup, a saved choice takes priority, followed by a supported system/browser language. Chinese variants use Simplified Chinese; unsupported languages fall back to English. The choice is saved locally, outside comment files. If the host blocks local storage, switching still works for the current session but may not persist.

Switching translates controls, notices, errors and date formatting while preserving the current draft, quote and save state. Document text, filenames and user comments are never translated. Installer console messages remain in English.

To upgrade from 1.0.0, save your work, close Typora and run the new installer. The comment file format is unchanged. **1.1.1 has not yet been installed and verified inside Typora**; the actual-application observations below are from 1.0.0.

## Installation

1. On GitHub, select **Code → Download ZIP** and extract the entire source archive into a folder. Do not copy only the installation script.
2. Save your documents and close all Typora windows.
3. Open Windows PowerShell as an administrator and run this command from the extracted folder:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install.ps1
   ```

   `Bypass` applies to this process; it does not change the system execution policy. The default installation path is `C:\Program Files\Typora`. For a different location:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install.ps1 -TyporaDirectory 'D:\Apps\Typora'
   ```

   Add `-WhatIf` to preview the installation actions without applying them.

4. Reopen Typora. The **Document comments** sidebar should appear on the right. Test with the included `示例文稿.md` before using it with your own documents.

The installer verifies the package files against SHA-256 hashes, backs up `resources\window.html`, copies six plugin files, and adds a script entry with explicit boundary markers. It does not change the Typora license, documents, user settings, or folder permissions. The hashes detect package corruption; they are not a digital signature.

## Usage

| Action | How |
|---|---|
| Add a comment | Select text within one paragraph and click **＋ Add comment** in the sidebar. The context menu and **Ctrl + Alt + M** are also implemented, but still need verification in Typora. |
| Save a comment | Click **Save comment**, or press **Ctrl + Enter** in the comment editor. |
| Locate the original text | Click the quoted text in a comment card. |
| Resolve a discussion | Click **Resolve**. You can reopen it from the **Resolved** tab using **Reopen**. |
| Edit or delete | Click **Edit** or **Delete** below the card. Deletion requires confirmation. |
| Reattach a comment | Select its new location in the document, click **Reattach** on the corresponding card, and save. |
| Show or hide the sidebar | Click the floating **Comments** button, or press **Ctrl + Alt + Shift + M**. |

Version 1 supports selections within a single paragraph, heading, or list item, including ordinary bold, italic, and linked text. Visual line wrapping within a paragraph is supported. Selections spanning multiple paragraphs, tables, code blocks, formulas, images, HTML blocks, and special Typora inline elements such as `:emoji:` or HTML entities are not supported. Unicode emoji entered directly can be included as ordinary text.

Adding and locating comments is paused in source mode. Right-clicking the current selection shows the add-comment menu; other locations keep Typora's usual menu. Comment bodies are displayed as plain text and do not execute HTML or scripts.

## Where comments are stored

For a document named `design.md`, the following files sit alongside it:

```text
design.md
design.md.comments.json        Comments and quoted source text
design.md.comments.json.bak    Comments before the most recent successful save
```

Comments are written to local files without network uploads or changes to the Markdown body. Saving comments and saving the document in Typora are separate operations; save your document before exiting. Reopening a document loads its companion file.

- **Move, rename, copy, or share the companion files together with the document.** Typora's Save As does not copy comments automatically. To carry them over, copy the original companion file and rename it to the new document's full filename followed by `.comments.json`.
- A comment contains the selected text and up to 64 characters of context on each side. Sharing the companion file also shares this text.
- The document's directory must be writable. Unsaved documents cannot receive comments. Read-only directories, write failures, and corrupted files produce an explicit message; unsaved comment input remains in the current window.
- Plugin windows use file locks and version checks. Comment lists do not synchronize in real time. If a conflict occurs, copy your unsaved input, cancel editing, click **Reload**, and try again.
- Do not modify the same comment file with an external editor or sync program while the plugin is saving. The lock cannot constrain programs that do not honor it, and the final version check is not an atomic compare-and-swap across programs.
- Unsaved input exists only in the current process. Whether an unload confirmation appears depends on the Typora host. Click **Save comment** first; do not rely on a close-window prompt to preserve drafts.

## When the original text changes

**1.1.1 fixes lost links when text before an unchanged quote is edited and its offset shifts.** An unchanged document uses the original offset. After edits, the plugin first matches the quote and its full context. If the context also changed, a quote that occurred exactly once when the comment was created and still occurs exactly once can relocate automatically. Adding a heading, deleting paragraphs or editing nearby preceding text no longer detaches such a quote merely because its position moved. Relocation does not rewrite document text or comment bodies.

Originally repeated quotes still require full context. A duplicate becoming the sole remaining occurrence after deletion does not prove its identity. Deleted, rewritten or ambiguous quotes retain their comments and show **Needs reattachment**. The plugin does not select the nearest occurrence. Complex repetition, copying, moves and rewrites may still require manual review; text matching cannot guarantee identity after every possible edit.

**Legacy comments:** 1.0.0/1.1.0 sidecars remain readable. The plugin calculates missing quote-uniqueness evidence only when the document fingerprint matches the original recorded document. Open any comment for editing and save it once, without changing its body, to persist evidence already verified in that file. Viewing alone does not rewrite the sidecar. If the document changed before upgrading and the full context no longer matches, the old sidecar lacks sufficient evidence: reattach that comment once. Current uniqueness is never treated as proof of original uniqueness.

## Recovery and uninstallation

**Corrupted file:** Close Typora and back up the current `.comments.json`. Inspect `.comments.json.bak` before restoring it. The plugin does not silently replace corrupted files with empty data.

**Lock left after a crash:** Save your work and close all Typora windows. Confirm that no other program is using the comments, then delete only the document's `document.md.comments.json.lock` file. Do not delete `.comments.json` or `.bak`. Reopen the document and click **Reload**. The plugin does not automatically take over an existing lock.

**Uninstall:** Save your documents, close Typora, and run the following from the package folder in an administrator PowerShell window:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Uninstall.ps1
```

Uninstallation removes only the plugin's entry and the plugin directory marked as owned by this package. Documents, comments, and installation backups are retained. It does not overwrite an updated Typora `window.html` with an older backup.

A Typora update may overwrite the plugin entry. Check compatibility before running the installer again after an update. Compatibility with future versions is not guaranteed.

## Interactive demo and validation

Open `demo.html` in Chrome or Edge to try the same sidebar. Demo comments are stored only in the browser's local storage. Edits to the demo body are not saved, and the demo does not access your Markdown files.

Recorded automated checks (results in simulated environments are distinct from testing inside Typora):

- **1.1.1: 33 Node tests** (14 data/anchor, 7 language and 12 relocation tests): translation coverage, locale matching, blocked storage, error mapping, date formatting and existing data checks.
- **1.1.1: 50 browser checks:** offset shifts, nearby prefix edits, reopened anchors, legacy metadata, three-language labels, preference persistence, drafts and caret, switching during saving, error retranslation, deletion confirmation, document switching, anchors, dates, a 360px viewport and simulated-host loading. A native language-menu interaction also confirmed retention of the selected quote.
- **1.0.0 historical record: 28 Chromium browser checks:** adding, reloading, editing, resolving, locating, reattaching, deleting, rendering HTML as text, retaining drafts on failure, switching documents during a save, A→B→A transitions, special selections, source mode, narrow windows, dark mode, printing, and loading/switching/teardown in a simulated host.
- **15 installer/uninstaller checks** in isolated mock installation directories: dry run, repeated installation, preserving user modifications, cleanup after first-install failure, and rollback after failed upgrades. These ran with Windows PowerShell 5.1 and do not operate on the actual Typora installation.
- **Verified in the actual application on 2026-09-24 (Windows Typora 1.14.10):** installation, sidebar display, and opening the comment editor with the button after selecting text, with the correct quote displayed. Saving, restoration after reopening, navigation, and shortcuts remain unverified in Typora. Other versions are unverified. Collaborative editing, reply threads, Word comment import/export, and including comments in PDF/Word exports are not provided.

Development checks require **Node.js 22 or later**, Windows PowerShell 5.1, and an installed Chrome browser. No npm packages are required.

```powershell
node --test tests/core-storage.test.cjs tests/i18n.test.cjs tests/anchor-relocation.test.cjs
node tests/browser.test.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\installer.test.ps1
```

For the new three-language browser suite, serve the package through a local static server, open `tests/browser-suite.html`, and click **Run checks**. Results appear on the page. It uses demo data only and restores the previous demo storage and language preference afterwards.

Browser tests default to `C:/Program Files/Google/Chrome/Application/chrome.exe`. If Chrome is elsewhere, change the path in `tests/browser.test.cjs`. The tests use a temporary browser profile and an isolated headless window, and regenerate `preview.png`. Installer tests use only temporary mock directories.

After changing files in `plugin/`, update `SHA256.json` before installing. Plugin files are configured to preserve their line endings so that downloaded or cloned files match the manifest hashes.

## References and implementation

- [Obsidian Inline Review Comments](https://github.com/ric604189-design/obsidian-inline-review-comments): a design reference for sidebar actions, quoted text, resolved states, and pre-submit snapshot checks. That project writes anchors directly into Markdown; this plugin uses companion files and does not copy its `%%` syntax or Obsidian editor interfaces.
- [typora_plugin development interfaces](https://github.com/obgnail/typora_plugin/blob/master/plugin/DEVELOP_PLUGINS.md) and [document-loading events](https://github.com/obgnail/typora_plugin/blob/master/plugin/global/core/utils/eventHub.js): references for local paths, Node interfaces, and document-loading timing.

This package is independently implemented and released under the [MIT license](LICENSE). Project names and links above identify the references used.
