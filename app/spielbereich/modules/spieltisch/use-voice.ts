"use client";
/* Voice at the live table (VV-01): connection state for the top bar. Shown only when the server releases it for this
 * campaign (CVK_VOICE_CAMPAIGNS). The microphone stays off until the viewer switches it on; nothing is recorded.
 * Speaking is measured locally from each audio track (Web Audio analyser, never connected to the speakers),
 * so the highlight follows the voice itself instead of the server's "last active speaker". */
import {useCallback,useEffect,useRef,useState} from 'react';
import type RealtimeKitClient from '@cloudflare/realtimekit';
import {api} from '../api-client';

type Meeting=Awaited<ReturnType<typeof RealtimeKitClient.init>>;
type Emitter={on:(event:string,fn:(...args:unknown[])=>void)=>void;off?:(event:string,fn:(...args:unknown[])=>void)=>void;removeListener?:(event:string,fn:(...args:unknown[])=>void)=>void};
export type VoiceStatus={available:boolean;mode:'live'|'attrappe'|'unconfigured';video?:boolean;runId:string|null};
type Join={mode:'live';authToken:string;role:string}|{mode:'attrappe';role:string};
export type VoicePhase='idle'|'joining'|'joined'|'error';
/** Per ChroniPlay member: in the voice room, microphone on, currently speaking. */
export type VoicePeer={audio:boolean;speaking:boolean};
export type Voice={status:VoiceStatus|null;phase:VoicePhase;error:string;peers:Record<string,VoicePeer>;micOn:boolean;busy:boolean;blocked:boolean;test:boolean;
 join:()=>Promise<void>;leave:()=>Promise<void>;toggleMic:()=>Promise<void>;resumeAudio:()=>void;clearError:()=>void};

const SPEAK_LEVEL=0.035,POLL_MS=120,HOLD_MS=450;
function listen(target:unknown,event:string,fn:(...args:unknown[])=>void){
 const t=target as Emitter|undefined;if(!t?.on)return()=>{};
 t.on(event,fn);return()=>{(t.off||t.removeListener)?.call(t,event,fn);};
}
type Track={memberId:string;audio:boolean;track?:MediaStreamTrack|null};

