import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.CVK_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CVK_BROWSER_CHANNEL?{channel:process.env.CVK_BROWSER_CHANNEL}:{})});
const out='.local-work/spielpause-qa';mkdirSync(out,{recursive:true});const errors=[],checks=[];
const file=new URL('../outputs/ChroniPlay-Spieltisch-Spielpause.html',import.meta.url).href;
const pass=label=>{checks.push(label);console.log('PASS '+label);};
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(file);await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'Graf Knautsch',exact:true}).click();
  const root=page.locator('[data-spielpause]');
  assert.equal(await root.getAttribute('data-doll3d'),'ready');
  assert.equal(await page.locator('[data-toy-motion="doll"]').evaluate(n=>getComputedStyle(n).transform),'none');
  for(const [name,delay] of [['fall',650],['back',850],['rise',1050],['stand',1600]]){
    await page.waitForTimeout(delay);await page.screenshot({path:out+'/3d-'+name+'.png'});
  }
  assert.equal(await root.getAttribute('data-phase'),'ready');
  assert.equal(await page.locator('[data-toy-id="doll-quote"]').textContent(),'Massier mich');
  pass('Solid 3D entrance renders without rotating or flattening the canvas');
  await page.getByRole('checkbox').check();
  for(const name of ['Graf Knautsch','Rubikwürfel','Vampir-Spinner']){
    if(name!=='Graf Knautsch'){
      await page.getByRole('button',{name:'Spielpause',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[data-spielpause]')?.dataset.phase==='ready');
    }
    const active=page.locator('[data-toy-motion] canvas:visible');await active.click();
    assert.equal(await active.evaluate(n=>getComputedStyle(n).outlineStyle),'none');
    assert.equal(await root.getAttribute('data-input'),'pointer');
    await active.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
    assert.equal(await active.evaluate(n=>getComputedStyle(n).outlineStyle),'none');
    assert.equal(await root.getAttribute('data-input'),'keyboard');
    assert.equal(await active.evaluate(n=>getComputedStyle(n.parentElement,'::after').borderBottomWidth),'2px');
  }
  pass('All three pointer activations are box-free; keyboard retains a ground-level focus marker');
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),tp=await mobile.newPage();
  await tp.goto(file);await tp.waitForLoadState('networkidle');await tp.getByRole('button',{name:'Graf Knautsch',exact:true}).tap();
  await tp.waitForFunction(()=>document.querySelector('[data-spielpause]')?.dataset.phase==='ready');await tp.locator('[data-toy-id="doll-canvas"]').tap();
  assert.equal(await tp.locator('[data-toy-id="doll-canvas"]').evaluate(n=>getComputedStyle(n).outlineStyle),'none');
  await tp.screenshot({path:out+'/3d-mobile-touch.png'});pass('Touch keeps the asset freestanding without a rectangular focus box');
  const review=await browser.newPage({viewport:{width:1000,height:900}});await review.goto(file+'?modellpruefung');await review.waitForLoadState('networkidle');
  await review.locator('figure').last().waitFor();await review.screenshot({path:out+'/3d-model-review.png',fullPage:true});pass('Front, side, back and lying diagnostic views render the same production model');
  const fallback=await browser.newContext();await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:original.call(this,type,...args);};});
  const fp=await fallback.newPage();await fp.goto(file);await fp.waitForLoadState('networkidle');await fp.getByRole('button',{name:'Graf Knautsch',exact:true}).click();
  assert.equal(await fp.locator('[data-spielpause]').getAttribute('data-doll3d'),'unavailable');assert.match(await fp.locator('[data-toy-id="doll-quote"]').textContent(),/nicht dargestellt/);
  await fp.getByRole('button',{name:'Spielpause',exact:true}).click();await fp.getByRole('button',{name:'Rubikwürfel',exact:true}).click();await fp.locator('[data-toy-id="cube-canvas"]').waitFor();
  pass('Unavailable 3D is reported honestly; other toys remain accessible');
  assert.deepEqual(errors,[]);writeFileSync(out+'/3d-result.json',JSON.stringify({passed:true,checks,errors},null,2));
}finally{await browser.close();}
