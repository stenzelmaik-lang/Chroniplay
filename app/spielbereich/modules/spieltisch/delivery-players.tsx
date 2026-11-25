/* eslint-disable @next/next/no-img-element -- Recipient-checked delivery media; never a public image proxy. */
"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {documentNumber,type PlayerDelivery} from '@/domain/personal-delivery';
import {visionPlan} from '@/domain/vision-direction';
import {engineVision} from '../vision-engine/engine-vision';
import engineStyles from '../vision-engine/vision-engine.module.css';
import {RichTextView} from '../rich-text';
import {richTextFileIds} from '@/domain/location-rich-text';
import {playArrivalSound} from './delivery-sounds';
import styles from './delivery-players.module.css';

/* ------------------------------------------------------------------ preferences */
const EFFECTS_KEY='chroniplay-vision-effects';
/** Reduced effects: the OS setting or the player's own choice. Same content, calmer presentation. */
export function useReducedEffects(){
 const [os,setOs]=useState(false),[own,setOwn]=useState(false);
 useEffect(()=>{
  const m=window.matchMedia('(prefers-reduced-motion: reduce)');
  const sync=()=>setOs(m.matches);queueMicrotask(sync);m.addEventListener('change',sync);
  queueMicrotask(()=>{try{setOwn(localStorage.getItem(EFFECTS_KEY)==='reduced');}catch{/* preference only */}});
  return()=>m.removeEventListener('change',sync);
 },[]);
 const toggle=useCallback(()=>setOwn(v=>{try{localStorage.setItem(EFFECTS_KEY,v?'full':'reduced');}catch{/* preference only */}return !v;}),[]);
 return {reduced:os||own,own,toggle};
}

/** While a vision runs, everything else on the page is inert: no table actions, no stray focus. Restored afterwards. */
function useIsolate(host:HTMLElement|null,active:boolean,pull:boolean){
 useEffect(()=>{
  if(!host||!active)return;
  const others=[...document.body.children].filter((el):el is HTMLElement=>el!==host&&el instanceof HTMLElement);
  const before=others.map(el=>({el,inert:el.inert,filter:el.style.filter,transform:el.style.transform,transition:el.style.transition}));
  for(const el of others){el.inert=true;if(pull){el.style.transition='filter 2.4s ease, transform 2.8s ease';el.style.filter='blur(5px) saturate(.6)';el.style.transform='scale(1.025)';}}
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{for(const b of before){b.el.inert=b.inert;b.el.style.filter=b.filter;b.el.style.transform=b.transform;b.el.style.transition=b.transition;}document.body.style.overflow=overflow;};
 },[host,active,pull]);
}

/* ------------------------------------------------------------------ vision (Vision Engine) */
/**
 * Vollbild-Vision mit der Vision Engine (WebGL2, Ersatzdarstellung ohne WebGL2): Bilder treten organisch aus dem Nebel,
 * Worte erscheinen frei stehend, Ton und Licht folgen demselben Zeitplan. Einstieg, Rechte und Quittungen bleiben unverändert:
 * Die Engine lädt Bilder und Ton nur über die übergebene, empfängergeprüfte assetUrl.
 */
export function VisionPlayer({delivery,assetUrl,onSeen,onDone,preview=false,withdrawn=false}:{delivery:PlayerDelivery;assetUrl:(fileId:string)=>string;onSeen?:()=>void;onDone:()=>void;preview?:boolean;withdrawn?:boolean}){
 const [host]=useState(()=>{if(typeof document==='undefined')return null;const el=document.createElement('div');el.className=styles.host;return el;});
 const {reduced}=useReducedEffects();
 const [active,setActive]=useState(true);
 const stage=useRef<HTMLDivElement>(null);
 const engine=useRef<{acknowledge:()=>void;destroy:()=>void}|null>(null);
 // Parents re-render on every poll; the latest values are read at call time so the engine is never restarted by that.
 const doneRef=useRef(onDone),seenRef=useRef(onSeen),deliveryRef=useRef(delivery),assetRef=useRef(assetUrl),seenSent=useRef(false);
 useEffect(()=>{doneRef.current=onDone;seenRef.current=onSeen;deliveryRef.current=delivery;assetRef.current=assetUrl;});
 useEffect(()=>{if(!host)return;document.body.appendChild(host);return()=>{host.remove();};},[host]);
 useIsolate(host,active,!reduced);
 useEffect(()=>{if(!seenSent.current&&!preview){seenSent.current=true;seenRef.current?.();}},[preview]);
 useEffect(()=>{
  const el=stage.current;
  if(!el)return;
  let alive=true;
  void import('../vision-engine/player.js').then(({VisionPlayer:Engine})=>{
   if(!alive)return;
   const e=new Engine(el,{mode:'play',label:preview?'Vorschau einer Vision':'Eine Vision',badge:preview?'Vorschau · nichts wird zugestellt':'',onEnd:()=>{setActive(false);doneRef.current();}});
   engine.current=e;
   const d=deliveryRef.current;
   void e.load(engineVision(visionPlan({preset:d.preset,tempo:d.tempo,images:d.images,fragments:d.fragments,audioFileId:d.audio?d.audioFileId:null,direction:d.direction}),assetRef.current))
    .then(()=>{if(!alive)return;e.play();el.focus({preventScroll:true});});
  });
  return()=>{alive=false;engine.current?.destroy();engine.current=null;};
 },[preview,host]);
 // a withdrawn vision leaves gracefully
 useEffect(()=>{if(withdrawn)engine.current?.acknowledge();},[withdrawn]);
 if(!host)return null;
 return createPortal(<div ref={stage} className={engineStyles.root}/>,host);
}

