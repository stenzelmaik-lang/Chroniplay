// Spieltisch: „Druck“, das eigene Charakterpanel und die Spielerleiste lassen sich ein- und ausblenden.
// Wish of the SL (21.11.2026). Folded, a small handle stays in the same place; the choice survives a reload per device
// and changes no data. Checked for players and the SL at 1440 and 375 px, plus a browser whose storage throws.
// Run only against a disposable, synthetic local --zustandswerte fixture:
//   CVK_TEST_URL=http://127.0.0.1:8862 node tests/hud-einklappen-browser.mjs
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8862';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
const browser=await chromium.launch({headless:true,...(process.env.CVK_BROWSER_CHANNEL?{channel:process.env.CVK_BROWSER_CHANNEL}:{})});
const out='.local-work/hud-einklappen';mkdirSync(out,{recursive:true});
const errors=[];const pass=name=>console.log('PASS '+name);
const viewports={wide:{viewport:{width:1440,height:900}},narrow:{viewport:{width:375,height:812},isMobile:true,hasTouch:true,deviceScaleFactor:2}};
async function login(id,options,init){
 const context=await browser.newContext(options);if(init)await context.addInitScript(init);
 const r=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});
 assert.equal(r.status(),200,'login '+id);return context;
}
async function table(context,label){
 const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(label+': '+e.message));
 await p.goto(base+'/spielbereich?bereich=sitzung');await p.getByRole('button',{name:'Spielpause',exact:true}).waitFor();return p;
}
/** The control is really on top at its centre (not covered) and offers a touch target of at least 44 px. */
async function reachable(p,locator,label){
 await locator.waitFor();const box=await locator.boundingBox();assert.ok(box,label+' has a box');
 const vp=p.viewportSize();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=vp.width+0.5&&box.y+box.height<=vp.height+0.5,label+' inside the viewport');
 const hit=await locator.evaluate((el,[x,y])=>{const top=document.elementFromPoint(x,y);return !!top&&(top===el||el.contains(top));},[box.x+box.width/2,box.y+box.height/2]);
 assert.ok(hit,label+' is the topmost element at its centre');
 // Visible tab may be smaller; its hit area (incl. ::before) must reach 44 px in height and width.
 const area=await locator.evaluate(el=>{const r=el.getBoundingClientRect(),b=getComputedStyle(el,'::before');let top=r.top,bottom=r.bottom;
  if(b.content!=='none'&&b.position==='absolute'){top=r.top+parseFloat(b.top||'0');bottom=r.bottom-parseFloat(b.bottom||'0');}return {h:bottom-top,w:r.width};});
 assert.ok(area.h>=44&&area.w>=40,label+' touch target '+JSON.stringify(area));
}
async function toggle(p,{name,open,openLabel,foldLabel,tag}){
 const fold=p.getByRole('button',{name:foldLabel,exact:true}),handle=p.getByRole('button',{name:openLabel});
 await open().waitFor();await reachable(p,fold,tag+' fold');
 await fold.click();await handle.waitFor();assert.equal(await open().count(),0,tag+' is folded away');
 await reachable(p,handle,tag+' handle');assert.equal(await handle.getAttribute('aria-expanded'),'false');
 await p.screenshot({path:out+'/'+tag.replace(/\W+/g,'-')+'-eingeklappt.png'});
 await p.reload();await p.getByRole('button',{name:'Spielpause',exact:true}).waitFor();
 await handle.waitFor();assert.equal(await open().count(),0,tag+' stays folded after reload');
 await handle.click();await open().waitFor();assert.equal(await fold.getAttribute('aria-expanded'),'true');
 await p.reload();await p.getByRole('button',{name:'Spielpause',exact:true}).waitFor();
 await open().waitFor();assert.equal(await handle.count(),0,tag+' stays open after reload');
 pass(tag+': '+name+' folds, the handle reopens it, both states survive a reload');
}
try{
 // A shared SL image opens as a modal by design; withdraw it so the table itself is visible (same as the Spielpause test).
 {const gm=await login('command-gm',viewports.wide);const active=await (await gm.request.get(base+'/api/live-table?view=active')).json();
  assert.ok(active.room?.started&&active.room.title.startsWith('SYNTHETISCH'),'synthetic evening must be running');
  const initial=await (await gm.request.get(base+'/api/live-stage?sessionId='+active.room.sessionId)).json();
  if(initial.media?.id)assert.equal((await gm.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideMedia',sessionId:active.room.sessionId,runId:active.room.runId,eventId:initial.media.id}})).status(),200);
  await gm.close();}
 for(const [size,options] of Object.entries(viewports)){
  for(const id of ['command-a','command-gm']){
   const role=id==='command-gm'?'SL':'Spieler A',context=await login(id,options),p=await table(context,role+' '+size),tag=role+' '+size;
   await toggle(p,{name:'Druck',tag:tag+' Druck',open:()=>p.getByRole('button',{name:'Stress und Maskerade öffnen'}),openLabel:'Druck einblenden',foldLabel:'Druck ausblenden'});
   await toggle(p,{name:'Spielerleiste',tag:tag+' Spielerleiste',open:()=>p.getByRole('navigation',{name:'Spielerleiste'}),openLabel:/^Spielerleiste einblenden/,foldLabel:'Spielerleiste ausblenden'});
   if(id==='command-a')await toggle(p,{name:'Charakterpanel',tag:tag+' Charakterpanel',open:()=>p.getByRole('button',{name:/^Zustand von /}),openLabel:'Charakterpanel einblenden',foldLabel:'Charakterpanel ausblenden'});
   else assert.equal(await p.getByRole('button',{name:'Charakterpanel ausblenden'}).count(),0,'the SL has no own panel at the table by default');
   // Each part is independent: folding one leaves the others where they are.
   await p.getByRole('button',{name:'Druck ausblenden'}).click();
   await p.getByRole('navigation',{name:'Spielerleiste'}).waitFor();
   if(id==='command-a')await p.getByRole('button',{name:/^Zustand von /}).waitFor();
   await p.getByRole('button',{name:'Druck einblenden'}).click();
   pass(tag+': parts fold independently');
   await context.close();
  }
 }
 // A browser that refuses storage still renders the table and folds for this visit.
 {
  const context=await login('command-a',viewports.wide,()=>{const deny=()=>{throw new Error('denied');};Object.defineProperty(window,'localStorage',{configurable:true,get:deny});});
  const p=await table(context,'ohne Speicher');
  await p.getByRole('button',{name:'Druck ausblenden'}).click();await p.getByRole('button',{name:'Druck einblenden'}).waitFor();
  await p.reload();await p.getByRole('button',{name:'Stress und Maskerade öffnen'}).waitFor();
  pass('storage blocked: table works, folding lasts for the visit only');
  await context.close();
 }
 // Folding is a view choice only: the server snapshot looks the same before and after.
 {
  const context=await login('command-a',viewports.wide),p=await table(context,'Daten');
  const active=await (await context.request.get(base+'/api/live-table?view=active')).json();
  const snap=async()=>{const s=await (await context.request.get(base+'/api/live-stage?sessionId='+encodeURIComponent(active.room.sessionId))).json();return JSON.stringify({vitals:s.vitals,crew:s.crew?.map(m=>m.id)});};
  const before=await snap();
  await p.getByRole('button',{name:'Druck ausblenden'}).click();await p.getByRole('button',{name:'Spielerleiste ausblenden'}).click();
  assert.equal(await snap(),before,'no server state changes');
  const sent=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('chroniplay:spieltisch:eingeklappt:')).sort());
  assert.deepEqual(sent,['chroniplay:spieltisch:eingeklappt:pressure','chroniplay:spieltisch:eingeklappt:roster']);
  await p.evaluate(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('chroniplay:spieltisch:eingeklappt:'))localStorage.removeItem(k);});
  pass('folding changes no server data; only two local view keys, removed again');
  await context.close();
 }
 assert.deepEqual(errors,[],'no page errors');
 pass('no page errors');
}finally{await browser.close();}
