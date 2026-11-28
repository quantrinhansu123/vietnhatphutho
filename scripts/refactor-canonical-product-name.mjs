import ts from 'typescript';import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';import path from 'node:path';
const backup='outputs/remove-ten-ghep-final/code-before';
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else if(/\.tsx?$/.test(p)&&!p.includes('App.monolith.backup'))out.push(p);}return out;}
const legacyKey=n=>ts.isIdentifier(n)||ts.isStringLiteral(n)?n.text:'';
const keyMap=k=>k==='ten_ghep'?'ten_san_xuat':k==='tenGhep'?'productionName':null;
const symbol=n=>n.replace(/TenGhep/g,'ProductionName').replace(/tenGheps/g,'productionNames').replace(/tenGhep/g,'productionDisplayName').replace(/ten_ghep/g,'production_display_name');
for(const file of [...await files('src'),'server.ts']){
 let text=await readFile(file,'utf8');if(!/ten_ghep|tenGhep|TenGhep/.test(text))continue;
 // Tests retain old-key fixtures, but use the current engine function/property names.
 if(/\.test\./.test(file)){const next=text.replace(/TenGhep/g,'ProductionName').replace(/\b(seed(?:ed)?|parts|sp)\.tenGhep\b/g,'$1.productionName');if(next!==text){await mkdir(path.dirname(path.join(backup,file)),{recursive:true});await writeFile(path.join(backup,file),text);await writeFile(file,next);}continue;}
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const edits=[];
 const replace=(node,value)=>edits.push({start:node.getStart(source),end:node.getEnd(),value});
 function siblingHas(node,key){const p=node.parent;const list=ts.isObjectLiteralExpression(p)?p.properties:('members'in p?p.members:[]);return list?.some(n=>n!==node&&n.name&&legacyKey(n.name)===key);}
 function removeMember(node){let start=node.getStart(source),end=node.getEnd();if(text[end]===',')end++;else{let i=start-1;while(/\s/.test(text[i]||'')&&i>=0)i--;if(text[i]===',')start=i;}edits.push({start,end,value:''});}
 function visit(node){
  // Discard keys at the API boundary, without changing canonical fields.
  if(ts.isVariableDeclaration(node)&&ts.isObjectBindingPattern(node.name)&&node.name.elements.some(e=>e.propertyName&&legacyKey(e.propertyName)==='ten_ghep'))return;
  if((ts.isPropertyAssignment(node)||ts.isPropertySignature(node)||ts.isShorthandPropertyAssignment(node))&&node.name){const key=legacyKey(node.name),next=keyMap(key);if(next){if(siblingHas(node,next)){removeMember(node);return;}if(ts.isShorthandPropertyAssignment(node)){replace(node,`${next}: ${symbol(key)}`);return;}replace(node.name,ts.isStringLiteral(node.name)?JSON.stringify(next):next);if(ts.isPropertyAssignment(node))visit(node.initializer);if(ts.isPropertySignature(node)&&node.type)visit(node.type);return;}}
  if(ts.isPropertyAccessExpression(node)&&keyMap(node.name.text)){visit(node.expression);replace(node.name,keyMap(node.name.text));return;}
  if(ts.isStringLiteral(node)&&keyMap(node.text)){replace(node,JSON.stringify(keyMap(node.text)));return;}
  if(ts.isIdentifier(node)&&/ten_ghep|tenGhep|TenGhep/.test(node.text)){replace(node,symbol(node.text));return;}
  ts.forEachChild(node,visit);
 }
 visit(source);edits.sort((a,b)=>b.start-a.start);let last=text.length;for(const e of edits){if(e.end>last)throw Error('overlapping edits '+file);text=text.slice(0,e.start)+e.value+text.slice(e.end);last=e.start;}
 text=text.replace(/([\w?.]+\.productionName)\s*\|\|\s*\1/g,'$1').replace(/([\w?.]+\.ten_san_xuat)\s*\?\?\s*\1/g,'$1');
 await mkdir(path.dirname(path.join(backup,file)),{recursive:true});await writeFile(path.join(backup,file),await readFile(file));await writeFile(file,text);console.log(file);
}
