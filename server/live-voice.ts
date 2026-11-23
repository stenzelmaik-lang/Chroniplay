/** Voice and video at the live table (VV-01). Gated per campaign by CVK_VOICE_CAMPAIGNS; outside the gate every action answers 404.
 * The Cloudflare API token never leaves this file: clients only receive their own participant token. */
import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {database,HttpError,type Actor} from './access';
import {stageRoom} from './live-stage';
import {voiceAvailable,voiceVideo,voiceConfig,voiceMode,voiceBase,meetingBody,participantBody,apiData,currentMeeting,type VoiceGateEnv,type VoiceSecretsEnv,type VoiceConfig,type RoomVoice} from '@/domain/live-voice';

const gate=()=>env as unknown as VoiceGateEnv;
const secrets=()=>env as unknown as VoiceSecretsEnv;
export const liveVoiceAvailable=(a:Actor)=>voiceAvailable(gate(),a.campaignId);
const roomKey=(a:Actor,sessionId:string)=>`live-table:${a.campaignId}:${sessionId}`;
const sessionSchema=z.string().min(1).max(160);
const joinSchema=z.object({action:z.literal('join'),sessionId:sessionSchema,runId:z.string().uuid()}).strict();

async function realtime(c:VoiceConfig,path:string,body:unknown,fetchImpl:typeof fetch=fetch){
 let response:Response;
 try{response=await fetchImpl(voiceBase(c)+path,{method:'POST',headers:{Authorization:'Bearer '+c.apiToken,'Content-Type':'application/json'},body:JSON.stringify(body)});}
 catch{throw new HttpError(502,'Der Sprachdienst ist gerade nicht erreichbar.');}
 const data=apiData(await response.json().catch(()=>null));
 if(!response.ok||!data){console.log('live-voice: RealtimeKit '+response.status+' '+path.split('/')[1]);throw new HttpError(502,'Der Sprachdienst hat die Anfrage abgelehnt.');}
 return data;
}

/** Whether the voice bar shows for this viewer and evening. Never reveals configuration details beyond the mode. */
export async function voiceStatus(a:Actor,sessionId:string){
 if(!liveVoiceAvailable(a))throw new HttpError(404,'Nicht gefunden.');
 if(!sessionSchema.safeParse(sessionId).success)throw new HttpError(400,'Spielabend wählen.');
 const {room}=await stageRoom(a,sessionId);
 return {available:true,mode:voiceMode(gate(),secrets()),video:voiceVideo(gate()),runId:room.runId||null};
}

/** One meeting per evening, stored on the room record. Concurrent first joins may create two meetings; the conditional
 * UPDATE keeps exactly one and the loser simply uses the stored one (an empty meeting costs nothing). */
async function evenMeeting(a:Actor,sessionId:string,runId:string,c:VoiceConfig,fetchImpl?:typeof fetch){
 const {room}=await stageRoom(a,sessionId);
 if(room.runId!==runId)throw new HttpError(409,'Spielabend inzwischen gewechselt.');
 const stored=currentMeeting((room as {voice?:RoomVoice}).voice,runId);
 if(stored)return stored;
 const created=await realtime(c,'/meetings',meetingBody(runId),fetchImpl);
 const meetingId=typeof created.id==='string'?created.id:'';
 if(!meetingId)throw new HttpError(502,'Der Sprachdienst hat keinen Raum angelegt.');
 const updated=await database().prepare("UPDATE records SET body=json_set(body,'$.voice',json(?)),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table' AND json_extract(body,'$.runId')=? AND json_extract(body,'$.open')=1 AND COALESCE(json_extract(body,'$.voice.runId'),'')<>?").bind(JSON.stringify({runId,meetingId}),new Date().toISOString(),roomKey(a,sessionId),a.campaignId,runId,runId).run();
 if(updated.meta.changes)return meetingId;
 const again=await stageRoom(a,sessionId);
 const winner=currentMeeting((again.room as {voice?:RoomVoice}).voice,runId);
 if(!winner)throw new HttpError(409,'Spielabend beendet oder gewechselt.');
 return winner;
}

/** Issues the caller's own short-lived participant token for the running evening. */
export async function voiceJoin(a:Actor,raw:unknown,fetchImpl?:typeof fetch){
 if(!liveVoiceAvailable(a))throw new HttpError(404,'Nicht gefunden.');
 const parsed=joinSchema.safeParse(raw);if(!parsed.success)throw new HttpError(400,'Ungültige Sprachaktion: '+parsed.error.issues[0].message);
 const d=parsed.data,c=voiceConfig(secrets());
 if(!c){
  if(voiceMode(gate(),secrets())!=='attrappe')throw new HttpError(503,'Voice und Video sind für diese Runde noch nicht eingerichtet.');
  const {room}=await stageRoom(a,d.sessionId);
  if(room.runId!==d.runId)throw new HttpError(409,'Spielabend inzwischen gewechselt.');
  return {mode:'attrappe' as const,role:a.gm?'host':'participant',video:voiceVideo(gate())};
 }
 const meetingId=await evenMeeting(a,d.sessionId,d.runId,c,fetchImpl);
 const participant=await realtime(c,'/meetings/'+encodeURIComponent(meetingId)+'/participants',participantBody(a,c),fetchImpl);
 const authToken=typeof participant.token==='string'?participant.token:typeof participant.authToken==='string'?participant.authToken:'';
 if(!authToken)throw new HttpError(502,'Der Sprachdienst hat keinen Zugang ausgestellt.');
 return {mode:'live' as const,role:a.gm?'host':'participant',video:voiceVideo(gate()),authToken};
}
