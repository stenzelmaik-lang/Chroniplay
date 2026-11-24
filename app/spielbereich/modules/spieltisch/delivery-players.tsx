/* eslint-disable @next/next/no-img-element -- Recipient-checked delivery media; never a public image proxy. */
"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {fragmentDuration,presetById,tempoById,documentNumber,type PlayerDelivery} from '@/domain/personal-delivery';
import {visionMoments} from '@/domain/vision-moments';
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

/* ------------------------------------------------------------------ vision */
type Phase='enter'|'play'|'end'|'exit';
const IMAGE_WAIT_MS=6500;
type ImageStatus='ready'|'unavailable';

export function VisionPlayer({delivery,assetUrl,onSeen,onDone,preview=false,withdrawn=false}:{delivery:PlayerDelivery;assetUrl:(fileId:string)=>string;onSeen?:()=>void;onDone:()=>void;preview?:boolean;withdrawn?:boolean}){
 const [host]=useState(()=>{if(typeof document==='undefined')return null;const el=document.createElement('div');el.className=styles.host;return el;});
 const {reduced,own,toggle}=useReducedEffects();
 const preset=presetById(delivery.preset);
 const moments=useMemo(()=>visionMoments(delivery.images,delivery.fragments),[delivery.images,delivery.fragments]);
 const [phase,setPhase]=useState<Phase>('enter'),[index,setIndex]=useState(0),[fullText,setFullText]=useState(false),[sound,setSound]=useState<'off'|'on'|'blocked'>('off'),[skipped,setSkipped]=useState(false);
 const [imageStatus,setImageStatus]=useState<Partial<Record<number,ImageStatus>>>({});
 const [expiredImage,setExpiredImage]=useState<number>();
 const moment=moments[index];
 const hasImage=Boolean(moment?.imageId);
 const unavailable=hasImage&&(imageStatus[index]==='unavailable'||expiredImage===index);
 const waiting=hasImage&&imageStatus[index]!=='ready'&&!unavailable;
 const playing=phase==='play'&&!waiting;
 const narration=moment?.text;
 const root=useRef<HTMLDivElement>(null),audio=useRef<HTMLAudioElement>(null),shownAt=useRef(0),seenSent=useRef(false);
 // Parents re-render on every poll; the latest callbacks are read at call time so timers are never restarted by that.
 const doneRef=useRef(onDone),seenRef=useRef(onSeen);
 useEffect(()=>{doneRef.current=onDone;seenRef.current=onSeen;});
 useEffect(()=>{if(!host)return;document.body.appendChild(host);return()=>{host.remove();};},[host]);
 // the preview pulls the page in exactly like the real vision; only reduced effects switch the pull off
 useIsolate(host,phase!=='exit',!reduced);
  useEffect(()=>{if(!seenSent.current&&!preview){seenSent.current=true;seenRef.current?.();}},[preview]);
 useEffect(()=>{root.current?.focus({preventScroll:true});},[host]);
 // enter -> play
 useEffect(()=>{if(phase!=='enter')return;const t=window.setTimeout(()=>{setPhase('play');shownAt.current=Date.now();},reduced?500:preset.enterMs);return()=>window.clearTimeout(t);},[phase,reduced,preset.enterMs]);
 const inMs=reduced?180:760,outMs=reduced?140:640;
 const imageHold=Math.max(2100,Math.round(3100*tempoById(delivery.tempo).factor));
 const textHold=narration?fragmentDuration(narration,delivery.preset,reduced,delivery.tempo):0;
 const hold=Math.max(textHold,hasImage&&!unavailable?imageHold:0);
 useEffect(()=>{
  if(phase!=='play'||!waiting)return;
  const timeout=window.setTimeout(()=>setExpiredImage(index),IMAGE_WAIT_MS);
  return()=>window.clearTimeout(timeout);
 },[phase,waiting,index]);
 useEffect(()=>{
  if(!playing)return;
  if(!moments.length){const timeout=window.setTimeout(()=>setPhase('end'),0);return()=>window.clearTimeout(timeout);}
  const timeout=window.setTimeout(()=>{
   if(index===moments.length-1)setPhase('end');
   else{setIndex(index+1);shownAt.current=Date.now();}
  },inMs+hold+outMs);
  return()=>window.clearTimeout(timeout);
 },[playing,index,moments.length,inMs,hold,outMs]);
 // a withdrawn vision leaves gracefully
 useEffect(()=>{if(withdrawn&&phase!=='exit')queueMicrotask(()=>setPhase('exit'));},[withdrawn,phase]);
 useEffect(()=>{if(phase!=='exit')return;const a=audio.current;if(a){const v=a.volume;let k=0;const f=window.setInterval(()=>{k++;a.volume=Math.max(0,v*(1-k/10));if(k>=10)window.clearInterval(f);},120);}const t=window.setTimeout(()=>doneRef.current(),reduced?350:1500);return()=>window.clearTimeout(t);},[phase,reduced]);
 // sound: starts with the vision if the browser allows it, otherwise one quiet button
 useEffect(()=>{
  const a=audio.current;if(!a||!delivery.audio)return;
  a.volume=0;const p=a.play();
  if(p)p.then(()=>{setSound('on');let k=0;const f=window.setInterval(()=>{k++;a.volume=Math.min(.6,k*.06);if(k>=10)window.clearInterval(f);},150);}).catch(()=>setSound('blocked'));
 },[delivery.audio]);
 // a short guard only against double clicks; fast readers may skip ahead right away
 const next=()=>{setSkipped(true);if(phase==='enter'){setPhase('play');shownAt.current=Date.now();return;}if(phase!=='play'||Date.now()-shownAt.current<500)return;if(index>=moments.length-1)setPhase('end');else{setIndex(i=>i+1);shownAt.current=Date.now();}};
 const keys=(e:React.KeyboardEvent)=>{
  if(e.key==='Escape'){e.preventDefault();if(delivery.fragments.length)setFullText(value=>!value);return;} // no silent exit: offer the readable full text instead
  if((e.key===' '||e.key==='Enter'||e.key==='ArrowRight')&&e.target===root.current){e.preventDefault();next();}
  if(e.key==='Tab'){const f=[...(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')||[])];if(!f.length)return;const i=f.indexOf(document.activeElement as HTMLElement);if(e.shiftKey&&i<=0){e.preventDefault();f.at(-1)!.focus();}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}}
 };
 const bufferedImages=(phase==='enter'||phase==='play')?moments.slice(index,index+2):[];
 const replay=()=>{
  setIndex(0);setFullText(false);setImageStatus({});setExpiredImage(undefined);setSkipped(false);
  setPhase('enter');root.current?.focus({preventScroll:true});
 };
 if(!host)return null;
 return createPortal(<div ref={root} tabIndex={-1} className={styles.vision} data-preset={preset.id} data-phase={phase} data-reduced={reduced||undefined} role="dialog" aria-modal="true" aria-label={preview?'Vorschau einer Vision':'Eine Vision'} onKeyDown={keys} onClick={e=>{if(e.target===e.currentTarget)next();}} style={{'--enter':`${reduced?500:preset.enterMs}ms`} as CSSProperties}>
  <div className={styles.veil} aria-hidden="true"/>
  <div className={`${styles.fog} ${styles.fogBack}`} aria-hidden="true"/>
  <div className={`${styles.fog} ${styles.fogMid}`} aria-hidden="true"/>
  <div className={styles.light} aria-hidden="true"/>
  {preset.id==='threat'&&!reduced&&<Tentacles/>}
  <div className={styles.motes} aria-hidden="true"/>
  <div className={`${styles.fog} ${styles.fogFront}`} aria-hidden="true"/>
  <div className={styles.grain} aria-hidden="true"/>
  {preview&&<p className={styles.previewBadge}>Vorschau · nichts wird zugestellt</p>}
  <div className={styles.visionStage} data-image={hasImage&&(phase==='enter'||phase==='play')||undefined}>
   <div className={styles.apparitions} aria-hidden="true">
    {bufferedImages.map(({imageId},offset)=>{
     if(!imageId)return null;
     const imageIndex=index+offset;
     const active=offset===0&&playing&&!unavailable;
     return <figure key={`${imageIndex}:${imageId}`} data-active={active||undefined} data-position={imageIndex%3}
       style={{'--in':`${inMs}ms`,'--hold':`${hold}ms`,'--out':`${outMs}ms`} as CSSProperties}>
      <img src={assetUrl(imageId)} alt="" draggable={false} decoding="async"
       onLoad={event=>{
        const image=event.currentTarget;
        void image.decode().then(
         ()=>{if(image.isConnected)setImageStatus(status=>({...status,[imageIndex]:'ready'}));},
         ()=>{if(image.isConnected)setImageStatus(status=>({...status,[imageIndex]:'unavailable'}));},
        );
       }}
       onError={()=>setImageStatus(status=>({...status,[imageIndex]:'unavailable'}))}/>
     </figure>;
    })}
   </div>
   <div className={styles.words} aria-live="polite">
    {fullText
     ?<div className={styles.fullText} tabIndex={0} role="region" aria-label="Vollständiger Visionstext">{delivery.fragments.map((f,i)=><p key={i}>{f}</p>)}</div>
     :(playing||phase==='end'||phase==='exit')&&narration&&<p key={index} className={styles.fragment} data-last={phase==='end'||undefined}
       style={{'--in':`${inMs}ms`,'--hold':`${hold}ms`,'--out':`${outMs}ms`} as CSSProperties}>{narration}</p>}
   </div>
  </div>
  {phase==='end'&&<div className={styles.closing}><button type="button" autoFocus className={styles.seen} onClick={()=>setPhase('exit')}>Ich habe alles gesehen</button><button type="button" className={styles.quiet} onClick={replay}>Noch einmal</button></div>}
  <div className={styles.tools}>
   {phase==='play'&&<button type="button" className={`${styles.quiet} ${styles.next}`} data-hint={!skipped&&index===0||undefined} aria-keyshortcuts="Space ArrowRight" onClick={next}>Weiter ›</button>}
   {(phase==='enter'||phase==='play')&&<button type="button" className={styles.quiet} onClick={()=>setPhase('end')}>Vision überspringen</button>}
   {delivery.fragments.length>0&&phase!=='exit'&&<button type="button" className={styles.quiet} aria-pressed={fullText} onClick={()=>setFullText(value=>!value)}>{fullText?'Zur laufenden Vision':'Text vollständig anzeigen'}</button>}
   <button type="button" className={styles.quiet} aria-pressed={own} onClick={toggle}>{own?'Effekte wieder voll':'Effekte ruhiger'}</button>
   {delivery.audio&&sound==='blocked'&&<button type="button" className={styles.quiet} onClick={()=>{const a=audio.current;if(!a)return;a.volume=.6;void a.play().then(()=>setSound('on')).catch(()=>setSound('blocked'));}}>Ton einschalten</button>}
   {delivery.audio&&sound==='on'&&<button type="button" className={styles.quiet} onClick={()=>{audio.current?.pause();setSound('off');}}>Ton aus</button>}
  </div>
  {delivery.audio&&delivery.audioFileId&&<audio ref={audio} src={assetUrl(delivery.audioFileId)} loop preload="auto"/>}
 </div>,host);
}

/** Organic shadow tendrils for the threatening vision. Slow, bounded, behind the text, never in the reading column. */
function Tentacles(){
 const paths=['M-40 900 C 120 760, 60 560, 230 470 S 330 300, 260 160','M1480 860 C 1320 740, 1380 560, 1220 500 S 1110 330, 1190 190','M-60 120 C 120 180, 180 300, 320 290 S 470 200, 520 90','M1500 140 C 1330 210, 1270 330, 1130 320 S 980 230, 930 120','M700 1000 C 690 900, 760 860, 720 780 S 640 700, 690 640'];
 return <svg className={styles.tentacles} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{paths.map((d,i)=><path key={i} d={d} style={{'--i':i} as CSSProperties}/>)}</svg>;
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
