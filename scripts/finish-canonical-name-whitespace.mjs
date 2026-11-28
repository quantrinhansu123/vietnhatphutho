import {readFile,writeFile,readdir} from 'node:fs/promises';import path from 'node:path';
const root='outputs/remove-ten-ghep-final/code-before';async function files(d){let out=[];for(const e of await readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
for(const f of await files(root)){const src=path.relative(root,f).replace(/\.bak$/,'');if(!/\.tsx?$/.test(src))continue;let text=await readFile(src,'utf8');text=text.replace(/[\t ]+(?=\r?$)/gm,'');await writeFile(src,text);}
