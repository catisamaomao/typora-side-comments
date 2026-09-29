# Typora 侧边批注 1.0.0

选中文字，在右侧留下批注。适用于 Windows Typora；根据本机 **Typora 1.14.10** 的加载结构和接口开发。

这是独立的非官方扩展，不需要安装整个 `typora_plugin` 框架，采用 MIT 许可证。已在 Windows Typora 1.14.10 安装并确认侧栏显示、选区引用和批注输入框正常打开；**批注保存、重新打开后的恢复和快捷键仍待实机验证**。目前适合先在示例文稿中试用。

![界面演示](preview.png)

## 安装

1. 在 GitHub 仓库点击 **Code → Download ZIP**，将源码包完整解压到一个文件夹。不要只复制安装脚本。
2. 保存文档，退出所有 Typora 窗口。
3. 用管理员身份打开 Windows PowerShell，在解压目录运行：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install.ps1
   ```

   本次进程的 `Bypass` 不会更改系统执行策略。默认安装位置是 `C:\Program Files\Typora`。若安装在其他位置：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install.ps1 -TyporaDirectory 'D:\Apps\Typora'
   ```

   仅预览安装动作，可增加 `-WhatIf`。

4. 重新打开 Typora，右侧应出现“文稿批注”。先用包内的 `示例文稿.md` 验证，再用于正式文稿。

安装程序校验包内文件的 SHA-256，备份 `resources\window.html`，复制五个插件文件，并增加一个带明确边界标记的脚本入口。不会修改 Typora 许可证、文稿、用户设置或文件夹权限。校验用于发现包文件损坏，不代表数字签名。

## 使用

| 操作 | 方法 |
|---|---|
| 添加批注 | 选中一段正文，点击右侧 **“＋ 添加批注”**；也支持右键菜单或 **Ctrl + Alt + M**，后两者仍待实机验证 |
| 保存批注 | 点击“保存批注”，或在批注输入框按 **Ctrl + Enter** |
| 定位原文 | 点击批注卡片中的原文引用 |
| 完成讨论 | 点击“解决”；在“已解决”页签可重新打开 |
| 修改或删除 | 卡片下方点击“编辑”或“删除”；删除需要再次确认 |
| 重新关联 | 先在正文选中新位置，再点击相应卡片的“重新关联”，最后保存 |
| 显示/隐藏侧栏 | 点击浮动“批注”按钮，或 **Ctrl + Alt + Shift + M** |

第一版支持同一段正文、标题或列表项中的文字，也支持普通加粗、斜体和链接文字。段落在屏幕上自动换行不受影响。暂不支持跨段选区、表格、代码块、公式、图片、HTML 块和 Typora 的 `:emoji:`/HTML 实体等特殊内联元素。直接输入的 Unicode 表情可以随普通文字保存。

源码模式下暂停添加和定位批注。当前选区的右键菜单显示“添加批注”；其他位置仍使用 Typora 的原菜单。批注内容以纯文本显示，不执行其中的 HTML 或脚本。

## 批注保存在哪里

例如文档是 `设计说明.md`，旁边会出现：

```text
设计说明.md
设计说明.md.comments.json        批注及原文引用
设计说明.md.comments.json.bak    上一次成功保存前的批注
```

批注自动写入本地文件，不上传网络，也不修改 Markdown 正文。批注保存与 Typora 保存正文是两件事；退出前仍需保存正文。重新打开文档后会读取配套文件。

- **移动、改名、另存为或分享文稿时，需要一并处理配套文件。** `另存为` 不会自动复制批注；如需继承，请复制原配套文件，并把名称改为新文稿完整文件名加 `.comments.json`。
- 批注中包含所选原文及前后各最多 64 个字符。共享配套文件时，这些内容也会共享。
- 配套目录必须可写。未保存文档不能添加批注。只读目录、写入失败或文件损坏会明确提示，未保存的批注输入会保留在当前窗口。
- 插件窗口之间使用文件锁和版本检查；窗口中的列表不会实时同步，发现冲突后请复制未保存内容、取消编辑、点“重新加载”再操作。
- 不要在插件保存的同时，用外部编辑器或同步程序改写同一批注文件。文件锁不能约束不遵循该锁的外部程序；最终版本检查也不是跨程序的原子比较替换。
- 尚未保存的输入只在当前进程内保留；浏览器式离开提示取决于 Typora 宿主是否接受。请先点“保存批注”，不要依靠关窗提示保留草稿。

