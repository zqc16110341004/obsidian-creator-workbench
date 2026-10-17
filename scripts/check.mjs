import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const files=['server.mjs',...(await readdir('src')).filter(x=>x.endsWith('.js')).map(x=>'src/'+x)];
for(const file of files){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0){console.error(r.stderr);process.exit(1);}const text=await readFile(file,'utf8');for(const m of text.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)){await readFile(resolve(file,'..',m[1]));}}
await readFile('src/styles.css');await readFile('index.html');console.log(`Syntax and local imports passed (${files.length} modules).`);
