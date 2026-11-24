"use client";
/* Voice at the live table (VV-01): connection state for the top bar. Shown only when the server releases it for this
 * campaign (CVK_VOICE_CAMPAIGNS). The microphone stays off until the viewer switches it on; nothing is recorded.
 * Speaking is measured locally from each audio track (Web Audio analyser, never connected to the speakers), so the
 * highlight follows the voice itself. It lives in a small store outside React state: only the affected avatar
 * re-renders, never the whole table. */
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type RealtimeKitClient from '@cloudflare/realtimekit';
import {api} from '../api-client';

type Meeting=Awaited<ReturnType<typeof RealtimeKitClient.init>>;
type Emitter={on:(event:string,fn:(...args:unknown[])=>void)=>void;off?:(event:string,fn:(...args:unknown[])=>void)=>void;removeListener?:(event:string,fn:(...args:unknown[])=>void)=>void};
type Status={mode:'live'|'attrappe'|'unconfigured'};
type Join={mode:'live';authToken:string}|{mode:'attrappe'};
type Phase='idle'|'joining'|'joined'|'error';

/** Who is speaking right now. Subscribers are notified only when the set changes. */
export class SpeakingStore{
 private ids=new Set<string>();private listeners=new Set<()=>void>();
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 has=(id:string)=>this.ids.has(id);
 set(next:Set<string>){if(next.size===this.ids.size&&[...next].every(id=>this.ids.has(id)))return;this.ids=next;for(const fn of this.listeners)fn();}
}
/** True while the member's voice is above the speaking threshold. */
export const useSpeaking=(store:SpeakingStore|undefined,id:string)=>useSyncExternalStore(store?.subscribe??noop,()=>!!store?.has(id),()=>false);
const noop=()=>()=>{};

/** Per ChroniPlay member in the voice room: microphone on or off. */
export type VoicePeers=Record<string,{audio:boolean}>;
export type Voice={status:Status|null;phase:Phase;error:string;peers:VoicePeers;speaking:SpeakingStore;micOn:boolean;busy:boolean;blocked:boolean;test:boolean;
 join:()=>Promise<void>;leave:()=>Promise<void>;toggleMic:()=>Promise<void>;resumeAudio:()=>void;clearError:()=>void};

const SPEAK_LEVEL=0.035,POLL_MS=120,HOLD_MS=450;
function listen(target:unknown,event:string,fn:(...args:unknown[])=>void){
 const t=target as Emitter|undefined;if(!t?.on)return()=>{};
 t.on(event,fn);return()=>{(t.off||t.removeListener)?.call(t,event,fn);};
}
type Track={memberId:string;audio:boolean;track?:MediaStreamTrack|null};
type Meter={track:MediaStreamTrack;src:MediaStreamAudioSourceNode;an:AnalyserNode;buf:Float32Array<ArrayBuffer>};
const samePeers=(a:VoicePeers,b:VoicePeers)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([id,p])=>b[id]?.audio===p.audio);

