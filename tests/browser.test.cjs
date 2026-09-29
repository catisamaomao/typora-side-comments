'use strict';
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('./cdp.cjs');
const root = path.resolve(__dirname, '..');
const server = http.createServer(async (req, res) => {
  try { const url = new URL(req.url, 'http://localhost'); const file = path.resolve(root, '.' + decodeURIComponent(url.pathname)); if (!file.startsWith(root + path.sep)) throw Error('bad path'); const body = await fs.readFile(file); res.setHeader('content-type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(body); }
  catch { res.statusCode = 404; res.end('not found'); }
});
let checks = 0;
function ok(value, label) { assert.ok(value, label); checks++; console.log('PASS ' + label); }
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const select = async quote => page.evaluate(quote => { const map=TyporaSideComments.collect(document.querySelector('#write')); const at=map.text.indexOf(quote); if(at<0)throw Error('missing '+quote); const range=TyporaSideComments.makeRange(map,at,at+quote.length); const s=getSelection();s.removeAllRanges();s.addRange(range);app.capture();},quote);
  try {
    await page.goto(base+'/demo.html'); await page.waitForFunction(()=>window.app?.state.data?.comments.length===2);
    ok(await page.locator('.tsc-card').count()===2,'seed comments and sidebar load');
    const initial=await page.locator('#write').innerHTML();
    await page.screenshot({path:path.join(root,'preview.png'),fullPage:true});
    await select('好的反馈，应该贴近它所讨论的文字。'); await page.keyboard.press('Control+Alt+m'); await page.getByRole('textbox',{name:'批注内容'}).fill('请补充一个具体的使用例子。'); await page.getByRole('button',{name:'保存批注',exact:true}).click(); await page.waitForFunction(()=>app.state.data.comments.length===3);
    ok(await page.locator('#write').innerHTML()===initial,'adding a comment does not mutate editor DOM');
    ok(await page.locator('.tsc-card').count()===3,'selected-text comment saved');
    await page.reload();await page.waitForFunction(()=>app?.state.data?.comments.length===3); ok(true,'saved comments restored after reload');
    await page.locator('.tsc-card').last().getByRole('button',{name:'编辑',exact:true}).click(); await page.getByRole('textbox',{name:'批注内容'}).fill('<img src=x onerror=alert(1)> 只应作为文本。'); await page.keyboard.press('Control+Enter'); await page.waitForFunction(()=>app.state.data.comments.at(-1).body.startsWith('<img'));
    ok(await page.locator('.tsc-body img').count()===0,'untrusted comment content renders as text');
    await page.locator('.tsc-card').last().getByRole('button',{name:'解决',exact:true}).click(); await page.waitForFunction(()=>app.state.data.comments.at(-1).status==='resolved');await page.getByRole('button',{name:'已解决',exact:true}).click();ok(await page.locator('.tsc-card').count()===1,'resolve and filter');
    await page.locator('.tsc-card').getByRole('button',{name:'重新打开',exact:true}).click();await page.waitForFunction(()=>app.state.data.comments.at(-1).status==='open');await page.getByRole('button',{name:'待处理',exact:true}).click();
    await select('我们希望保留安静的写作空间，同时让每一条意见都有明确的落点。');await page.keyboard.press('Control+Alt+m');await page.getByRole('textbox',{name:'批注内容'}).fill('包含加粗的普通正文。');await page.getByRole('button',{name:'保存批注',exact:true}).click();await page.waitForFunction(()=>app.state.data.comments.length===4);ok(true,'selection across hidden Markdown emphasis tokens');
    await page.locator('.tsc-card').first().getByRole('button',{name:'安静的写作空间',exact:true}).click();ok(await page.evaluate(()=>CSS.highlights.has('tsc-focus')),'click quote locates and highlights original');
    await page.evaluate(()=>{document.querySelector('#write strong').textContent='修改后的写作空间';});await page.waitForFunction(()=>app.locations.get(app.state.data.comments[0].id)?.status==='detached');await page.getByRole('button',{name:'需关联',exact:true}).click();ok(await page.locator('.tsc-card').count()>0,'changed original retained with detached status');
    await select('修改后的写作空间');await page.locator('.tsc-card').first().getByRole('button',{name:'重新关联',exact:true}).click();await page.getByRole('button',{name:'保存批注',exact:true}).click();await page.waitForFunction(()=>app.state.data.comments[0].anchor.quote==='修改后的写作空间');ok(true,'manual reassociation saves new range');
    await page.getByRole('button',{name:'全部',exact:true}).click();await page.locator('.tsc-card').last().getByRole('button',{name:'删除',exact:true}).click();await page.getByRole('button',{name:'确认删除',exact:true}).click();await page.waitForFunction(()=>app.state.data.comments.length===3);ok(true,'explicit delete confirmation removes only comment');
    // Fail an asynchronous save: preserve the user's note and existing data.
    await select('本地保存');await page.keyboard.press('Control+Alt+m');await page.getByRole('textbox',{name:'批注内容'}).fill('写失败后不能丢掉这段话。');await page.evaluate(()=>demo.fail=true);await page.getByRole('button',{name:'保存批注',exact:true}).click();await page.waitForFunction(()=>!app.saving&&document.querySelector('.tsc-notice').textContent.includes('模拟写入失败'));
    ok(await page.getByRole('textbox',{name:'批注内容'}).inputValue()==='写失败后不能丢掉这段话。','failed save preserves draft');await page.evaluate(()=>demo.fail=false);await page.getByRole('button',{name:'取消',exact:true}).click();
    // Document edit while the composer is open must invalidate new anchors.
    await select('本地保存');await page.keyboard.press('Control+Alt+m');await page.getByRole('textbox',{name:'批注内容'}).fill('内容变化测试');await page.evaluate(()=>document.querySelector('#write h1').append('改动'));await page.getByRole('button',{name:'保存批注',exact:true}).click();ok((await page.locator('.tsc-notice').innerText()).includes('正文发生变化'),'draft snapshot prevents stale-anchor commit');await page.getByRole('button',{name:'取消',exact:true}).click();
    // Selection from A cannot create a comment in B. Pending old writes cannot disable B.
    await select('本地保存');await page.keyboard.press('Control+Alt+m');await page.getByRole('textbox',{name:'批注内容'}).fill('只属于原文档。');await page.evaluate(()=>demo.wait=500);await page.getByRole('button',{name:'保存批注',exact:true}).click();
    ok(await page.getByRole('textbox',{name:'批注内容'}).isDisabled(),'textarea locked while save is in flight');
    await page.evaluate(async()=>{demo.path='另一篇.md';await app.load();});await page.waitForFunction(()=>!app.saving);ok(await page.getByRole('button',{name:'＋ 添加批注',exact:true}).isEnabled(),'new document usable after old save completes');ok(await page.evaluate(()=>app.state.data.comments.length===0),'old file write never contaminates new file');
    await page.getByRole('button',{name:'＋ 添加批注',exact:true}).click();ok((await page.locator('.tsc-notice').innerText()).includes('选中'),'stale selection rejected after file switch');
    // A → B → A while A's save is pending must reload the persisted version and clear its draft.
    await page.evaluate(async()=>{demo.path='侧边批注使用示例.md';demo.wait=500;await app.load();});
    await select('本地保存');await page.keyboard.press('Control+Alt+m');await page.getByRole('textbox',{name:'批注内容'}).fill('来回切换文档后仍能正确保存。');await page.getByRole('button',{name:'保存批注',exact:true}).click();
    await page.evaluate(async()=>{demo.path='另一篇.md';await app.load();demo.path='侧边批注使用示例.md';await app.load();});await page.waitForFunction(()=>!app.saving&&app.state.data.comments.some(c=>c.body==='来回切换文档后仍能正确保存。'));
    ok(await page.evaluate(()=>!app.drafts.has(demo.path)),'A to B to A reloads saved data and clears only persisted draft');
    // Cross-paragraph selections are rejected rather than saved with a misleading quote.
    await page.evaluate(()=>{const root=document.querySelector('#write'),nodes=root.querySelectorAll('h2');const range=document.createRange();range.setStart(nodes[0].firstChild,0);range.setEnd(nodes[1].firstChild,2);const s=getSelection();s.removeAllRanges();s.addRange(range);app.capture();});
    await page.keyboard.press('Control+Alt+m');ok((await page.locator('.tsc-notice').innerText()).includes('同一段'),'cross-paragraph selection gets an explicit limit');
    await page.evaluate(()=>{const p=document.createElement('p');p.innerHTML='文字<span class="md-emoji" data-emoji="😊">\u200b<span class="md-meta">:smile:</span>\u200b</span>结尾';document.querySelector('#write').append(p);const r=document.createRange();r.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(r);app.capture();});await page.keyboard.press('Control+Alt+m');ok((await page.locator('.tsc-notice').innerText()).includes('特殊编辑标记'),'attribute-rendered emoji refused safely');
    await page.evaluate(()=>{demo.source=true;});await page.waitForFunction(()=>app.state.source);ok(await page.getByRole('button',{name:'＋ 添加批注',exact:true}).isDisabled(),'source mode disables annotation');
    await page.evaluate(()=>{demo.source=false;});await page.waitForFunction(()=>!app.state.source);
    await page.setViewportSize({width:760,height:900});ok(await page.locator('.tsc-panel').evaluate(e=>e.getBoundingClientRect().right<=innerWidth),'narrow-window drawer fits viewport');
    await page.emulateMedia({media:'print'});ok(await page.locator('.tsc-panel').isHidden(),'sidebar hidden in print');await page.emulateMedia({media:'screen',colorScheme:'dark'});ok(await page.locator('.tsc-panel').evaluate(e=>getComputedStyle(e).backgroundColor==='rgb(32, 39, 39)'),'dark palette works');
    await page.emulateMedia({media:'screen',colorScheme:'light'});
    await page.goto(base+'/tests/boot-fixture.html');await page.waitForFunction(()=>window.__typoraSideComments?.state.data);
    ok(await page.evaluate(()=>fixtureCalls.includes('C:/fixture/resources/typora-side-comments/storage.cjs')),'independent loader resolves the documented Typora module path');
    await page.evaluate(async()=>{await File.editor.library.doSwitchByNode('C:/fixture/other.md');});await page.waitForFunction(()=>__typoraSideComments.state.path==='C:/fixture/other.md'&&!__typoraSideComments.state.loading);
    ok(await page.evaluate(()=>!__typoraSideComments.transition),'content-loaded adapter follows the host document switch');
    await page.evaluate(()=>__typoraSideComments.destroy());ok(await page.locator('.tsc-panel').count()===0 && await page.evaluate(()=>File.editor.library.doSwitchByNode===fixtureOriginalSwitch),'teardown removes UI and restores document-switch hook');
    ok(errors.length===0,'no uncaught browser errors'); console.log(`BROWSER CHECKS: ${checks} passed`);
  } finally { await browser.close(); server.close(); }
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
