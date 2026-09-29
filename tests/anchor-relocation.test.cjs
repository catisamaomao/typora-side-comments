'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../plugin/core.js'),Store=require('../plugin/storage.cjs');
const anchor=(text,quote,at=text.indexOf(quote))=>Core.createAnchor(text,at,at+quote.length,Store.hash(text));
const locate=(a,text)=>Core.locate(a,text,Store.hash(text));
const attached=(a,text,at=text.indexOf(a.quote))=>assert.deepEqual(locate(a,text),{status:'attached',start:at,end:at+a.quote.length});
const legacy=a=>{const copy={...a};delete copy.quoteUnique;return copy;};
test('nearby insertions, deletions and replacements before a quote move its offset',()=>{
 const old='章节开头。这里有一些说明。目标文字。后续说明。',a=anchor(old,'目标文字');
 for(const text of ['新增标题\n\n'+old,old.replace('目标','新增加的一段说明。目标'),old.replace('章节开头。这里有一些说明。',''),old.replace('这里有一些说明。','新说明。')])attached(a,text);
});
test('quotes at document boundaries survive prepending, appending and paragraph movement',()=>{
 for(const [old,quote,text]of [['目标文字后文','目标文字','新增标题\n\n目标文字后文'],['前文目标文字','目标文字','前文目标文字\n\n新增结尾'],['目标文字','目标文字','前言\n\n目标文字\n\n后记']])attached(anchor(old,quote),text);
});
test('unique quote survives changes to both sides without nearest-offset guessing',()=>{
 const old='旧前言。唯一原文。旧后记。',a=anchor(old,'唯一原文');
 attached(a,'完全不同的较长前言\n\n唯一原文\n\n另一个结尾');
 assert.equal(locate(a,'新前言唯一原文新后记\n另一处唯一原文').status,'ambiguous');
});
test('repeated quotes keep full-context relocation and reject nearby context changes',()=>{
 const quote='相同原文',p='a'.repeat(64),right1='b'.repeat(64),right2='c'.repeat(64);
 const old=p+quote+right1+'\n\n'+p+quote+right2,a=anchor(old,quote);
 assert.equal(a.quoteUnique,false);attached(a,'新增章节\n\n'+old);
 const inserted=old.slice(0,64)+'新增文字'+old.slice(64);assert.equal(locate(a,inserted).status,'detached');
 const old2=right1+quote+p+'\n\n'+right2+quote+p,b=anchor(old2,quote);
 assert.equal(locate(b,old2.slice(0,b.end)+'新增文字'+old2.slice(b.end)).status,'detached');
});
test('deletion cannot transfer a unique side to the surviving duplicate',()=>{
 const old='AQ QB';
 for(const at of [1,3])assert.equal(locate(anchor(old,'Q',at),'AQB').status,'detached');
});
test('deleting a duplicate cannot reuse a shared prefix or shared suffix',()=>{
 const q='Q',shared='x'.repeat(64),left='a'.repeat(64),right='b'.repeat(64);
 for(const [first,second]of [[shared+q+left,shared+q+right],[left+q+shared,right+q+shared]]){
  const old=first+'\n\n'+second,a=anchor(old,q);
  assert.equal(locate(a,second).status,'detached');
 }
});
test('changed contexts with multiple current quotes remain ambiguous',()=>{
 const old='a'.repeat(64)+'Q'+'b'.repeat(64),a=anchor(old,'Q');
 const now='a'.repeat(64)+'Q'+'x'.repeat(64)+'\n\n'+'y'.repeat(64)+'Q'+'b'.repeat(64);
 assert.equal(locate(a,now).status,'ambiguous');
});
test('deleted or edited quote stays detached and undo restores it',()=>{
 const old='前文需要批注的原文后文',a=anchor(old,'需要批注的原文');
 assert.equal(locate(a,'前文后文').status,'detached');
 assert.equal(locate(a,'前文已改写的原文后文').status,'detached');attached(a,old);
});
test('Unicode offsets remain UTF-16 offsets after shifting',()=>{
 const old='说明😊被批注🚀文字后文',a=anchor(old,'被批注🚀文字');
 attached(a,'新增🚅\n'+old.replace('说明','新的说明'));
});
test('legacy metadata is enriched only against the verified original document',()=>{
 const old='前文目标后文',a=legacy(anchor(old,'目标')),changed='前文插入的文字目标后文';
 assert.equal(locate(a,changed).status,'detached');
 assert.equal(Core.upgradeAnchor(a,changed,Store.hash(changed)),a);
 const enriched=Core.upgradeAnchor(a,old,Store.hash(old));
 assert.equal(enriched.quoteUnique,true);attached(enriched,changed);
 assert.equal(a.quoteUnique,undefined); // original serialized object is not mutated.
 const duplicate='a'.repeat(64)+'Q'+'b'.repeat(64)+'\n\n'+'a'.repeat(64)+'Q'+'c'.repeat(64);
 const previous=legacy(anchor(duplicate,'Q')),survivor=duplicate.slice(131);
 assert.equal(Core.upgradeAnchor(previous,survivor,Store.hash(survivor)),previous);
 assert.equal(locate(previous,survivor).status,'detached');
});
test('sidecar schema accepts legacy metadata and rejects invalid quote uniqueness',()=>{
 const text='前文目标后文',a=anchor(text,'目标');
 const document=Core.empty('example.md');document.comments.push({id:'comment-123',body:'未变的批注',status:'open',createdAt:'2026-09-29T00:00:00Z',updatedAt:'2026-09-29T00:00:00Z',anchor:a});
 assert.equal(Core.validate(document),document);document.comments[0].anchor=legacy(a);Core.validate(document);
 document.comments[0].anchor={...a,quoteUnique:'true'};assert.throws(()=>Core.validate(document),{code:'INVALID_UNIQUENESS'});
});
test('serialized anchor evidence preserves offsets after reopen without storing full text',()=>{
 const old='前言目标文字后文',a=anchor(old,'目标文字');
 const persisted=JSON.parse(JSON.stringify(a));attached(persisted,'新增并修改前言目标文字改过的后文');
 assert.deepEqual(Object.keys(persisted).sort(),['quote','prefix','suffix','start','end','digest','contextUnique','quoteUnique'].sort());
});
