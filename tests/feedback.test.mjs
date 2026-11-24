import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {feedbackCreateSchema,feedbackUpdateSchema,cleanPage,browserClass,isCritical,FEEDBACK_AREAS,areaLabels,FEEDBACK_PER_HOUR} from '../domain/feedback.ts';

const ok={kind:'fehler',area:'spieltisch',title:'Würfel hängen',description:'Nach dem Wurf erscheint kein Ergebnis.'};
test('a report needs kind, area, title and a real description; unknown fields are refused',()=>{
 assert.ok(feedbackCreateSchema.safeParse(ok).success);
 assert.equal(feedbackCreateSchema.safeParse({...ok,title:'x'}).success,false);
 assert.equal(feedbackCreateSchema.safeParse({...ok,description:'kurz'}).success,false);
 assert.equal(feedbackCreateSchema.safeParse({...ok,kind:'spam'}).success,false);
 assert.equal(feedbackCreateSchema.safeParse({...ok,reporterId:'someone-else'}).success,false,'the reporter comes from the session, never from the body');
 assert.equal(feedbackCreateSchema.safeParse({...ok,description:'x'.repeat(4001)}).success,false);
});
test('context is attached only with consent and never carries query strings or foreign hosts',()=>{
 assert.equal(feedbackCreateSchema.parse(ok).consentContext,false);
 assert.equal(cleanPage('/spielbereich?bereich=charaktere&character=123#x'),'/spielbereich');
 assert.equal(cleanPage('https://evil.example/x'),'');
 assert.equal(cleanPage('//evil.example/x'),'');
 assert.equal(cleanPage('/sl/command-center'),'/sl/command-center');
});
test('browser class is coarse: device and engine only',()=>{
 assert.equal(browserClass('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36'),'Desktop · Chrome');
 assert.equal(browserClass('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit Version/18.0 Mobile Safari/604.1'),'Mobil · Safari');
 assert.equal(browserClass('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36 Edg/140.0'),'Desktop · Edge');
 assert.equal(browserClass(null),'Desktop · anderer Browser');
 assert.ok(!/\d/.test(browserClass('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.1234.56 Safari/537.36')),'no version numbers');
});
test('alpha-critical areas from the issue are marked',()=>{
 for(const a of ['anmeldung','verlust','freigabe','karte','veroeffentlichung'])assert.ok(isCritical(a),a);
 assert.equal(isCritical('sonstiges'),false);
 for(const a of FEEDBACK_AREAS)assert.ok(areaLabels[a],'label for '+a);
 assert.ok(FEEDBACK_PER_HOUR>=3&&FEEDBACK_PER_HOUR<=10);
});
test('operator updates need id and version and know only the allowed fields',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 assert.ok(feedbackUpdateSchema.safeParse({id,version:1,status:'in_pruefung'}).success);
 assert.equal(feedbackUpdateSchema.safeParse({id,status:'erledigt'}).success,false);
 assert.equal(feedbackUpdateSchema.safeParse({id,version:1,status:'geloescht'}).success,false);
 assert.equal(feedbackUpdateSchema.safeParse({id,version:1,reporterId:'x'}).success,false);
});
test('server keeps internal notes away from reporters and never forwards reports',()=>{
 const s=readFileSync(new URL('../server/feedback.ts',import.meta.url),'utf8');
 const own=s.match(/const ownView=[^\n]*/)[0];
 assert.ok(!/operator_note|severity|page|browser|reporter/.test(own.replace('ownView=(r:Row)','')),'own view: no internal fields');
 assert.ok(!/webhook|fetch\(|api\.github|discord\.com/i.test(s),'no automatic forwarding');
 assert.match(s,/gmOnly\(a\);\n const r=await database\(\)\.prepare\("SELECT f\.\*/,'only the operator lists all reports');
});
