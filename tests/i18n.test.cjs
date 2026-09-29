'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I18n = require('../plugin/i18n.js');
test('every translation has three nonempty values and matching placeholders', () => {
  for (const [key, values] of Object.entries(I18n.messages)) {
    assert.equal(values.length, 3, key);
    const placeholders = value => [...value.matchAll(/\{\w+\}/g)].map(x => x[0]).sort();
    for (const value of values) {
      assert.ok(typeof value === 'string' && value.trim(), key);
      assert.deepEqual(placeholders(value), placeholders(values[0]), key);
    }
  }
});
test('regional languages normalize; unsupported languages do not silently match', () => {
  for (const [input, output] of [['zh-Hans','zh-CN'],['zh-TW','zh-CN'],[' en_GB ','en'],['ja-JP','ja'],['fr-FR',null],[undefined,null]]) assert.equal(I18n.normalize(input),output);
});
test('saved preference wins, supported system languages follow, English is fallback', () => {
  const host = {localStorage:{getItem:()=> 'ja'},navigator:{languages:['zh-CN','en']}};
  assert.equal(I18n.initialLanguage(host),'ja');
  host.localStorage.getItem = () => 'invalid';
  assert.equal(I18n.initialLanguage(host),'zh-CN');
  host.navigator.languages = ['fr-FR','en-GB'];
  assert.equal(I18n.initialLanguage(host),'en');
  host.navigator = {language:'ja-JP'};
  assert.equal(I18n.initialLanguage(host),'ja');
  host.navigator = {languages:['de']};
  assert.equal(I18n.initialLanguage(host),'en');
});
test('blocked storage does not prevent initialization or language selection', () => {
  const host = {get localStorage(){throw Error('blocked');},navigator:{language:'ja'}};
  assert.equal(I18n.initialLanguage(host),'ja');
  assert.equal(I18n.remember(host,'en'),false);
  let saved;
  assert.equal(I18n.remember({localStorage:{setItem:(key,value)=>saved=[key,value]}},'ja-JP'),true);
  assert.deepEqual(saved,[I18n.storageKey,'ja']);
});
test('keyed and filesystem errors translate without exposing raw paths', () => {
  for (const locale of Object.keys(I18n.languages)) {
    for (const [code,key] of [['EPERM','PERMISSION'],['EACCES','PERMISSION'],['EROFS','PERMISSION'],['EBUSY','FILE_BUSY'],['EEXIST','FILE_BUSY'],['ENOSPC','ENOSPC'],['CORRUPT','CORRUPT'],['CONFLICT','CONFLICT']]) {
      assert.equal(I18n.error(locale,{code,message:'private path'}),I18n.t(locale,key));
    }
    assert.equal(I18n.error(locale,I18n.failure('READ_TOO_LARGE','TOO_LARGE')),I18n.t(locale,'READ_TOO_LARGE'));
    assert.equal(I18n.error(locale,Error('private path')),I18n.t(locale,'UNKNOWN_ERROR'));
    assert.equal(I18n.error(locale,''),'');
    assert.ok(I18n.t(locale,'BOOT_FAILED',{detail:'detail'}).includes('detail'));
  }
});
test('all literal UI, loader, core and storage message keys have translations', () => {
  const root = path.join(__dirname,'../plugin');
  for (const file of ['ui.js','boot.js','core.js','storage.cjs']) {
    const source = fs.readFileSync(path.join(root,file),'utf8');
    const patterns = [/\b(?:failure|coded|this\.t|this\.message)\('([^']+)'/g, /assert\([^\n]*?,\s*'([^']+)'\)/g];
    for (const pattern of patterns) for (const match of source.matchAll(pattern)) {
      if (['TOO_LARGE'].includes(match[1])) continue; // storage supplies a more specific i18nKey.
      assert.ok(Object.hasOwn(I18n.messages,match[1]),file+': '+match[1]);
    }
  }
});
test('date formatting matches each selected locale without changing the timestamp', () => {
  const value='2026-09-29T05:06:00.000Z';
  for (const [locale,intl] of [['zh-CN','zh-CN'],['en','en-US'],['ja','ja-JP']]) assert.equal(I18n.date(locale,value),new Date(value).toLocaleString(intl,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}));
});
