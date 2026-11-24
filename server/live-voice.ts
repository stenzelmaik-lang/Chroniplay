/** Voice at the live table (VV-01). Gated per campaign by CVK_VOICE_CAMPAIGNS; outside the gate every action answers 404.
 * The Cloudflare API token never leaves this file: clients only receive their own participant token. */
import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {database,HttpError,type Actor} from './access';
import {stageRoom} from './live-stage';
import {liveRoomKey} from './live-game';
import {voiceAvailable,voiceLocal,voiceConfig,voiceMode,voiceBase,meetingBody,participantBody,apiData,currentMeeting,type VoiceGateEnv,type VoiceSecretsEnv,type VoiceConfig,type RoomVoice} from '@/domain/live-voice';

const gate=()=>env as unknown as VoiceGateEnv;
const secrets=()=>env as unknown as VoiceSecretsEnv;
const sessionSchema=z.string().min(1).max(160);
const joinSchema=z.object({action:z.literal('join'),sessionId:sessionSchema,runId:z.string().uuid()}).strict();

function gated(a:Actor){if(!voiceAvailable(gate(),a.campaignId))throw new HttpError(404,'Nicht gefunden.');}
/** The running evening this request names, or 409 when it ended or changed meanwhile. */
async function evening(a:Actor,sessionId:string,runId:string){
 const {room}=await stageRoom(a,sessionId);
 if(room.runId!==runId)throw new HttpError(409,'Spielabend inzwischen gewechselt.');
 return room as typeof room&{voice?:RoomVoice};
}

async function realtime(c:VoiceConfig,path:string,body:unknown){
 let response:Response;
 try{response=await fetch(voiceBase(c)+path,{method:'POST',headers:{Authorization:'Bearer '+c.apiToken,'Content-Type':'application/json'},body:JSON.stringify(body)});}
 catch{throw new HttpError(502,'Der Sprachdienst ist gerade nicht erreichbar.');}
 const data=apiData(await response.json().catch(()=>null));
 if(!response.ok||!data){console.log('live-voice: RealtimeKit '+response.status+' '+path.split('/')[1]);throw new HttpError(502,'Der Sprachdienst hat die Anfrage abgelehnt.');}
 return data;
}

/** Whether the voice control shows for this viewer: only for members of a running evening. Reveals only the mode. */
export async function voiceStatus(a:Actor,sessionId:string){
 gated(a);
 if(!sessionSchema.safeParse(sessionId).success)throw new HttpError(400,'Spielabend wählen.');
 await stageRoom(a,sessionId);
 return {mode:voiceMode(gate(),secrets())};
}

/** One meeting per evening, stored on the room record. Concurrent first joins may create two meetings; the conditional
 * UPDATE keeps exactly one and the loser simply uses the stored one (an empty meeting costs nothing). */
async function eveningMeeting(a:Actor,sessionId:string,runId:string,c:VoiceConfig){
 const stored=currentMeeting((await evening(a,sessionId,runId)).voice,runId);
 if(stored)return stored;
 const created=await realtime(c,'/meetings',meetingBody(runId));
 const meetingId=typeof created.id==='string'?created.id:'';
 if(!meetingId)throw new HttpError(502,'Der Sprachdienst hat keinen Raum angelegt.');
 const updated=await database().prepare("UPDATE records SET body=json_set(body,'$.voice',json(?)),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table' AND json_extract(body,'$.runId')=? AND json_extract(body,'$.open')=1 AND COALESCE(json_extract(body,'$.voice.runId'),'')<>?").bind(JSON.stringify({runId,meetingId}),new Date().toISOString(),liveRoomKey(a,sessionId),a.campaignId,runId,runId).run();
 if(updated.meta.changes)return meetingId;
 const winner=currentMeeting((await evening(a,sessionId,runId)).voice,runId);
 if(!winner)throw new HttpError(409,'Spielabend beendet oder gewechselt.');
 return winner;
}

/** Issues the caller's own short-lived participant token for the running evening. */
export async function voiceJoin(a:Actor,raw:unknown){
 gated(a);
 const parsed=joinSchema.safeParse(raw);if(!parsed.success)throw new HttpError(400,'Ungültige Sprachaktion: '+parsed.error.issues[0].message);
 const d=parsed.data,c=voiceConfig(secrets()),role=a.gm?'host' as const:'participant' as const;
 if(!c){
  if(!voiceLocal(gate()))throw new HttpError(503,'Der Sprachchat ist für diese Runde noch nicht eingerichtet.');
  await evening(a,d.sessionId,d.runId);
  return {mode:'attrappe' as const,role};
 }
 const meetingId=await eveningMeeting(a,d.sessionId,d.runId,c);
 const participant=await realtime(c,'/meetings/'+encodeURIComponent(meetingId)+'/participants',participantBody(a,c));
 const authToken=typeof participant.token==='string'?participant.token:typeof participant.authToken==='string'?participant.authToken:'';
 if(!authToken)throw new HttpError(502,'Der Sprachdienst hat keinen Zugang ausgestellt.');
 return {mode:'live' as const,role,authToken};
}
