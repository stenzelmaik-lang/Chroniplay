import {randomUUID} from 'node:crypto';
/** Spielpause watching against the isolated local instance: synthetic accounts only (gm, a, b, otherCampaign). */
export async function spielpauseWatchIntegration({req,check}){
 const sessionId=randomUUID(),url='/api/spielpause/watch';
 const status=(who)=>req(url+'?sessionId='+sessionId,who);
 const feedOf=(who,host)=>req(url+'?sessionId='+sessionId+'&host='+host,who);
 const send=(who,body,extra)=>req(url,who,'POST',{sessionId,...body},extra);
 const feed={round:'round-1',moves:'U R′ F2',overflow:false,timerState:'running',timeMs:2500,userMoves:3,solved:false};
 const A='sprint1-a',B='sprint1-b',GM='sprint1-gm';

 check((await status()).s===401,'SPIELPAUSE-WATCH signed-out status denied');
 check((await feedOf(undefined,A)).s===401,'SPIELPAUSE-WATCH signed-out feed denied');
 check((await send(undefined,{action:'invite',runId:randomUUID(),viewerId:B})).s===401,'SPIELPAUSE-WATCH signed-out invite denied');
 check([404,409].includes((await status('a')).s),'SPIELPAUSE-WATCH nothing before the evening starts');

 await req('/api/live-table','gm','POST',{action:'start',sessionId,title:'SYNTHETIC Spielpause evening',create:true});
 const runId=(await req('/api/live-stage?sessionId='+sessionId,'gm')).d.runId;
 const own=await status('a');
 check(own.s===200&&own.d.runId===runId&&own.d.viewers.length===0&&own.d.watching.length===0,'SPIELPAUSE-WATCH player sees an empty own state');
 check(own.d.candidates.some(m=>m.id===B)&&own.d.candidates.some(m=>m.id===GM)&&!own.d.candidates.some(m=>m.id===A),'SPIELPAUSE-WATCH fellow players and the GM can be invited, not oneself');
 check(Object.keys(own.d.candidates[0]).sort().join()==='id,name','SPIELPAUSE-WATCH candidates carry only id and name');

 // Publishing without a viewer stores nothing.
 check((await send('a',{action:'publish',runId,feed})).s===200,'SPIELPAUSE-WATCH publish without viewer is accepted');
 check((await feedOf('b',A)).s===404,'SPIELPAUSE-WATCH player B sees nothing without an invitation');
 check((await feedOf('gm',A)).s===404,'SPIELPAUSE-WATCH GM sees nothing without an invitation');
 check((await status('gm')).d.watching.length===0,'SPIELPAUSE-WATCH GM has no invitation');

 for(const role of ['otherCampaign','blockedPlayer','editor'])check([403,404].includes((await send(role,{action:'invite',runId,viewerId:B})).s),'SPIELPAUSE-WATCH '+role+' cannot invite');
 check((await send('a',{action:'invite',runId,viewerId:A})).s===400,'SPIELPAUSE-WATCH self invitation refused');
 check((await send('a',{action:'invite',runId,viewerId:'sprint1-other-campaign'})).s===400,'SPIELPAUSE-WATCH a person from elsewhere cannot be invited');
 check((await send('a',{action:'invite',runId:randomUUID(),viewerId:B})).s===409,'SPIELPAUSE-WATCH stale evening refused');
 check((await send('a',{action:'invite',runId,viewerId:B,hostId:B})).s===400,'SPIELPAUSE-WATCH unknown fields refused');
 check((await send('a',{action:'invite',runId,viewerId:B},{Origin:'https://evil.invalid'})).s===403,'SPIELPAUSE-WATCH cross-site invite refused');

 const invited=await send('a',{action:'invite',runId,viewerId:B});
 check(invited.s===200&&invited.d.viewers.map(v=>v.id).join()===B,'SPIELPAUSE-WATCH player A invites B');
 check((await status('b')).d.watching.map(h=>h.id).join()===A,'SPIELPAUSE-WATCH B sees the invitation');
 const empty=await feedOf('b',A);
 check(empty.s===200&&empty.d.feed===null,'SPIELPAUSE-WATCH invited viewer waits for the first turn');
 check((await send('a',{action:'publish',runId,feed:{...feed,results:[{timeMs:1}]}})).s===400,'SPIELPAUSE-WATCH feed cannot carry results');
 check((await send('a',{action:'publish',runId,feed})).s===200,'SPIELPAUSE-WATCH A publishes the cube');
 const live=await feedOf('b',A);
 check(live.s===200&&live.d.host.id===A&&live.d.feed.moves==='U R′ F2'&&live.d.feed.userMoves===3&&typeof live.d.ageMs==='number','SPIELPAUSE-WATCH B sees the cube moves live');
 check(!/timeMs":\d+,"moves":\d+,"createdAt|results|ranking|spielpause_results/.test(JSON.stringify(live.d)),'SPIELPAUSE-WATCH viewer never receives the leaderboard');
 check(Object.keys(live.d).sort().join()==='ageMs,feed,host','SPIELPAUSE-WATCH feed response has only host, feed and age');
 check((await feedOf('gm',A)).s===404,'SPIELPAUSE-WATCH GM still sees nothing while B watches');
 check((await feedOf('a',B)).s===404,'SPIELPAUSE-WATCH the invitation is one-way');
 check((await feedOf('otherCampaign',A)).s!==200,'SPIELPAUSE-WATCH other campaign sees nothing');
 // B cannot overwrite A's cube: a publish always targets the caller's own cube, which nobody watches.
 await send('b',{action:'publish',runId,feed:{...feed,moves:'L'}});
 check((await feedOf('b',A)).d.feed.moves==='U R′ F2','SPIELPAUSE-WATCH a viewer cannot change the host cube');
 // The GM can be invited too.
 check((await send('a',{action:'invite',runId,viewerId:GM})).s===200&&(await feedOf('gm',A)).s===200,'SPIELPAUSE-WATCH GM watches after an invitation');

 const withdrawn=await send('a',{action:'withdraw',runId,viewerId:B});
 check(withdrawn.s===200&&!withdrawn.d.viewers.some(v=>v.id===B),'SPIELPAUSE-WATCH A withdraws the invitation');
 check((await feedOf('b',A)).s===404,'SPIELPAUSE-WATCH B no longer sees the cube after withdrawal');
 check((await status('b')).d.watching.length===0,'SPIELPAUSE-WATCH B has no invitation left');
 await send('a',{action:'withdraw',runId,viewerId:GM});
 check((await feedOf('gm',A)).s===404,'SPIELPAUSE-WATCH GM no longer sees the cube after withdrawal');
 await send('a',{action:'invite',runId,viewerId:B});
 check((await feedOf('b',A)).d.feed===null,'SPIELPAUSE-WATCH withdrawing the last viewer deleted the stored cube');

 await req('/api/live-table','gm','POST',{action:'end',sessionId,runId});
 check([404,409].includes((await feedOf('b',A)).s),'SPIELPAUSE-WATCH invitation ends with the evening');
}
