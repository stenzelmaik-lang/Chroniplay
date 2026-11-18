// Run against a disposable, synthetic local --zustandswerte fixture only.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8847';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const out='.local-work/spielpause-qa';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CVK_BROWSER_CHANNEL?{channel:process.env.CVK_BROWSER_CHANNEL}:{})});
const errors=[],checks=[];
const pass=name=>{checks.push(name);console.log('PASS '+name);};
let page;
try {
  async function login(id,extra={}) {
    const context=await browser.newContext({viewport:{width:1440,height:1000},...extra});
    const r=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});
    assert.equal(r.status(),200);return context;
  }
  const a=await login('command-a'),b=await login('command-b'),gm=await login('command-gm');
  const active=await (await gm.request.get(base+'/api/live-table?view=active')).json();
  assert.ok(active.room?.started&&active.room.title.startsWith('SYNTHETISCH'));
  const snapshot=async c=>(await (await c.request.get(base+'/api/live-stage?sessionId='+active.room.sessionId)).json());
  const initial=await snapshot(gm);
  for(const [action,eventId] of [['hideMedia',initial.media?.id],['hideScene',initial.sceneEventId]])if(eventId){
    const r=await gm.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action,sessionId:active.room.sessionId,runId:active.room.runId,eventId}});assert.equal(r.status(),200);
  }
  const oldDeliveries=await (await gm.request.get(base+'/api/live-deliveries?sessionId='+active.room.sessionId)).json();
  for(const delivery of oldDeliveries.runs||[])if(!delivery.withdrawnAt){
    const r=await gm.request.post(base+'/api/live-deliveries',{headers:{Origin:base},data:{action:'withdraw',sessionId:active.room.sessionId,runId:delivery.id}});assert.equal(r.status(),200);
  }
  const before=await snapshot(a);
  page=await a.newPage();page.on('pageerror',e=>errors.push(e.message));
  const writes=[];page.on('request',r=>{
    if(r.method()!=='POST'||!/api\/(live-stage|live-table|live-vitals|records|xp)/.test(r.url()))return;
    const body=r.postDataJSON();
    if(r.url().endsWith('/api/live-table')&&['join','pulse','leave'].includes(body.action))return;
    writes.push({url:r.url(),body});
  });
  await page.goto(base+'/spielbereich?bereich=sitzung');await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'Spielpause',exact:true}).waitFor();
  const root=page.locator('[data-spielpause]');
  const id=name=>page.locator('[data-toy-id="'+name+'"]');
  const choose=async name=>{
    await page.getByRole('button',{name:'Spielpause',exact:true}).click();
    await page.getByRole('complementary',{name:'Spielpause auswählen'}).getByRole('button',{name,exact:true}).click();
  };
  const ready=()=>page.waitForFunction(()=>document.querySelector('[data-spielpause]')?.dataset.phase==='ready');
  const paint=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const pixels=async canvas=>{await paint();return canvas.evaluate(c=>c.toDataURL());};
  await choose('Rubikwürfel');
  assert.equal(await root.getAttribute('data-phase'),'entrance');assert.equal(await id('cube-state').textContent(),'Gelöst');
  await page.screenshot({path:out+'/cube-fall.png'});
  await page.waitForFunction(()=>document.querySelector('[data-spielpause]')?.dataset.phase==='mixing');
  await page.screenshot({path:out+'/cube-mixing.png'});await ready();
  assert.equal(await id('cube-count').textContent(),'0');assert.equal(await id('cube-state').textContent(),'Noch ein Dreh');
  await page.screenshot({path:out+'/cube-desktop.png'});pass('Actual rail entry; solved fall, animated legal mixing, then ready');

  await page.emulateMedia({reducedMotion:'reduce'});
  await id('cube-reset').click();const solved=await pixels(id('cube-canvas'));
  for(const key of ['w','a','s','d','q','e','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']) {
    await id('cube-canvas').focus();await page.keyboard.press(key);
    await page.waitForFunction(()=>document.querySelector('[data-toy-id="cube-count"]').textContent==='1');
    assert.notEqual(await pixels(id('cube-canvas')),solved,key+' turns');
    await page.keyboard.press('Shift+'+key);
    await page.waitForFunction(()=>document.querySelector('[data-toy-id="cube-state"]').textContent==='Gelöst');
    assert.ok(await pixels(id('cube-canvas'))===solved,key+' inverse');
    await id('cube-reset').click();
  }
  await id('cube-cw').focus();await page.keyboard.press('q');
  await page.waitForFunction(()=>document.querySelector('[data-toy-id="cube-count"]').textContent==='1');
  await id('cube-undo').click();assert.ok(await pixels(id('cube-canvas'))===solved);
  pass('WASDQE and all four arrows, Shift inverses, controls focus and Undo');
  await page.getByRole('button',{name:'Spielpause',exact:true}).focus();await page.keyboard.press('w');
  assert.equal(await id('cube-count').textContent(),'0');
  await page.getByRole('button',{name:'Notizbuch · dein eigenes Buch',exact:true}).click();
  assert.equal(await root.getAttribute('data-blocked'),'true');
  await page.keyboard.press('w');assert.equal(await id('cube-count').textContent(),'0');
  await page.keyboard.press('Escape');await root.waitFor({state:'visible'});
  // A text input within toy controls also must retain ordinary text editing.
  await root.evaluate(r=>{const input=document.createElement('input');input.setAttribute('aria-label','QA Texteingabe');r.querySelector('[data-toy-controls="cube"]').append(input);});
  await page.getByRole('textbox',{name:'QA Texteingabe'}).fill('wasdqe');await page.getByRole('textbox',{name:'QA Texteingabe'}).press('ArrowLeft');
  assert.equal(await id('cube-count').textContent(),'0');await page.getByRole('textbox',{name:'QA Texteingabe'}).evaluate(n=>n.remove());
  pass('Keyboard stays scoped; notebook and text editing take priority');

  const canvas=id('cube-canvas');let rect=await canvas.boundingBox();
  const xy=(x,y)=>[rect.x+x/420*rect.width,rect.y+y/370*rect.height];
  await page.mouse.move(...xy(210,162));await page.mouse.down();await page.mouse.move(...xy(280,162),{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('[data-toy-id="cube-count"]').textContent==='1');
  await id('cube-reset').click();const initialView=await pixels(canvas);
  await page.keyboard.down('Alt');await page.mouse.move(...xy(210,162));await page.mouse.down();await page.mouse.move(...xy(270,190),{steps:8});await page.mouse.up();await page.keyboard.up('Alt');
  assert.notEqual(await pixels(canvas),initialView);assert.equal(await id('cube-count').textContent(),'0');
  await id('cube-view').click();assert.ok(await pixels(canvas)===initialView);pass('Mouse layer swipe and view orbit/reset');

  await page.emulateMedia({reducedMotion:'no-preference'});await choose('Graf Knautsch');
  assert.equal(await root.getAttribute('data-phase'),'entrance');await page.waitForTimeout(1550);await page.screenshot({path:out+'/doll-on-back.png'});await ready();
  assert.equal(await id('doll-quote').textContent(),'Massier mich');await id('doll-reset').click();
  const doll=id('doll-canvas');await page.waitForTimeout(100);const relaxed=await pixels(doll);rect=await doll.boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.waitForTimeout(400);
  assert.equal(await id('doll-count').textContent(),'1');assert.equal(await id('doll-quote').textContent(),'Meine Frisur!');assert.notEqual(await pixels(doll),relaxed);
  await page.screenshot({path:out+'/doll-squeezed.png'});await page.mouse.up();await page.waitForTimeout(1400);
  assert.equal(await doll.getAttribute('aria-pressed'),'false');assert.ok(await pixels(doll)===relaxed);
  await doll.focus();await page.keyboard.down('Space');await page.keyboard.down('Space');assert.equal(await id('doll-count').textContent(),'2');await page.keyboard.up('Space');
  await page.screenshot({path:out+'/doll-desktop.png'});pass('Doll lands on back, stands, says Massier mich; squeeze, spring, quotes and hold count');
  await choose('Vampir-Spinner');assert.equal(await root.getAttribute('data-spielpause'),'spinner');
  for(let i=0;i<12;i++){const object=await page.locator('[data-toy-motion="spinner"]').boundingBox(),table=await root.boundingBox();assert.ok(object.x>=table.x-1&&object.x+object.width<=table.x+table.width+1);assert.ok(object.y>=table.y-1&&object.y+object.height<=table.y+table.height+1);await page.waitForTimeout(180);}
  await ready();assert.equal(await id('spinner-speed').textContent(),'0');
  await id('spinner-push').click();await page.waitForTimeout(300);const fast=Number(await id('spinner-speed').textContent());assert.ok(fast>0);
  await page.waitForTimeout(700);assert.ok(Number(await id('spinner-speed').textContent())<fast);assert.ok(Number(await id('spinner-turns').textContent())>0);
  await id('spinner-stop').click();assert.equal(await id('spinner-speed').textContent(),'0');
  await id('spinner-canvas').press('ArrowLeft');await page.waitForTimeout(100);assert.ok(Number(await id('spinner-speed').textContent())>0);await id('spinner-stop').click();
  await page.screenshot({path:out+'/spinner-desktop.png'});pass('Centered spinner texture, curved entrance within table, impulse, friction and stop');

  // A real SL media release interrupts the toy and restores it after dismissal.
  const full=await (await gm.request.get(base+'/api/live-stage?sessionId='+active.room.sessionId+'&catalog=1')).json();
  const regie=await (await gm.request.get(base+'/api/live-stage?sessionId='+active.room.sessionId+'&regie='+full.scenes[0].id)).json();
  const image=regie.media.find(m=>m.mime.startsWith('image/'));const eventId=crypto.randomUUID();
  const publish=await gm.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'showMedia',sessionId:active.room.sessionId,runId:active.room.runId,eventId,fileIds:[image.fileId],audience:{scope:'players',playerIds:['command-a']}}});assert.equal(publish.status(),200);
  await page.locator('dialog[open]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-spielpause]')?.dataset.suspended==='true');
  assert.equal(await root.evaluate(n=>n.inert),true);
  await gm.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideMedia',sessionId:active.room.sessionId,runId:active.room.runId,eventId}});
  await page.locator('dialog[open]').waitFor({state:'detached'});await root.waitFor({state:'visible'});pass('Real SL presentation suspends toy and input; withdrawal restores it');

  const originalScene=(await (await gm.request.get(base+'/api/command-center/scenes?id='+full.scenes[0].id)).json()).scene;
  const whispers=[
    {id:crypto.randomUUID(),kind:'vision',title:'SYNTHETISCH Spielpause Vision',text:'Eine kurze Vision.',fragments:['Eine kurze Vision.'],preset:'classic',tempo:'brisk',recipientIds:['command-a'],fileIds:[]},
    {id:crypto.randomUUID(),kind:'letter',title:'SYNTHETISCH Spielpause Brief',text:'Eine persönliche Botschaft.',layout:'letter',sound:'none',recipientIds:['command-a'],fileIds:[]}
  ];
  const saveScene=async(version,document)=>{
    const r=await gm.request.post(base+'/api/command-center/scenes',{headers:{Origin:base},data:{action:'save',id:originalScene.id,version,document}});assert.equal(r.status(),200);return (await r.json()).scene;
  };
  const prepared=await saveScene(originalScene.version,{...originalScene.document,whispers:[...(originalScene.document.whispers||[]),...whispers]});
  for(const whisper of whispers){
    const r=await gm.request.post(base+'/api/live-deliveries',{headers:{Origin:base},data:{action:'deliver',sessionId:active.room.sessionId,requestId:crypto.randomUUID(),sceneId:prepared.id,whisperId:whisper.id,sceneVersion:prepared.version,recipients:{mode:'prepared'}}});assert.equal(r.status(),200);
    const sent=(await r.json()).runs.at(-1);
    const presentation=page.getByRole('dialog',{name:whisper.kind==='vision'?'Eine Vision':'Persönliche Botschaft',exact:true});
    await presentation.waitFor();await page.waitForFunction(()=>document.querySelector('[data-spielpause]')?.dataset.suspended==='true');
    assert.equal(await root.evaluate(n=>n.inert),true);
    const withdrawn=await gm.request.post(base+'/api/live-deliveries',{headers:{Origin:base},data:{action:'withdraw',sessionId:active.room.sessionId,runId:sent.id}});assert.equal(withdrawn.status(),200);
    await presentation.waitFor({state:'detached'});await root.waitFor({state:'visible'});
  }
  await saveScene(prepared.version,originalScene.document);
  pass('Real personal vision and letter portals also suspend toys and restore them after withdrawal');

  await page.getByRole('button',{name:'Spielzeug wegräumen',exact:true}).filter({visible:true}).click();await root.waitFor({state:'detached'});
  await page.emulateMedia({reducedMotion:'reduce'});await choose('Graf Knautsch');await ready();assert.equal(await id('doll-count').textContent(),'2');
  await choose('Rubikwürfel');await ready();assert.equal(await root.getAttribute('data-phase'),'ready');
  pass('Switching/unmounting; per-account doll counter persists; reduced motion skips entrances');

  for(const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:width<500?844:1000});
    await page.screenshot({path:out+'/cube-'+width+'.png'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const r=await page.locator('[data-toy-controls="cube"]').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width+1&&r.y>=56);
    for(const button of await page.locator('[data-toy-controls="cube"] button').all()){
      const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
      assert.ok(await button.evaluate(n=>{const b=n.getBoundingClientRect();return n.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),'Toy controls are not covered by the table HUD');
    }
  }
  await page.setViewportSize({width:320,height:700});await page.emulateMedia({reducedMotion:'no-preference'});await choose('Vampir-Spinner');
  for(let i=0;i<15;i++){const obj=await page.locator('[data-toy-motion="spinner"]').boundingBox(),t=await root.boundingBox();assert.ok(obj.x>=t.x-1&&obj.x+obj.width<=t.x+t.width+1&&obj.y>=t.y-1&&obj.y+obj.height<=t.y+t.height+1);await page.waitForTimeout(160);}
  await ready();await page.screenshot({path:out+'/spinner-320.png'});
  pass('320/390/768/1024/1440 layouts, bounded small-screen spinner entrance');

  const touch=await login('command-a',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const tp=await touch.newPage();tp.on('pageerror',e=>errors.push(e.message));await tp.goto(base+'/spielbereich?bereich=sitzung');await tp.waitForLoadState('networkidle');
  const tc=await touch.newCDPSession(tp);
  const tChoose=async name=>{await tp.waitForTimeout(350);await tp.getByRole('button',{name:'Spielpause',exact:true}).tap();await tp.getByRole('button',{name,exact:true}).tap();await tp.waitForFunction(()=>document.querySelector('[data-spielpause]')?.dataset.phase==='ready');};
  await tChoose('Rubikwürfel');await tp.locator('[data-toy-id="cube-reset"]').tap();
  let tb=await tp.locator('[data-toy-id="cube-canvas"]').boundingBox();
  const point={x:tb.x+tb.width/2,y:tb.y+tb.height*162/370};
  await tc.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  for(let i=1;i<=8;i++)await tc.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+i*6,y:point.y}]});
  await tc.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await tp.waitForFunction(()=>document.querySelector('[data-toy-id="cube-count"]').textContent==='1');
  await tChoose('Graf Knautsch');await tp.locator('[data-toy-id="doll-reset"]').tap();
  await tp.locator('[data-toy-id="doll-canvas"]').tap();assert.equal(await tp.locator('[data-toy-id="doll-count"]').textContent(),'1');
  tb=await tp.locator('[data-toy-id="doll-canvas"]').boundingBox();
  await tc.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tb.x+tb.width/2,y:tb.y+tb.height/2}]});
  await tc.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await tp.locator('[data-toy-id="doll-canvas"]').getAttribute('aria-pressed'),'false');
  await tChoose('Vampir-Spinner');await tp.locator('[data-toy-id="spinner-canvas"]').tap();
  await tp.waitForFunction(()=>Number(document.querySelector('[data-toy-id="spinner-speed"]').textContent)>0);await tp.locator('[data-toy-id="spinner-stop"]').tap();
  assert.equal(await tp.locator('[data-toy-id="spinner-speed"]').textContent(),'0');await touch.close();
  pass('Native touch: cube swipe, doll tap and cancelled hold, spinner tap/stop');
  for(const name of ['Rubikwürfel','Graf Knautsch','Vampir-Spinner']){
    await choose(name);await page.getByRole('button',{name:'Auftritt abbrechen und Spielzeug wegräumen',exact:true}).click();await root.waitFor({state:'detached'});
  }
  pass('All three entrances can be cancelled immediately without leaving a toy mounted');
  const bp=await b.newPage();await bp.goto(base+'/spielbereich?bereich=sitzung');await bp.waitForLoadState('networkidle');assert.equal(await bp.locator('[data-spielpause]').count(),0);
  const after=await snapshot(a),other=await snapshot(b);assert.deepEqual(after.objects,before.objects);assert.deepEqual(after.vitals,before.vitals);assert.deepEqual(other.objects,before.objects);assert.deepEqual(writes,[]);
  await page.getByRole('button',{name:'Zur Zuflucht',exact:true}).click();await root.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);pass('No toy on player B, no table/character writes, clean exit and no browser errors');
  writeFileSync(out+'/result.json',JSON.stringify({passed:true,checks,errors},null,2));
} catch(error) { if(page)await page.screenshot({path:out+'/failure.png'});throw error; }
finally {await browser.close();}