## 原文修改后的行为

文稿未变化时，按原始位置定位；文稿变化后，必须找到原文及完整的前后文，并且只有一个可信匹配。创建时就存在重复上下文的批注，在文稿变化后会要求重新关联，避免删除一处后误挂到另一处。

这是保守的文本匹配，并非编辑器原生的范围跟随：修改批注文字本身或附近上下文、调整段落结构，可能让批注显示“需重新关联”。批注内容仍然保留。对于复杂重复、移动或改写，文本匹配无法提供数学意义上的身份保证；有疑问时请核对引用并手动关联。

## 恢复与卸载

**文件损坏**：先关闭 Typora，备份现有 `.comments.json`；检查 `.comments.json.bak` 的内容，确认后用备份恢复。插件不会自动把损坏文件重置为空。

**崩溃后提示存在锁**：先保存并关闭全部 Typora，确认没有其他程序在操作批注，再删除该文稿旁的 `文稿.md.comments.json.lock`。只删除这个 `.lock` 文件，不删除 `.comments.json` 或 `.bak`。重新打开后点击“重新加载”。程序不会冒险自动抢占锁。

**卸载**：保存文稿并关闭 Typora，用管理员 PowerShell 在包内运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Uninstall.ps1
```

卸载只移除插件自己的入口和已标记归属的插件目录。文稿、批注和安装备份全部保留。它不会用旧版 `window.html` 覆盖 Typora 更新后的文件。

Typora 更新可能覆盖插件入口。更新后请重新检查兼容性，再运行安装脚本；不能保证未来版本自动兼容。

## 交互演示与验证

用 Chrome 或 Edge 打开包内 `demo.html` 可以体验同一套侧栏。演示的批注只存在浏览器本地存储，正文编辑不保存，也不会操作你的 Markdown 文件。

自动检查记录（模拟环境的结果不等于 Typora 实机验证）：

- 14 项 Node 数据与锚点测试：重复段落、删除/撤销、Unicode、并发保存、版本冲突、备份、损坏文件、遗留锁和大小限制。
- 28 项真实 Chromium 浏览器检查：添加、重载、编辑、解决、定位、重新关联、删除、HTML 文本显示、失败保留输入、保存中切文件、A→B→A、特殊选区、源码模式、窄窗口、深色、打印，以及模拟宿主环境中的加载/切换/卸载。
- 15 项安装/卸载检查在隔离的模拟安装目录验证，覆盖预览、重复安装、保留用户修改、首次安装失败清理和升级失败回滚；已用 Windows PowerShell 5.1 执行，不会操作真实 Typora 安装目录。
- 实机已验证（2026-09-24，Windows Typora 1.14.10）：安装、侧栏显示、选中文字后通过按钮打开批注输入框，并正确显示原文引用。未完成实机保存、重开恢复、定位及快捷键验证。其他版本兼容性尚未确认；暂不提供多人协作、回复线程、Word 批注导入导出或随 PDF/Word 导出批注。

开发验证需要 **Node.js 22 或更新版本**、Windows PowerShell 5.1，以及已安装的 Chrome。无需安装 npm 包。

```powershell
node --test tests/core-storage.test.cjs
node tests/browser.test.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\installer.test.ps1
```

浏览器测试默认使用 `C:/Program Files/Google/Chrome/Application/chrome.exe`；安装位置不同需修改 `tests/browser.test.cjs` 中的路径。它使用临时浏览器配置和隔离的无头窗口，测试时会重新生成 `preview.png`。安装测试只使用临时模拟目录。

修改 `plugin/` 中的文件后，需要同步更新 `SHA256.json` 才能安装。插件文件设置为不转换换行符，以保证下载或克隆后的哈希与清单一致。

## 参考与实现说明

- [Obsidian Inline Review Comments](https://github.com/ric604189-design/obsidian-inline-review-comments)：参考侧栏操作、原文引用、解决状态、提交前快照检查的设计。该项目将锚点直接写入 Markdown；本插件采用配套文件，不复制其 `%%` 语法和 Obsidian 编辑器接口。
- [typora_plugin 开发接口](https://github.com/obgnail/typora_plugin/blob/master/plugin/DEVELOP_PLUGINS.md)与[文档加载事件](https://github.com/obgnail/typora_plugin/blob/master/plugin/global/core/utils/eventHub.js)：核实本地路径、Node 接口和正文加载时机。

本包代码为独立实现，采用 MIT 许可证。原项目名称及链接用于说明参考来源。
