"use client";
/* Voice and video at the live table (VV-01, prototype). Shown only when the server releases it for this campaign
 * (CVK_VOICE_CAMPAIGNS). Microphone and camera stay off until the viewer switches them on; nothing is recorded. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {Mic,MicOff,Video,VideoOff,PhoneOff,Headphones,ChevronUp,ChevronDown,Volume2} from 'lucide-react';
import type RealtimeKitClient from '@cloudflare/realtimekit';
import {api} from '../api-client';
import {useCollapsed} from './use-collapsed';
import styles from './voice-bar.module.css';

type Meeting=Awaited<ReturnType<typeof RealtimeKitClient.init>>;
type Peer={id:string;name:string;self:boolean;audio:boolean;video:boolean;registerVideoElement?:(el:HTMLVideoElement,preview?:boolean)=>void;deregisterVideoElement?:(el?:HTMLVideoElement,preview?:boolean)=>void};
type Emitter={on:(event:string,fn:(...args:unknown[])=>void)=>void;off?:(event:string,fn:(...args:unknown[])=>void)=>void;removeListener?:(event:string,fn:(...args:unknown[])=>void)=>void};
type Status={available:boolean;mode:'live'|'attrappe'|'unconfigured';runId:string|null};
type Join={mode:'live';authToken:string;role:string}|{mode:'attrappe';role:string};
type Phase='idle'|'joining'|'joined'|'error';

function listen(target:unknown,event:string,fn:(...args:unknown[])=>void){
 const t=target as Emitter|undefined;if(!t?.on)return()=>{};
 t.on(event,fn);return()=>{(t.off||t.removeListener)?.call(t,event,fn);};
}
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]!.toUpperCase()).join('')||'?';

function Tile({peer,speaking}:{peer:Peer;speaking:boolean}){
 const video=useRef<HTMLVideoElement>(null);
 useEffect(()=>{
  const el=video.current;if(!el||!peer.video||!peer.registerVideoElement)return;
  peer.registerVideoElement(el,peer.self);
  return()=>{peer.deregisterVideoElement?.(el,peer.self);};
 },[peer]);
 return <li className={styles.tile} data-speaking={speaking} aria-label={peer.name+(peer.self?' (du)':'')+(peer.audio?'':', stumm')+(speaking?', spricht':'')}>
  {peer.video?<video ref={video} autoPlay playsInline muted={peer.self}/>:<span className={styles.initials} aria-hidden="true">{initials(peer.name)}</span>}
  <span className={styles.label}>{peer.audio?null:<MicOff size={12} aria-hidden="true"/>}<span>{peer.self?'Du':peer.name}</span></span>
 </li>;
}

export function VoiceBar({sessionId,runId}:{sessionId:string;runId:string}){
 const [status,setStatus]=useState<Status|null>(null);
 const [phase,setPhase]=useState<Phase>('idle');
 const [error,setError]=useState('');
 const [peers,setPeers]=useState<Peer[]>([]);
 const [speaker,setSpeaker]=useState('');
 const [blocked,setBlocked]=useState(false);
 const [busy,setBusy]=useState(false);
 const [mode,setMode]=useState<'live'|'attrappe'>('live');
 const [collapsed,setCollapsed]=useCollapsed('voice');
 const meeting=useRef<Meeting|null>(null);
 const cleanup=useRef<(()=>void)[]>([]);

 useEffect(()=>{
  let alive=true;
  api<Status>('/api/live-voice?sessionId='+encodeURIComponent(sessionId)).then(s=>{if(alive)setStatus(s);}).catch(()=>{if(alive)setStatus(null);});
  return()=>{alive=false;};
 },[sessionId,runId]);

 const refresh=useCallback(()=>{
  const m=meeting.current;if(!m)return;
  const self=m.self;
  const list:Peer[]=[{id:self.id,name:self.name,self:true,audio:self.audioEnabled,video:self.videoEnabled,registerVideoElement:self.registerVideoElement.bind(self),deregisterVideoElement:self.deregisterVideoElement.bind(self)}];
  for(const p of m.participants.joined.toArray())list.push({id:p.id,name:p.name,self:false,audio:p.audioEnabled,video:p.videoEnabled,registerVideoElement:p.registerVideoElement.bind(p),deregisterVideoElement:p.deregisterVideoElement.bind(p)});
  setPeers(list);
 },[]);

 const reset=useCallback(()=>{
  for(const off of cleanup.current.splice(0))off();
  meeting.current=null;setPeers([]);setSpeaker('');setBlocked(false);
 },[]);

 const leave=useCallback(async()=>{
  const m=meeting.current;reset();setPhase('idle');
  if(m)await m.leave().catch(()=>{/* already gone */});
 },[reset]);

 // Leaving the table, switching the evening or closing the tab ends the call.
 useEffect(()=>()=>{const m=meeting.current;reset();void m?.leave().catch(()=>{});},[sessionId,runId,reset]);

 const join=async()=>{
  setPhase('joining');setError('');
  try{
   const j=await api<Join>('/api/live-voice','POST',{action:'join',sessionId,runId});
   if(j.mode==='attrappe'){
    setMode('attrappe');setPeers([{id:'attrappe-self',name:'Du',self:true,audio:false,video:false}]);setPhase('joined');return;
   }
   setMode('live');
   const {default:Client}=await import('@cloudflare/realtimekit');
   const m=await Client.init({authToken:j.authToken,defaults:{audio:false,video:false}});
   meeting.current=m;
   const on=(t:unknown,e:string,fn:(...a:unknown[])=>void)=>cleanup.current.push(listen(t,e,fn));
   for(const e of ['participantJoined','participantLeft','audioUpdate','videoUpdate'])on(m.participants.joined,e,refresh);
   on(m.self,'audioUpdate',refresh);on(m.self,'videoUpdate',refresh);
   on(m.participants,'activeSpeaker',(p)=>setSpeaker((p as {peerId?:string})?.peerId||''));
   on(m.self,'autoplayError',()=>setBlocked(true));
   on(m.self,'roomLeft',()=>{reset();setPhase('idle');});
   await m.join();
   refresh();setPhase('joined');
  }catch(issue){
   const m=meeting.current;reset();void m?.leave().catch(()=>{});
   setError((issue as Error).message||'Beitreten fehlgeschlagen.');setPhase('error');
  }
 };

 const toggle=async(kind:'audio'|'video')=>{
  const m=meeting.current;
  if(!m){setPeers(old=>old.map(p=>p.self?{...p,[kind]:!p[kind]}:p));return;}
  setBusy(true);setError('');
  try{
   if(kind==='audio')await (m.self.audioEnabled?m.self.disableAudio():m.self.enableAudio());
   else await (m.self.videoEnabled?m.self.disableVideo():m.self.enableVideo());
   refresh();
  }catch{setError(kind==='audio'?'Kein Zugriff auf das Mikrofon. Bitte im Browser erlauben.':'Kein Zugriff auf die Kamera. Bitte im Browser erlauben.');}
  finally{setBusy(false);}
 };

 if(!status?.available)return null;
 const me=peers.find(p=>p.self);
 const count=peers.length;
 if(collapsed)return <div className={styles.slot}><button className={styles.handle} onClick={()=>setCollapsed(false)} aria-label={'Voice öffnen'+(phase==='joined'?', verbunden mit '+count+' Personen':'')}><Headphones size={16} aria-hidden="true"/>{phase==='joined'?<><span>{count}</span>{me&&!me.audio&&<MicOff size={14} aria-label="stumm"/>}</>:<span>Voice</span>}<ChevronDown size={14} aria-hidden="true"/></button></div>;
 return <div className={styles.slot}><section className={styles.panel} aria-label="Voice und Video am Spieltisch">
  <header><Headphones size={16} aria-hidden="true"/><h2>Stimmen am Tisch</h2>{phase==='joined'&&<small>{count} {count===1?'Person':'Personen'}</small>}<button className={styles.fold} onClick={()=>setCollapsed(true)} aria-label="Voice einklappen"><ChevronUp size={15} aria-hidden="true"/></button></header>
  {status.mode==='unconfigured'&&<p className={styles.hint}>Voice ist für diese Runde freigeschaltet, aber noch nicht eingerichtet.</p>}
  {mode==='attrappe'&&phase==='joined'&&<p className={styles.hint}>Testmodus: keine echte Verbindung.</p>}
  {phase==='joined'&&<ul className={styles.tiles}>{peers.map(p=><Tile key={p.id+':'+p.video} peer={p} speaking={!!speaker&&speaker===p.id}/>)}</ul>}
  {blocked&&<button className={styles.wide} onClick={()=>{void meeting.current?.self.playAudio().then(()=>setBlocked(false)).catch(()=>{});}}><Volume2 size={15} aria-hidden="true"/> Ton der anderen einschalten</button>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {phase==='joined'?<div className={styles.controls}>
   <button onClick={()=>void toggle('audio')} disabled={busy} aria-pressed={!!me?.audio} aria-label={me?.audio?'Mikrofon ausschalten':'Mikrofon einschalten'}>{me?.audio?<Mic size={17}/>:<MicOff size={17}/>}</button>
   <button onClick={()=>void toggle('video')} disabled={busy} aria-pressed={!!me?.video} aria-label={me?.video?'Kamera ausschalten':'Kamera einschalten'}>{me?.video?<Video size={17}/>:<VideoOff size={17}/>}</button>
   <button className={styles.leave} onClick={()=>void leave()} aria-label="Voice verlassen"><PhoneOff size={17}/></button>
  </div>:status.mode!=='unconfigured'&&<>
   <p className={styles.hint}>Mikrofon und Kamera bleiben aus, bis du sie einschaltest. Es wird nichts aufgezeichnet.</p>
   <button className={styles.join} onClick={()=>void join()} disabled={phase==='joining'}>{phase==='joining'?'Verbinde …':'Beitreten'}</button>
  </>}
 </section></div>;
}
