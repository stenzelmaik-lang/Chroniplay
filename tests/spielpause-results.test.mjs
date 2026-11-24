// Personal Spielpause leaderboard: validation and privacy of the server code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resultCreateSchema,resultQuerySchema,RESULTS_PER_HOUR,RESULTS_SHOWN,MIN_TIME_MS} from '../domain/spielpause.ts';

const ok={game:'rubik',timeMs:83456,moves:57};
test('a result needs a known game and plausible time and move count',()=>{
 assert.ok(resultCreateSchema.safeParse(ok).success);
 assert.equal(resultCreateSchema.safeParse({...ok,game:'schach'}).success,false);
 assert.equal(resultCreateSchema.safeParse({...ok,timeMs:MIN_TIME_MS-1}).success,false,'impossibly fast');
 assert.equal(resultCreateSchema.safeParse({...ok,timeMs:12.5}).success,false,'whole milliseconds only');
 assert.equal(resultCreateSchema.safeParse({...ok,moves:0}).success,false);
 assert.equal(resultCreateSchema.safeParse({...ok,memberId:'someone-else'}).success,false,'the player comes from the session, never from the body');
 assert.ok(resultQuerySchema.safeParse({game:'rubik'}).success);
 assert.equal(resultQuerySchema.safeParse({game:null}).success,false);
 assert.ok(RESULTS_PER_HOUR>=10&&RESULTS_SHOWN===10);
});

test('server reads and writes only the signed-in member\'s own results',()=>{
 const s=readFileSync(new URL('../server/spielpause.ts',import.meta.url),'utf8');
 const selects=s.match(/SELECT[^']*FROM spielpause_results[^']*/g);
 assert.equal(selects.length,2);
 for(const q of selects)assert.match(q,/WHERE campaign_id=\? AND member_id=\?/,'every read is bound to campaign and member');
 assert.match(s,/\.bind\(a\.campaignId,a\.id,parsed\.data\.game,RESULTS_SHOWN\)/,'member id comes from the actor');
 assert.match(s,/\.bind\(crypto\.randomUUID\(\),a\.campaignId,a\.id,d\.game/);
 assert.ok(!/fetch\(|webhook|members m/i.test(s),'no forwarding, no other players joined in');
});

test('route requires a session, same-origin writes and a small body',()=>{
 const r=readFileSync(new URL('../app/api/spielpause/route.ts',import.meta.url),'utf8');
 assert.match(r,/ownResults\(await actor\(\)/);
 assert.match(r,/sameOrigin\(req\);\r?\n return json\(await saveResult\(await actor\(\),await input\(req,2000\)\),201\)/);
});

test('migration creates the private table with value checks',()=>{
 const m=readFileSync(new URL('../drizzle/0020_spielpause_results.sql',import.meta.url),'utf8');
 assert.match(m,/CREATE TABLE `spielpause_results`/);
 assert.match(m,/"game" IN \('rubik'\)/);
 assert.match(m,/CREATE INDEX `spielpause_results_best`/);
});
