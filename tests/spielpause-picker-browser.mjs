// Spielpause picker reachability for players, the SL and signed-out visitors.
// Regression for the live report "Spieler sehen die Objekte nicht" (21.11.2026): the picker lived inside the
// isolated stage layer, below the HUD layer that holds the player's own vitals panel. On smaller screens
// that panel covered the choices, so a tap on "Graf Knautsch" or "Vampir-Spinner" hit the vitals panel
// and no toy appeared. The SL has no such panel and was never affected.
// Run only against a disposable, synthetic local --zustandswerte fixture:
//   CVK_TEST_URL=http://127.0.0.1:8861 node tests/spielpause-picker-browser.mjs
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8847';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
const browser=await chromium.launch({headless:true,...(process.env.CVK_BROWSER_CHANNEL?{channel:process.env.CVK_BROWSER_CHANNEL}:{})});
const errors=[];
const pass=name=>console.log('PASS '+name);
// Portrait phone, landscape phone, small laptop, desktop.
const viewports=[[375,667],[844,390],[1024,600],[1440,1000]];
const toys=['Rubikwürfel','Graf Knautsch','Vampir-Spinner'];
try {
  async function login(id,viewport){
    const context=await browser.newContext({viewport:{width:viewport[0],height:viewport[1]}});
    const r=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});
    assert.equal(r.status(),200,'login '+id);return context;
  }
  // A shared SL image opens as a modal and has priority over toys by design. Withdraw it; a running
  // narration scene stays on the table, as during a real evening.
  {
    const gm=await login('command-gm',[1440,1000]);
    const active=await (await gm.request.get(base+'/api/live-table?view=active')).json();
    assert.ok(active.room?.started&&active.room.title.startsWith('SYNTHETISCH'),'synthetic evening must be running');
    const initial=await (await gm.request.get(base+'/api/live-stage?sessionId='+active.room.sessionId)).json();
    if(initial.media?.id){
      const r=await gm.request.post(base+'/api/live-table',{headers:{Origin:base},data:{action:'hideMedia',sessionId:active.room.sessionId,runId:active.room.runId,eventId:initial.media.id}});
      assert.equal(r.status(),200);
    }
    await gm.close();
  }
  async function openStage(context){
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/spielbereich?bereich=sitzung');
    await page.getByRole('button',{name:'Spielpause',exact:true}).waitFor();
    await page.waitForLoadState('networkidle');
    return page;
  }
  // Every choice must be the topmost element at its own center, i.e. a real tap reaches it.
  const reachable=page=>page.evaluate(()=>[...document.querySelectorAll('aside[aria-label="Spielpause auswählen"] button[data-choice]')].map(button=>{
    const r=button.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {name:button.textContent,free:!!top&&(top===button||button.contains(top)),inViewport:r.top>=0&&r.bottom<=innerHeight,cover:top&&top!==button?String(top.className||top.tagName):''};
  }));
  async function checkViewer(id,viewport){
    const context=await login(id,viewport),page=await openStage(context);
    for(const toy of toys){
      await page.getByRole('button',{name:'Spielpause',exact:true}).click();
      const picker=page.getByRole('complementary',{name:'Spielpause auswählen'});await picker.waitFor();
      for(const choice of await reachable(page)){
        if(!choice.inViewport)await picker.getByRole('button',{name:choice.name,exact:true}).scrollIntoViewIfNeeded();
      }
      const state=await reachable(page),target=state.find(c=>c.name===toy);
      assert.ok(target?.free,id+' '+viewport.join('x')+': "'+toy+'" is covered by '+target?.cover);
      // A real mouse click at the button position, not a synthetic DOM click.
      await picker.getByRole('button',{name:toy,exact:true}).click({trial:false});
      await page.waitForFunction(()=>document.querySelector('[data-spielpause]')?.dataset.phase==='ready',null,{timeout:15000});
      const shown=await page.evaluate(()=>{const t=document.querySelector('[data-spielpause]'),o=t.querySelector('section:not([hidden]) [data-toy-motion]'),r=o.getBoundingClientRect(),s=getComputedStyle(t);
        const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        // Nothing outside the Spielpause (HUD, panels) may cover the toy. On very short landscape screens the
        // toy's own control panel overlaps its lower half for every role; that layout limit is tracked separately.
        return {visible:s.visibility!=='hidden'&&t.dataset.suspended!=='true'&&t.dataset.blocked!=='true',onScreen:r.bottom>0&&r.top<innerHeight&&r.width>0,center:!!top&&t.contains(top)};});
      assert.deepEqual(shown,{visible:true,onScreen:true,center:true},id+' '+viewport.join('x')+': '+toy+' not visible');
      await page.getByRole('button',{name:'Spielzeug wegräumen'}).first().click();
      await page.waitForFunction(()=>!document.querySelector('[data-spielpause]'));
    }
    await context.close();
    pass(id+' '+viewport.join('x')+': all three choices reachable and every toy visible');
  }
  for(const viewport of viewports){
    await checkViewer('command-a',viewport);
    await checkViewer('command-b',viewport);
    await checkViewer('command-gm',viewport);
  }

  // Personal only: B never receives A's toy.
  const a=await login('command-a',[1440,1000]),b=await login('command-b',[1440,1000]);
  const pa=await openStage(a),pb=await openStage(b);
  await pa.getByRole('button',{name:'Spielpause',exact:true}).click();
  await pa.getByRole('complementary',{name:'Spielpause auswählen'}).getByRole('button',{name:'Vampir-Spinner',exact:true}).click();
  await pa.waitForFunction(()=>document.querySelector('[data-spielpause]')?.dataset.phase==='ready',null,{timeout:15000});
  await pb.waitForTimeout(3500);
  assert.equal(await pb.locator('[data-spielpause]').count(),0,'Player B must not get Player A\'s toy');
  await a.close();await b.close();
  pass('personal toy stays on its own table');

  // Signed out: no stage, no Spielpause entry, no toy.
  const anonymous=await browser.newContext(),page=await anonymous.newPage();
  const response=await page.goto(base+'/spielbereich?bereich=sitzung');
  assert.ok(response&&response.status()<500);
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByRole('button',{name:'Spielpause',exact:true}).count(),0,'signed out sees no Spielpause');
  assert.equal(await page.locator('[data-spielpause],[data-chroniplay-stage]').count(),0,'signed out sees no stage');
  await anonymous.close();
  pass('signed out: no stage and no Spielpause');

  assert.deepEqual(errors,[],'browser errors');
} finally {
  await browser.close();
}
