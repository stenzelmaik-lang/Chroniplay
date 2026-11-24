// Spielpause watching in real browsers. Run against a disposable, synthetic local --zustandswerte fixture only.
// A invites B, B sees A's turns live, the GM sees nothing, A withdraws and B's view ends.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8847';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const out='.local-work/spielpause-watch-qa';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CVK_BROWSER_CHANNEL?{channel:process.env.CVK_BROWSER_CHANNEL}:{})});
const errors=[],pass=name=>console.log('PASS '+name);
try {
  async function login(id) {
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    const r=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});
    assert.equal(r.status(),200);return context;
  }
  const a=await login('command-a'),b=await login('command-b'),gm=await login('command-gm');
  const active=await (await gm.request.get(base+'/api/live-table?view=active')).json();
  assert.ok(active.room?.started&&active.room.title.startsWith('SYNTHETISCH'));
  const sessionId=active.room.sessionId,runId=active.room.runId;
  const me=async c=>(await (await c.request.get(base+'/api/auth/session')).json()).user.memberId;
  const [aId,bId,gmId]=[await me(a),await me(b),await me(gm)];
  // Start clean: earlier runs of this script may have left invitations.
  for(const viewerId of [bId,gmId])await a.request.post(base+'/api/spielpause/watch',{headers:{Origin:base},data:{action:'withdraw',sessionId,runId,viewerId}});

  const open=async context=>{
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/spielbereich?bereich=sitzung');await page.waitForLoadState('networkidle');
    await page.getByRole('button',{name:'Spielpause',exact:true}).waitFor();return page;
  };
  const pa=await open(a),pb=await open(b),pg=await open(gm);
  await pa.getByRole('button',{name:'Spielpause',exact:true}).click();
  await pa.getByRole('complementary',{name:'Spielpause auswählen'}).getByRole('button',{name:'Rubikwürfel',exact:true}).click();
  await pa.waitForFunction(()=>document.querySelector('[data-spielpause]')?.dataset.phase==='ready',null,{timeout:20000});
  await pa.locator('[data-toy-id="cube-watch-toggle"]').click();
  const candidate=pa.locator('[data-watch-candidate="'+bId+'"]');
  await candidate.waitFor();
  assert.ok(await pa.locator('[data-watch-candidate="'+gmId+'"]').count(),'the GM can be invited');
  assert.equal(await pa.locator('[data-watch-candidate="'+aId+'"]').count(),0,'not oneself');
  await pa.waitForTimeout(400);await pa.screenshot({path:out+'/host-invite-panel.png'});
  await candidate.getByRole('button',{name:'Einladen'}).click();
  await candidate.getByRole('button',{name:'Zurücknehmen'}).waitFor();
  assert.match(await pa.locator('[data-toy-id="cube-watch-toggle"]').textContent(),/Zuschauen · 1/);
  pass('Host opens the invite panel and invites B');

  const notice=pb.locator('[data-watch-invite="'+aId+'"]');
  await notice.waitFor({timeout:10000});
  await pb.screenshot({path:out+'/viewer-invitation.png'});
  await notice.getByRole('button',{name:'Zuschauen'}).click();
  const view=pb.locator('[data-spielpause="watch"]');
  await view.waitFor();
  await pb.waitForFunction(()=>Number(document.querySelector('[data-spielpause="watch"]')?.dataset.watchMoves||0)>0,null,{timeout:10000});
  const shown=Number(await view.getAttribute('data-watch-moves'));
  pass('B gets the invitation and sees A\'s scrambled cube ('+shown+' turns)');

  await pa.locator('[data-toy-id="cube-menu-toggle"]').click();
  await pa.locator('[data-move="U"]').click();
  await pa.locator('[data-move="R′"]').click();
  await pb.waitForFunction(n=>Number(document.querySelector('[data-spielpause="watch"]')?.dataset.watchMoves)===n+2,shown,{timeout:10000});
  await pb.waitForFunction(()=>document.querySelector('[data-watch-id="count"]')?.textContent==='2',null,{timeout:10000});
  await pb.waitForTimeout(400);
  await pb.screenshot({path:out+'/viewer-live.png'});
  assert.equal(await pb.locator('[data-toy-id="cube-ranking"]').count(),0,'the viewer has no leaderboard');
  pass('B sees A\'s two turns live with the move count, no leaderboard');

  assert.equal(await pg.locator('[data-watch-invite]').count(),0,'GM gets no invitation');
  assert.equal((await gm.request.get(base+'/api/spielpause/watch?sessionId='+sessionId+'&host='+aId)).status(),404);
  pass('GM sees nothing without an invitation');

  await candidate.getByRole('button',{name:'Zurücknehmen'}).click();
  await candidate.getByRole('button',{name:'Einladen'}).waitFor();
  await pb.locator('[data-watch-id="ended"]').waitFor({timeout:5000});
  await pb.screenshot({path:out+'/viewer-ended.png'});
  pass('A withdraws; B\'s view ends within seconds');

  await pb.setViewportSize({width:390,height:844});await pa.setViewportSize({width:390,height:844});
  await pb.locator('[data-watch-id="ended"]').getByRole('button',{name:'Schließen'}).click();
  await pa.locator('[data-toy-id="cube-watch-toggle"]').click();await pa.locator('[data-toy-id="cube-watch-toggle"]').click();
  await pa.waitForTimeout(400);await pa.screenshot({path:out+'/host-invite-panel-390.png'});
  assert.deepEqual(errors,[]);pass('No browser errors');
} finally { await browser.close(); }
