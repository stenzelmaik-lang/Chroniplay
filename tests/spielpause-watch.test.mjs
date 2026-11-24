// Spielpause watching: invitation rules, feed validation, viewer replay and the privacy of server and route.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {watchCommandSchema,cubeFeedSchema,currentPairs,invite,withdraw,viewersOf,hostsOf,mayWatch,MAX_VIEWERS,MAX_FEED_MOVES} from '../domain/spielpause-watch.ts';
import {feedDelta,watchElapsed} from '../app/spielbereich/modules/spieltisch/spielpause/watch-runtime.js';
import {CubeModel} from '../app/spielbereich/modules/spieltisch/spielpause/toys-core.js';
import {parseMove,scramble,formatSequence} from '../app/spielbereich/modules/spieltisch/spielpause/cube-moves.js';

const run='4b8f7a3c-1d2e-4f50-8a9b-0c1d2e3f4a5b',now='2026-11-24T20:00:00.000Z';
const feed={round:'r1',moves:'U R′ F2',overflow:false,timerState:'running',timeMs:1200,userMoves:3,solved:false};

test('invitations: no self invite, no duplicates, a limit, withdraw any time',()=>{
 let p=invite([],'a','b',now);
 assert.deepEqual(viewersOf(p,'a'),['b']);assert.deepEqual(hostsOf(p,'b'),['a']);
 assert.equal(invite(p,'a','b',now),p,'inviting twice changes nothing');
 assert.throws(()=>invite(p,'a','a',now),/selbst/);
 assert.ok(mayWatch(p,'a','b'));assert.ok(!mayWatch(p,'b','a'),'an invitation is one-way');assert.ok(!mayWatch(p,'a','gm'),'the GM sees nothing without an invitation');
 for(let i=0;i<MAX_VIEWERS-1;i++)p=invite(p,'a','v'+i,now);
 assert.throws(()=>invite(p,'a','late',now),/Höchstens/);
 p=withdraw(p,'a','b');assert.ok(!mayWatch(p,'a','b'));
 assert.equal(withdraw(p,'c','v0').length,p.length,'nobody can withdraw someone else\'s invitation');
});

test('invitations end with the evening: a stored state of an earlier run counts as empty',()=>{
 const pairs=[{hostId:'a',viewerId:'b',since:now}];
 assert.deepEqual(currentPairs({runId:run,pairs},run),pairs);
 assert.deepEqual(currentPairs({runId:'other-run',pairs},run),[]);
 assert.deepEqual(currentPairs(null,run),[]);
});

test('commands: the host comes from the session, the feed holds only cube data',()=>{
 assert.ok(watchCommandSchema.safeParse({action:'invite',sessionId:'s',runId:run,viewerId:'b'}).success);
 assert.ok(watchCommandSchema.safeParse({action:'withdraw',sessionId:'s',runId:run,viewerId:'b'}).success);
 assert.ok(watchCommandSchema.safeParse({action:'publish',sessionId:'s',runId:run,feed}).success);
 assert.equal(watchCommandSchema.safeParse({action:'invite',sessionId:'s',runId:run,viewerId:'b',hostId:'x'}).success,false,'nobody names the host');
 assert.equal(watchCommandSchema.safeParse({action:'publish',sessionId:'s',runId:run,feed,hostId:'x'}).success,false);
 assert.equal(watchCommandSchema.safeParse({action:'publish',sessionId:'s',runId:'nope',feed}).success,false,'bound to a run');
 assert.equal(cubeFeedSchema.safeParse({...feed,results:[{timeMs:1}]}).success,false,'no leaderboard in the feed');
 assert.equal(cubeFeedSchema.safeParse({...feed,moves:'U X'}).success,false);
 assert.equal(cubeFeedSchema.safeParse({...feed,moves:'U  R'}).success,false);
 assert.ok(cubeFeedSchema.safeParse({...feed,moves:"U R' M2 S′"}).success);
 assert.ok(cubeFeedSchema.safeParse({...feed,moves:''}).success,'a solved, unscrambled cube');
 assert.equal(cubeFeedSchema.safeParse({...feed,moves:Array(MAX_FEED_MOVES+1).fill('U').join(' ')}).success,false);
 assert.equal(cubeFeedSchema.safeParse({...feed,timerState:'paused'}).success,false);
});

test('viewer replay: appended turns animate, anything else rebuilds; the result equals the host cube',()=>{
 assert.deepEqual(feedDelta('r1',['U'],{...feed,moves:'U R′ F2'}),{reset:false,moves:['U','R′','F2'],append:['R′','F2']});
 assert.equal(feedDelta('r1',['U','L'],{...feed,moves:'U R′'}).reset,true,'diverged history');
 assert.equal(feedDelta('r0',['U'],{...feed}).reset,true,'new round');
 assert.equal(feedDelta(null,[],{...feed,round:'r1',moves:''}).reset,true);
 const sequence=formatSequence(scramble());
 const host=new CubeModel(),viewer=new CubeModel();
 for(const m of sequence.split(' '))host.apply(parseMove(m));
 for(const m of feedDelta(null,[],{...feed,moves:sequence}).moves)viewer.apply(parseMove(m));
 assert.equal(viewer.fingerprint(),host.fingerprint());
});

test('viewer clock runs on from the host time only while the host clock runs',()=>{
 assert.equal(watchElapsed({...feed,timerState:'running',timeMs:1000},200,5000,5300),1500);
 assert.equal(watchElapsed({...feed,timerState:'stopped',timeMs:9000},200,5000,9999),9000);
 assert.equal(watchElapsed(null,0,0,0),0);
});

test('server: who may watch is decided from the session; the feed never carries results',()=>{
 const s=readFileSync(new URL('../server/spielpause-watch.ts',import.meta.url),'utf8');
 assert.match(s,/mayWatch\(await pairs\(a,sessionId,runId\),hostId,a\.id\)/,'viewer is the signed-in member');
 assert.match(s,/invite\(current,a\.id,c\.viewerId/,'host is the signed-in member');
 assert.match(s,/withdraw\(current,a\.id,c\.viewerId\)/);
 assert.match(s,/feedKey\(a\.campaignId,c\.sessionId,a\.id\)/,'a member can only publish their own cube');
 assert.match(s,/await stageRoom\(a,sessionId\)/,'only for the running evening');
 assert.match(s,/if\(!viewersOf\(await pairs\(a,c\.sessionId,runId\),a\.id\)\.length\)\{await dropFeed/,'nothing stored without a viewer');
 assert.ok(!/spielpause_results|ownResults|leaderboard|results/i.test(s.replace(/\/\*[\s\S]*?\*\//g,'')),'no leaderboard data in code');
 assert.match(s,/HttpError\(404,'Nicht gefunden\.'\)/,'no hint whether a host exists');
});

test('route requires a session and same-origin writes',()=>{
 const r=readFileSync(new URL('../app/api/spielpause/watch/route.ts',import.meta.url),'utf8');
 assert.match(r,/a=await actor\(\)/);
 assert.match(r,/sameOrigin\(req\);\r?\n return json\(await watchCommand\(await actor\(\),await input\(req,20000\)\)\)/);
});
