// Header name choice (21.11.2026): a player picks whether the header shows the account name or the
// active character. Checks player A, player B, the SL and a signed-out visitor at 1440 and 375 px.
// Run only against a disposable, synthetic local fixture:
//   CVK_TEST_PORT=8879 node --experimental-strip-types scripts/test-local.mjs --command-center
//   CVK_TEST_URL=http://127.0.0.1:8879 node tests/header-name-browser.mjs
import assert from 'node:assert/strict';
import {engineFixture} from './fixtures/engine-character.mjs';
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CVK_TEST_URL||'http://127.0.0.1:8879';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only local isolated instances are allowed.');
const shots=process.env.CVK_SCREENSHOTS||'';
const browser=await chromium.launch({headless:true,...(process.env.CVK_BROWSER_CHANNEL?{channel:process.env.CVK_BROWSER_CHANNEL}:{})});
const errors=[],pass=name=>console.log('PASS '+name);
const character='SYNTHETISCH Lotte Nachtfalter';
try{
  async function login(id,width){
    const context=await browser.newContext({viewport:{width,height:width<500?812:1000}});
    const r=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:id+'@example.invalid',password:'ChroniPlay-Demo-2036!'}});
    assert.equal(r.status(),200,'login '+id);return context;
  }
  async function hub(context){
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/spielbereich');await page.locator('[data-header-name]').waitFor({state:'attached'});
    await page.waitForLoadState('networkidle');return page;
  }
  const headerState=page=>page.evaluate(()=>{
    const summary=document.querySelector('header details summary[aria-label^="Kontomenü"]');
    const label=summary?.querySelector('em'),strong=document.querySelector('[data-header-name]');
    return {aria:summary?.getAttribute('aria-label'),initial:summary?.querySelector('span')?.textContent,label:label?.textContent,labelVisible:!!label&&getComputedStyle(label).display!=='none',menu:strong?.textContent,account:strong?.nextElementSibling?.tagName==='SMALL'?strong.nextElementSibling.textContent:null,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);

  // Setup: player A owns one synthetic active character and selects it.
  {
    const a=await login('command-a',1440);
    const created=await (await a.request.post(base+'/api/records',{headers:{Origin:base},data:{kind:'charaktere',title:character,visibility:'private',body:{...engineFixture}}})).json();
    assert.ok(created.id,'synthetic character created');
    assert.equal((await a.request.patch(base+'/api/character-selection',{headers:{Origin:base},data:{characterId:created.id}})).status(),200);
    await a.close();
  }
  for(const width of [1440,375]){
    const a=await login('command-a',width);
    let page=await hub(a),state=await headerState(page);
    assert.equal(state.menu,'Demo Spieler A','default header shows the account name');
    assert.equal(state.labelVisible,width>700,'name next to the initial only on wide screens');
    if(width>700)assert.equal(state.label,'Demo Spieler A');
    pass(width+' player A default header shows account name');
    // Choose the character in the profile and save.
    await page.goto(base+'/profil');await page.getByText('Konto & Anzeige').click();
    const characterChoice=page.getByRole('radio',{name:new RegExp('Meinen Charakter \\('+character+'\\)')});
    await characterChoice.waitFor();
    assert.ok(await page.getByRole('radio',{name:/Meinen Namen \(Demo Spieler A\)/}).isChecked(),'account mode preselected');
    await characterChoice.check();
    await page.getByRole('button',{name:'Profil speichern'}).click();
    await page.getByRole('status').filter({hasText:'dauerhaft gespeichert'}).waitFor();
    await page.reload();await page.getByText('Konto & Anzeige').click();
    assert.ok(await page.getByRole('radio',{name:/Meinen Charakter/}).isChecked(),'choice survives reload');
    assert.ok(await noOverflow(page),'profile has no horizontal scroll at '+width);
    if(shots)await page.locator('fieldset',{hasText:'Oben in der Kopfleiste zeigen'}).screenshot({path:shots+'/profil-'+width+'.png'});
    pass(width+' player A choice saved and survives reload');
    page=await hub(a);state=await headerState(page);
    assert.equal(state.menu,character,'header menu shows the character');
    assert.equal(state.initial,'S');
    assert.equal(state.account,'Konto: Demo Spieler A','the own account stays visible inside the menu');
    assert.ok(state.aria.includes(character));
    if(width>700)assert.equal(state.label,character);
    assert.equal(state.overflow,false,'no horizontal scroll at '+width);
    await page.locator('header details summary[aria-label^="Kontomenü"]').click();
    if(shots)await page.screenshot({path:shots+'/kopfleiste-'+width+'.png'});
    pass(width+' player A header shows the character after saving');
    // Reset for the next width.
    await page.goto(base+'/profil');await page.getByText('Konto & Anzeige').click();
    await page.getByRole('radio',{name:/Meinen Namen/}).check();await page.getByRole('button',{name:'Profil speichern'}).click();
    await page.getByRole('status').filter({hasText:'dauerhaft gespeichert'}).waitFor();
    page=await hub(a);assert.equal((await headerState(page)).menu,'Demo Spieler A','switching back restores the account name');
    pass(width+' player A switch back to account name');
    await a.close();
  }
  // Player B and the SL keep their own names and never see player A's character.
  for(const [id,name] of [['command-b','Demo Spieler B'],['command-gm','Demo Spielleitung']]){
    const context=await login(id,1440),page=await hub(context),state=await headerState(page);
    assert.equal(state.menu,name);assert.ok(!JSON.stringify(state).includes(character));
    const api=await (await context.request.get(base+'/api/profile/header-name')).json();
    assert.equal(api.name,name);assert.ok(!JSON.stringify(api).includes(character));
    pass(id+' keeps their own header name');await context.close();
  }
  // Signed out: no profile page and no header-name data.
  {
    const context=await browser.newContext({viewport:{width:375,height:812}}),page=await context.newPage();
    await page.goto(base+'/profil');assert.match(page.url(),/\/anmelden/);
    assert.equal((await context.request.get(base+'/api/profile/header-name')).status(),401);
    pass('signed-out visitor is redirected and the route answers 401');await context.close();
  }
  assert.deepEqual(errors,[],'no page errors');pass('no page errors');
}finally{await browser.close();}