export function useVoice(sessionId:string,runId:string,selfId:string):Voice{
 const [status,setStatus]=useState<VoiceStatus|null>(null);
 const [phase,setPhase]=useState<VoicePhase>('idle');
 const [error,setError]=useState('');
 const [peers,setPeers]=useState<Record<string,VoicePeer>>({});
 const [busy,setBusy]=useState(false);
 const [blocked,setBlocked]=useState(false);
 const [test,setTest]=useState(false);
 const meeting=useRef<Meeting|null>(null);
 const cleanup=useRef<(()=>void)[]>([]);
 const tracks=useRef<Track[]>([]);
 const audio=useRef<{ctx:AudioContext;nodes:Map<string,{track:MediaStreamTrack;src:MediaStreamAudioSourceNode;an:AnalyserNode}>;last:Map<string,number>;timer:number}|null>(null);

 useEffect(()=>{
  let alive=true;
  api<VoiceStatus>('/api/live-voice?sessionId='+encodeURIComponent(sessionId)).then(s=>{if(alive)setStatus(s);}).catch(()=>{if(alive)setStatus(null);});
  return()=>{alive=false;};
 },[sessionId,runId]);

 // Local level meter: marks a member as speaking while their track is above the threshold (with a short hold).
 const measure=useCallback(()=>{
  const a=audio.current;if(!a)return;
  const now=performance.now(),seen=new Set<string>();
  for(const t of tracks.current){
   if(!t.audio||!t.track||t.track.readyState!=='live')continue;seen.add(t.memberId);
   let n=a.nodes.get(t.memberId);
   if(!n||n.track!==t.track){n?.src.disconnect();const src=a.ctx.createMediaStreamSource(new MediaStream([t.track]));const an=a.ctx.createAnalyser();an.fftSize=512;src.connect(an);n={track:t.track,src,an};a.nodes.set(t.memberId,n);}
   const buf=new Float32Array(n.an.fftSize);n.an.getFloatTimeDomainData(buf);
   let sum=0;for(const v of buf)sum+=v*v;
   if(Math.sqrt(sum/buf.length)>SPEAK_LEVEL)a.last.set(t.memberId,now);
  }
  for(const [id,n] of a.nodes)if(!seen.has(id)){n.src.disconnect();a.nodes.delete(id);a.last.delete(id);}
  setPeers(old=>{
   let changed=false;const next:Record<string,VoicePeer>={};
   for(const t of tracks.current){const speaking=t.audio&&now-(a.last.get(t.memberId)??-1e9)<HOLD_MS;next[t.memberId]={audio:t.audio,speaking};if(old[t.memberId]?.speaking!==speaking||old[t.memberId]?.audio!==t.audio)changed=true;}
   if(Object.keys(old).length!==Object.keys(next).length)changed=true;
   return changed?next:old;
  });
 },[]);

 const refresh=useCallback(()=>{
  const m=meeting.current;if(!m)return;
  const list:Track[]=[{memberId:selfId,audio:m.self.audioEnabled,track:m.self.audioTrack}];
  for(const p of m.participants.joined.toArray()){const id=(p as {customParticipantId?:string}).customParticipantId||p.id;list.push({memberId:id,audio:p.audioEnabled,track:p.audioTrack});}
  tracks.current=list;measure();
 },[selfId,measure]);

 const reset=useCallback(()=>{
  for(const off of cleanup.current.splice(0))off();
  const a=audio.current;audio.current=null;
  if(a){window.clearInterval(a.timer);for(const n of a.nodes.values())n.src.disconnect();void a.ctx.close().catch(()=>{});}
  meeting.current=null;tracks.current=[];setPeers({});setBlocked(false);setTest(false);
 },[]);

 const leave=useCallback(async()=>{
  const m=meeting.current;reset();setPhase('idle');
  if(m)await m.leave().catch(()=>{/* already gone */});
 },[reset]);

 // Leaving the table, switching the evening or closing the tab ends the call.
 useEffect(()=>()=>{const m=meeting.current;reset();void m?.leave().catch(()=>{});},[sessionId,runId,reset]);

 const join=useCallback(async()=>{
  setPhase('joining');setError('');
  try{
   const j=await api<Join>('/api/live-voice','POST',{action:'join',sessionId,runId});
   if(j.mode==='attrappe'){setTest(true);tracks.current=[{memberId:selfId,audio:false}];setPeers({[selfId]:{audio:false,speaking:false}});setPhase('joined');return;}
   const {default:Client}=await import('@cloudflare/realtimekit');
   const m=await Client.init({authToken:j.authToken,defaults:{audio:false,video:false}});
   meeting.current=m;
   const ctx=new AudioContext();
   audio.current={ctx,nodes:new Map(),last:new Map(),timer:window.setInterval(measure,POLL_MS)};
   const on=(t:unknown,e:string,fn:(...a:unknown[])=>void)=>cleanup.current.push(listen(t,e,fn));
   for(const e of ['participantJoined','participantLeft','audioUpdate'])on(m.participants.joined,e,refresh);
   on(m.self,'audioUpdate',refresh);
   on(m.self,'autoplayError',()=>setBlocked(true));
   on(m.self,'roomLeft',()=>{reset();setPhase('idle');});
   await m.join();
   refresh();setPhase('joined');
  }catch(issue){
   const m=meeting.current;reset();void m?.leave().catch(()=>{});
   setError((issue as Error).message||'Beitreten fehlgeschlagen.');setPhase('error');
  }
 },[sessionId,runId,selfId,measure,refresh,reset]);

 const toggleMic=useCallback(async()=>{
  const m=meeting.current;
  if(!m){if(test){const on=!tracks.current[0]?.audio;tracks.current=[{memberId:selfId,audio:on}];setPeers({[selfId]:{audio:on,speaking:false}});}return;}
  setBusy(true);setError('');
  try{await (m.self.audioEnabled?m.self.disableAudio():m.self.enableAudio());void audio.current?.ctx.resume();refresh();}
  catch{setError('Kein Zugriff auf das Mikrofon. Bitte im Browser erlauben.');}
  finally{setBusy(false);}
 },[test,selfId,refresh]);

 const resumeAudio=useCallback(()=>{void meeting.current?.self.playAudio().then(()=>setBlocked(false)).catch(()=>{});},[]);
 const clearError=useCallback(()=>{setError('');setPhase(p=>p==='error'?'idle':p);},[]);
 return {status,phase,error,peers,micOn:!!peers[selfId]?.audio,busy,blocked,test,join,leave,toggleMic,resumeAudio,clearError};
}
