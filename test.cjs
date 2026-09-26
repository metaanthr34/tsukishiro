// Lightweight behavior checks: node --test test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function app(initial=null){
  const nodes=new Map();let stored=initial,failed=false,download;
  function element(){return {value:'',textContent:'',hidden:false,dataset:{},children:[],events:{},classList:{add(){},remove(){}},addEventListener(n,fn){this.events[n]=fn},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},setAttribute(){},setCustomValidity(s){this.validation=s},reportValidity(){},focus(){},scrollIntoView(){},showModal(){this.open=true},close(){this.open=false},remove(){},click(){},reset(){for(const id of ['poem','kigo','memo'])get(id).value=''}}}
  function get(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}
  const ctx=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[],createElement:element,body:element()},localStorage:{getItem:()=>stored,setItem:(k,v)=>{if(failed)throw Error('quota');stored=v}},window:{addEventListener(){}},crypto:{randomUUID:()=>Math.random().toString(36)},matchMedia:()=>({matches:false}),setTimeout:()=>0,clearTimeout(){},Blob,URL:{createObjectURL:b=>{download=b;return 'blob:test'},revokeObjectURL(){}},console});
  vm.runInContext(source,ctx);
  return {get,run:expr=>vm.runInContext(expr,ctx),save(poem='秋の風\n余白にひとつ\n句を書き留む'){get('poem').value=poem;get('entry-form').events.submit({preventDefault(){}})},stored:()=>stored,fail:()=>failed=true,download:()=>download};
}
test('saving, editing and reloading retain one entry',()=>{const a=app();a.save();assert.equal(JSON.parse(a.stored()).length,1);a.run('openEditor(entries[0])');a.get('memo').value='推敲';a.save('秋の風');const result=JSON.parse(a.stored());assert.equal(result.length,1);assert.equal(result[0].memo,'推敲');assert.equal(app(a.stored()).run('entries[0].poem'),'秋の風')});
test('whitespace is rejected and failed writes preserve draft and previous data',()=>{const a=app();a.save('  ');assert.equal(a.stored(),null);a.save();const previous=a.stored();a.fail();a.save('保存できない句');assert.equal(a.stored(),previous);assert.equal(a.get('poem').value,'保存できない句');assert.equal(a.get('storage-error').hidden,false)});
test('corrupted stored data is not overwritten',()=>{const a=app('{broken');a.save();assert.equal(a.stored(),'{broken');assert.equal(a.run('storageOK'),false)});
test('export and restore round trip, requiring confirmation',async()=>{const a=app();a.save();a.get('export').events.click();const backup=await a.download().text();assert.equal(JSON.parse(backup).entries.length,1);const b=app();await b.get('import-file').events.change({target:{files:[{size:backup.length,text:async()=>backup}],value:'file'}});assert.equal(b.stored(),null);assert.equal(b.get('confirm-dialog').open,true);b.get('confirm-ok').events.click();assert.deepEqual(JSON.parse(b.stored()),JSON.parse(a.stored()))});
test('invalid backup leaves the current notebook unchanged',async()=>{const a=app();a.save();const previous=a.stored();const bad=JSON.stringify({app:'tsukishiro',version:1,entries:[{id:'x',poem:'句',date:'2026-02-30',season:'秋',memo:'',kigo:'',favorite:false}]});await a.get('import-file').events.change({target:{files:[{size:bad.length,text:async()=>bad}],value:'file'}});assert.equal(a.stored(),previous);assert.notEqual(a.get('confirm-dialog').open,true)});
test('duplicates and impossible dates are rejected',()=>{const a=app();a.save();assert.equal(a.run('validEntries([entries[0],entries[0]])'),false);assert.equal(a.run("validDate('2026-02-29')"),false);assert.equal(a.run("validDate('2024-02-29')"),true)});
