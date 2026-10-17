import {spawnSync} from 'node:child_process';
import {readFile,readdir,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
const out=resolve('obsidian-dist/creator-workbench');
await mkdir(out,{recursive:true});
const imports={};
for(const file of (await readdir('src')).filter(f=>f.endsWith('.js'))){
 let code=await readFile('src/'+file,'utf8');
 code=code.replace(/from\s+(['"])\.\/([^'"]+)\1/g,(_,quote,name)=>`from ${quote}workbench/${name}${quote}`);
 imports['workbench/'+file]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
const css=await readFile('src/styles.css','utf8');
const hostCSS='.obsidian-host .app-shell{grid-template-columns:minmax(0,1fr);padding:0;gap:0}.obsidian-host .rail,.obsidian-host .file-sidebar{display:none}.obsidian-host .workspace{border:0;border-radius:0}.obsidian-host .topbar{padding-top:18px}';
let html=await readFile('index.html','utf8');
html=html.replace('<meta charset="utf-8">','<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' data:; style-src \'unsafe-inline\'; img-src data: blob:; media-src blob: data:; connect-src \'none\'; font-src \'none\';">');
html=html.replace('<link rel="stylesheet" href="/src/styles.css">',`<style>${css}\n${hostCSS}</style>`);
html=html.replace('<script type="module" src="/src/app.js"></script>',`<script>window.__CREATOR_HOST__=parent.__creatorWorkbenchHosts.get(__WORKBENCH_TOKEN__);</script><script type="importmap">${JSON.stringify({imports})}</script><script type="module">import 'workbench/app.js';</script>`);
await writeFile(out+'/workbench.html',html);
async function bundleCjs(file){
 let code=await readFile(file,'utf8');
 for(const match of [...code.matchAll(/require\('(.\/[^']+\.cjs)'\)/g)]){
  const dependency=await bundleCjs(resolve(file,'..',match[1]));
  code=code.replaceAll(match[0],()=>`(()=>{const module={exports:{}};${dependency}\nreturn module.exports;})()`);
 }
 return code;
}
const main=await bundleCjs(resolve('obsidian-plugin/main.cjs'));
await writeFile(out+'/main.js',main);
for(const name of ['manifest.json','styles.css'])await copyFile('obsidian-plugin/'+name,out+'/'+name);
await copyFile('native/transcribe.py',out+'/transcribe.py');
console.log('Offline Obsidian plugin built:',out);

if(process.platform==='darwin'){const result=spawnSync('/usr/bin/swiftc',['-O','-module-cache-path',process.env.TMPDIR||'/tmp','native/recognize.swift','-o',out+'/recognize-macos'],{encoding:'utf8'});if(result.status!==0)throw Error('Local OCR build failed: '+result.stderr);}

for(const name of ['README.md','HELP.md','FEISHU_SETUP.md','LICENSE'])await copyFile(name,out+'/'+name);