export function useVoice(sessionId:string,runId:string,selfId:string):Voice{
 const [status,setStatus]=useState<Status|null>(null);
 const [phase,setPhase]=useState<Phase>('idle');
 const [error,setError]=useState('');
 const [peers,setPeers]=useState<VoicePeers>({});
 const [busy,setBusy]=useState(false);
 const [blocked,setBlocked]=useState(false);
 const [speaking]=useState(()=>new SpeakingStore());
 const meeting=useRef<Meeting|null>(null);
 const cleanup=useRef<(()=>void)[]>([]);
 const tracks=useRef<Track[]>([]);
 const audio=useRef<{ctx:AudioContext;meters:Map<string,Meter>;last:Map<string,number>;timer:number}|null>(null);

 useEffect(()=>{
  let alive=true;
  api<Status>('/api/live-voice?sessionId='+encodeURIComponent(sessionId)).then(s=>{if(alive)setStatus(s);}).catch(()=>{if(alive)setStatus(null);});
  return()=>{alive=false;};
 },[sessionId,runId]);

 // Local level meter: a member counts as speaking while their track is above the threshold (with a short hold).
 const measure=useCallback(()=>{
  const a=audio.current;if(!a)return;
  const now=performance.now(),live=new Set<string>(),talking=new Set<string>();
  for(const t of tracks.current){
   if(!t.audio||!t.track||t.track.readyState!=='live')continue;live.add(t.memberId);
   let m=a.meters.get(t.memberId);
   if(!m||m.track!==t.track){m?.src.disconnect();const src=a.ctx.createMediaStreamSource(new MediaStream([t.track]));const an=a.ctx.createAnalyser();an.fftSize=512;src.connect(an);m={track:t.track,src,an,buf:new Float32Array(an.fftSize)};a.meters.set(t.memberId,m);}
   m.an.getFloatTimeDomainData(m.buf);
   let sum=0;for(const v of m.buf)sum+=v*v;
   if(Math.sqrt(sum/m.buf.length)>SPEAK_LEVEL)a.last.set(t.memberId,now);
   if(now-(a.last.get(t.memberId)??-Infinity)<HOLD_MS)talking.add(t.memberId);
  }
  for(const [id,m] of a.meters)if(!live.has(id)){m.src.disconnect();a.meters.delete(id);a.last.delete(id);}
  speaking.set(talking);
 },[speaking]);

 const refresh=useCallback(()=>{
  const m=meeting.current;if(!m)return;
  const list:Track[]=[{memberId:selfId,audio:m.self.audioEnabled,track:m.self.audioTrack}];
  for(const p of m.participants.joined.toArray())list.push({memberId:(p as {customParticipantId?:string}).customParticipantId||p.id,audio:p.audioEnabled,track:p.audioTrack});
  tracks.current=list;
  const next=Object.fromEntries(list.map(t=>[t.memberId,{audio:t.audio}]));
  setPeers(old=>samePeers(old,next)?old:next);
  measure();
 },[selfId,measure]);

 /** Ends the call locally (listeners, meters, state) and leaves the room. Safe to call twice. */
 const hangUp=useCallback(()=>{
  const m=meeting.current;meeting.current=null;
  for(const off of cleanup.current.splice(0))off();
  const a=audio.current;audio.current=null;
  if(a){window.clearInterval(a.timer);for(const meter of a.meters.values())meter.src.disconnect();void a.ctx.close().catch(()=>{});}
  tracks.current=[];speaking.set(new Set());setPeers({});setBlocked(false);
  return m?m.leave().catch(()=>{/* already gone */}):Promise.resolve();
 },[speaking]);

 const leave=useCallback(async()=>{setPhase('idle');await hangUp();},[hangUp]);

 // Leaving the table, switching the evening or closing the tab ends the call.
 useEffect(()=>()=>{void hangUp();},[sessionId,runId,hangUp]);

 const join=useCallback(async()=>{
  setPhase('joining');setError('');
  try{
   const j=await api<Join>('/api/live-voice','POST',{action:'join',sessionId,runId});
   if(j.mode==='attrappe'){setPeers({[selfId]:{audio:false}});setPhase('joined');return;}
   const {default:Client}=await import('@cloudflare/realtimekit');
   const m=await Client.init({authToken:j.authToken,defaults:{audio:false,video:false}});
   meeting.current=m;
   audio.current={ctx:new AudioContext(),meters:new Map(),last:new Map(),timer:window.setInterval(measure,POLL_MS)};
   const on=(t:unknown,e:string,fn:(...a:unknown[])=>void)=>cleanup.current.push(listen(t,e,fn));
   for(const e of ['participantJoined','participantLeft','audioUpdate'])on(m.participants.joined,e,refresh);
   on(m.self,'audioUpdate',refresh);
   on(m.self,'autoplayError',()=>setBlocked(true));
   on(m.self,'roomLeft',()=>{void hangUp();setPhase('idle');});
   await m.join();
   refresh();setPhase('joined');
  }catch(issue){
   void hangUp();
   setError((issue as Error).message||'Beitreten fehlgeschlagen.');setPhase('error');
  }
 },[sessionId,runId,selfId,measure,refresh,hangUp]);

 const test=phase==='joined'&&status?.mode==='attrappe';
 const toggleMic=useCallback(async()=>{
  const m=meeting.current;
  if(!m){if(test)setPeers(old=>({[selfId]:{audio:!old[selfId]?.audio}}));return;}
  setBusy(true);setError('');
  try{await (m.self.audioEnabled?m.self.disableAudio():m.self.enableAudio());void audio.current?.ctx.resume();refresh();}
  catch{setError('Kein Zugriff auf das Mikrofon. Bitte im Browser erlauben.');}
  finally{setBusy(false);}
 },[test,selfId,refresh]);

 const resumeAudio=useCallback(()=>{void meeting.current?.self.playAudio().then(()=>setBlocked(false)).catch(()=>{});},[]);
 const clearError=useCallback(()=>{setError('');setPhase(p=>p==='error'?'idle':p);},[]);
 return {status,phase,error,peers,speaking,micOn:!!peers[selfId]?.audio,busy,blocked,test,join,leave,toggleMic,resumeAudio,clearError};
}
