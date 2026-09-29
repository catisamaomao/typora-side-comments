// Tiny local Chromium test driver; uses only Node built-ins and the installed browser.
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));
class Connection {
  constructor(ws) { this.ws = ws; this.seq = 0; this.pending = new Map(); this.listeners = new Map(); ws.addEventListener('message', e => { const value = JSON.parse(e.data); if (value.id) { const p = this.pending.get(value.id); if (!p) return; this.pending.delete(value.id); value.error ? p.reject(Error(value.error.message)) : p.resolve(value.result); } else for (const fn of this.listeners.get(value.method) || []) fn(value.params); }); }
  send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++this.seq; const timeout=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout: '+method));},12000); this.pending.set(id, {resolve:v=>{clearTimeout(timeout);resolve(v)},reject:e=>{clearTimeout(timeout);reject(e)}}); this.ws.send(JSON.stringify({id,method,params})); }); }
  async evaluate(fn, arg) {
    const expression = typeof fn === 'string' ? fn : `(${fn.toString()})(${JSON.stringify(arg) ?? ''})`;
    const r = await this.send('Runtime.evaluate', {expression,awaitPromise:true,returnByValue:true,userGesture:true});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
}
function elements(steps) {
  let found = [document];
  for (const step of steps) {
    if (step.index !== undefined) { const index = step.index < 0 ? found.length + step.index : step.index; found = found[index] ? [found[index]] : []; continue; }
    const selector = step.role ? ({button:'button,[role="button"]',textbox:'textarea,input,[role="textbox"]'}[step.role]) : step.selector;
    found = found.flatMap(parent => [...parent.querySelectorAll(selector)]);
    if (step.name !== undefined) found = found.filter(e => { const name = e.getAttribute('aria-label') || e.textContent.trim(); return step.exact ? name === step.name : name.includes(step.name); });
  }
  return found;
}
class Locator {
  constructor(page, steps) { this.page = page; this.steps = steps; }
  locator(selector) { return new Locator(this.page, [...this.steps, {selector}]); }
  getByRole(role, options={}) { return new Locator(this.page, [...this.steps, {role,...options}]); }
  first() { return new Locator(this.page, [...this.steps, {index:0}]); }
  last() { return new Locator(this.page, [...this.steps, {index:-1}]); }
  async exec(fn, arg, all=false) { return this.page.evaluate(`(${fn.toString()})((${elements.toString()})(${JSON.stringify(this.steps)})${all?'':'[0]'},${JSON.stringify(arg)??'undefined'})`); }
  async wait() { const start=Date.now(); while (await this.count()===0) { if(Date.now()-start>7000)throw Error('Element missing: '+JSON.stringify(this.steps)); await sleep(20); } }
  async count() { return this.exec(es=>es.length,undefined,true); }
  async click() {
    await this.wait(); const box=await this.exec(e=>{ e.scrollIntoView({block:'nearest'}); const b=e.getBoundingClientRect(); if(e.disabled)throw Error('Button is disabled');return {x:b.x+b.width/2,y:b.y+b.height/2}; });
    await this.page.c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box}); await this.page.c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box}); await sleep(15);
  }
  async fill(value) { await this.wait(); await this.exec((e,v)=>{if(e.disabled)throw Error('Input disabled');e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value); }
  inputValue() { return this.exec(e=>e.value); }
  innerHTML() { return this.exec(e=>e.innerHTML); }
  innerText() { return this.exec(e=>e.innerText); }
  isDisabled() { return this.exec(e=>!!e.disabled); }
  isEnabled() { return this.exec(e=>!e.disabled); }
  isHidden() { return this.exec(e=>!e||getComputedStyle(e).display==='none'||e.getBoundingClientRect().width===0); }
  evaluate(fn) { return this.exec(fn); }
}
class Page {
  constructor(c) { this.c=c; this.keyboard={press:async combo=>{const keys=combo.split('+'); const name=keys.at(-1);const modifiers=(keys.includes('Alt')?1:0)|(keys.includes('Control')?2:0)|(keys.includes('Shift')?8:0);const code=name==='Enter'?'Enter':'Key'+name.toUpperCase();const key=name==='Enter'?'Enter':name;await c.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers,windowsVirtualKeyCode:name==='Enter'?13:name.toUpperCase().charCodeAt(0)});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers});}}; }
  evaluate(fn,arg) { return this.c.evaluate(fn,arg); }
  locator(selector) { return new Locator(this,[{selector}]); }
  getByRole(role,opts) { return new Locator(this,[{role,...opts}]); }
  async goto(url) { await this.c.send('Page.navigate',{url}); await this.waitForFunction(()=>document.readyState==='complete'); }
  async reload() { await this.c.send('Page.reload'); await sleep(50); await this.waitForFunction(()=>document.readyState==='complete'); }
  async waitForFunction(fn) { const start=Date.now();for(;;){try{if(await this.evaluate(fn))return;}catch{}if(Date.now()-start>10000)throw Error('Wait timed out: '+fn);await sleep(25);} }
  on(event,fn) { if(event==='pageerror') this.c.listeners.set('Runtime.exceptionThrown',[p=>fn({message:p.exceptionDetails.exception?.description||p.exceptionDetails.text})]); }
  async screenshot({path:target}) { const r=await this.c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(target,Buffer.from(r.data,'base64')); }
  setViewportSize({width,height}) { return this.c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false}); }
  async emulateMedia(opts) { await this.c.send('Emulation.setEmulatedMedia',{media:opts.media||'screen',features:opts.colorScheme?[{name:'prefers-color-scheme',value:opts.colorScheme}]:[]}); }
}
const chromium={async launch({executablePath}){
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'typora-comments-chrome-'));
  const child=spawn(executablePath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-sync','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',d=>{const s=d.toString();if(/DevTools|ERROR|FATAL/.test(s))console.log(s.trim().slice(0,600));}); child.on('error',e=>console.error('Browser launch error',e.message));
  let port;const start=Date.now();for(;;){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{}if(Date.now()-start>10000)throw Error('Chromium did not start');await sleep(50);}
  console.log('Test browser listening on '+port);
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(5000)})).json();const target=targets.find(t=>t.type==='page');const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('WebSocket connection timeout')),5000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});ws.addEventListener('error',reject,{once:true});});
  const c=new Connection(ws);await c.send('Runtime.enable');await c.send('Page.enable');
  return {async newPage(opts){const p=new Page(c);await p.setViewportSize(opts.viewport);return p;},async close(){await c.send('Browser.close').catch(()=>{});ws.close();await sleep(250);child.kill();await fs.rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:200}).catch(()=>{});}};
}};
module.exports={chromium};
