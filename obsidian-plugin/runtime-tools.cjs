const fs=require('node:fs');
const path=require('node:path');
function executableFile(file){try{fs.accessSync(file,fs.constants.X_OK);return fs.statSync(file).isFile();}catch{return false;}}
function resolveTool(name,{env=process.env,exists=executableFile}={}){
 const key='CREATOR_WORKBENCH_'+name.toUpperCase();
 if(env[key])return path.isAbsolute(env[key])&&exists(env[key])?env[key]:'';
 const known=name==='codex'?['/Applications/Codex.app/Contents/Resources/codex','/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex']:[];
 if(name==='python3')known.push('/Library/Frameworks/Python.framework/Versions/3.11/bin/python3');
 for(const dir of ['/opt/homebrew/bin','/usr/local/bin',...(env.PATH||'').split(path.delimiter),'/usr/bin'])if(dir&&path.isAbsolute(dir))known.push(path.join(dir,name));
 return [...new Set(known)].find(exists)||'';
}
module.exports={resolveTool,executableFile};
