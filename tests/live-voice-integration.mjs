import {randomUUID} from 'node:crypto';
/** VV-01: voice route against the isolated local instance (CVK_VOICE=local-only, no RealtimeKit secrets -> dummy mode). */
export async function liveVoiceIntegration({req,check}){
 const sessionId=randomUUID();
 const status=(who)=>req('/api/live-voice?sessionId='+sessionId,who);
 const join=(who,runId,extra={})=>req('/api/live-voice',who,'POST',{action:'join',sessionId,runId,...extra});
 check((await status()).s===401,'VOICE anonymous status denied');
 check([404,409].includes((await status('a')).s),'VOICE no voice before the evening starts');
 await req('/api/live-table','gm','POST',{action:'start',sessionId,title:'SYNTHETIC voice evening',create:true});
 const runId=(await req('/api/live-stage?sessionId='+sessionId,'gm')).d.runId;
 const gmStatus=await status('gm'),playerStatus=await status('a');
 check(gmStatus.s===200&&gmStatus.d.mode==='attrappe'&&Object.keys(gmStatus.d).join()==='mode','VOICE GM sees only the mode (dummy) for the running evening');
 check(playerStatus.s===200&&playerStatus.d.mode==='attrappe','VOICE player at the table sees voice');
 check((await join(undefined,runId)).s===401,'VOICE anonymous join denied');
 for(const role of ['blockedPlayer','otherCampaign','editor'])check([403,404].includes((await join(role,runId)).s),'VOICE blocked, foreign or nonparticipant '+role+' denied');
 const gm=await join('gm',runId),player=await join('a',runId);
 check(gm.s===200&&gm.d.mode==='attrappe'&&gm.d.role==='host','VOICE GM joins as host');
 check(player.s===200&&player.d.mode==='attrappe'&&player.d.role==='participant','VOICE player joins as participant');
 check(!JSON.stringify([gmStatus.d,playerStatus.d,gm.d,player.d]).match(/token|apiToken|accountId|appId|CF_REALTIME/i),'VOICE responses carry no configuration or secrets');
 check((await join('a',randomUUID())).s===409,'VOICE stale evening refused');
 check((await join('a',runId,{extra:1})).s===400,'VOICE unknown fields refused');
 check((await req('/api/live-voice','a','POST',{action:'join',sessionId,runId},{Origin:'https://evil.invalid'})).s===403,'VOICE cross-site join refused');
 await req('/api/live-table','gm','POST',{action:'end',sessionId,runId});
 check([404,409].includes((await join('a',runId)).s),'VOICE ended evening refuses joins');
}
