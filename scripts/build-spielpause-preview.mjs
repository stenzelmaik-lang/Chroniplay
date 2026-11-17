// Bundle the actual production component into an offline review artifact.
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const alias=['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom/client'].map(name=>({find:new RegExp('^'+name+'$'),replacement:require.resolve(name)}));
const out=resolve('.local-work/spielpause-preview');
await build({configFile:false,plugins:[react()],define:{'process.env.NODE_ENV':'"production"'},resolve:{alias},build:{outDir:out,emptyOutDir:true,minify:true,cssCodeSplit:false,lib:{entry:resolve('tests/fixtures/spielpause-preview.tsx'),name:'SpielpausePreview',formats:['iife'],fileName:()=> 'preview.js'}}});
let js=readFileSync(join(out,'preview.js'),'utf8');
for(const asset of ['graf-knautsch.webp','vampir-spinner.webp'])js=js.replaceAll('/spielpause/'+asset,'data:image/webp;base64,'+readFileSync('public/spielpause/'+asset).toString('base64'));
const css=readdirSync(out).filter(n=>n.endsWith('.css')).map(n=>readFileSync(join(out,n),'utf8')).join('\n');
const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ChroniPlay · Spielpause am Spieltisch</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;--cp-surface-1:#101b1f;--cp-surface-2:#1b2a2c;--cp-line:#c5a46a40;--cp-text:#eee8dc;--cp-text-muted:#b7bdb6;--cp-radius:6px;--cp-focus:#e9c985;--cp-gold:#d6b36f;--cp-font-text:Arial,sans-serif;--cp-font-title:Georgia,serif}button{cursor:pointer}${css}</style><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script></html>`;
mkdirSync('outputs',{recursive:true});
writeFileSync('outputs/ChroniPlay-Spieltisch-Spielpause.html',html);
console.log(resolve('outputs/ChroniPlay-Spieltisch-Spielpause.html'));