/* ------------------------------------------------------------------ personal message (fax / letter) */
export function MessagePlayer({delivery,assetUrl,recipientName,onSeen,onDone,preview=false,withdrawn=false}:{delivery:PlayerDelivery;assetUrl:(fileId:string)=>string;recipientName:string;onSeen?:()=>void;onDone:()=>void;preview?:boolean;withdrawn?:boolean}){
 const [phase,setPhase]=useState<'arrive'|'read'|'leave'>('arrive'),[sound,setSound]=useState<'idle'|'played'|'blocked'>('idle');
 const audio=useRef<HTMLAudioElement>(null),soundStarted=useRef(false);
 // Above every table layer (rails, HUD, dialogs), but not modal: the table stays usable beside the message.
 const [host]=useState(()=>{if(typeof document==='undefined')return null;const el=document.createElement('div');el.className=styles.messageHost;return el;});
 useEffect(()=>{if(!host)return;document.body.appendChild(host);return()=>{host.remove();};},[host]);
 const {reduced}=useReducedEffects(),seenSent=useRef(false),button=useRef<HTMLButtonElement>(null),doneRef=useRef(onDone),seenRef=useRef(onSeen);
 useEffect(()=>{doneRef.current=onDone;seenRef.current=onSeen;});
 useEffect(()=>{if(!seenSent.current&&!preview){seenSent.current=true;seenRef.current?.();}},[preview]);
 // arrival sound once: the built-in fax/letter sound or the GM's own sound; if the browser blocks it, one quiet button
 const playSound=useCallback(()=>{
  if(delivery.arrivalSound){void playArrivalSound(delivery.arrivalSound).then(ok=>setSound(ok?'played':'blocked'));return;}
  const a=audio.current;if(!a)return;a.currentTime=0;a.volume=.7;void a.play().then(()=>setSound('played')).catch(()=>setSound('blocked'));
 },[delivery.arrivalSound]);
 useEffect(()=>{if(soundStarted.current||(!delivery.arrivalSound&&!delivery.audio))return;soundStarted.current=true;playSound();},[delivery.arrivalSound,delivery.audio,playSound]);
 useEffect(()=>{if(phase!=='arrive')return;const t=window.setTimeout(()=>setPhase('read'),reduced?300:delivery.layout==='fax'?3200:1400);return()=>window.clearTimeout(t);},[phase,reduced,delivery.layout]);
 useEffect(()=>{if(phase==='read')button.current?.focus({preventScroll:true});},[phase]);
 useEffect(()=>{if(withdrawn&&phase!=='leave')queueMicrotask(()=>setPhase('leave'));},[withdrawn,phase]);
 useEffect(()=>{if(phase!=='leave')return;const t=window.setTimeout(()=>doneRef.current(),reduced?250:900);return()=>window.clearTimeout(t);},[phase,reduced]);
 const embedded=useMemo(()=>new Set(richTextFileIds(delivery.html)),[delivery.html]);
 const attachments=delivery.images.filter(id=>!embedded.has(id));
 const stamp=new Date(delivery.createdAt);
 const when=Number.isFinite(stamp.getTime())?stamp.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
 if(!host)return null;
 return createPortal(<section className={styles.message} data-layout={delivery.layout} data-phase={phase} data-reduced={reduced||undefined} role="dialog" aria-modal="false" aria-label={preview?'Vorschau einer persönlichen Botschaft':'Persönliche Botschaft'} data-sound={delivery.arrivalSound||(delivery.audio?'own':undefined)} data-sound-state={sound}>
  {delivery.layout==='fax'&&<div className={styles.faxSlot} aria-hidden="true"><span className={styles.led}/><span>EMPFANG</span></div>}
  <article className={styles.sheet}>
   {preview&&<p className={styles.previewBadge}>Vorschau · nichts wird zugestellt</p>}
   {delivery.layout==='fax'?<header className={styles.faxHeader}><div><strong>TELEFAX</strong><span>{when}</span></div><div><span>Kennung {documentNumber(delivery.id)}</span><span>Seite 1/1</span></div><dl><dt>Von</dt><dd>{delivery.sender||'Absender unterdrückt'}</dd><dt>An</dt><dd>{recipientName}</dd></dl></header>
    :<header className={styles.letterHeader}>{delivery.sender&&<span>{delivery.sender}</span>}<span>{when}</span></header>}
   <div className={styles.sheetBody}><RichTextView value={delivery.html} readable flowing fileUrl={id=>delivery.images.includes(id)?assetUrl(id):''}/></div>
   {!!attachments.length&&<div className={styles.attachments} aria-label="Beilagen">{attachments.map(id=><img key={id} src={assetUrl(id)} alt="Beilage" draggable={false}/>)}</div>}
   <footer>{sound==='blocked'&&<button type="button" className={styles.soundButton} onClick={playSound}>Geräusch abspielen</button>}<button ref={button} type="button" className={styles.read} disabled={phase==='leave'} onClick={()=>setPhase('leave')}>{delivery.layout==='fax'?'Gelesen · ablegen':'Gelesen · Brief schließen'}</button></footer>
  </article>
  {delivery.audio&&delivery.audioFileId&&<audio ref={audio} src={assetUrl(delivery.audioFileId)} preload="auto"/>}
 </section>,host);
}
