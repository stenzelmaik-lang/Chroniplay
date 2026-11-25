/* eslint-disable @next/next/no-img-element -- GM-only previews from the protected file store. */
"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUp,ArrowDown,Play,Pause,Clapperboard} from 'lucide-react';
import type {SceneWhisper} from '@/domain/story-scene';
import {VISION_SIZES,VISION_PLACES,VISION_INTENSITIES,SHOT_DEFAULTS,AUTO_PLACES,shotOf,directionFragments,visionPlan,type VisionDirection,type VisionShot} from '@/domain/vision-direction';
import type {PreparationFile} from './protected-image-gallery';
import {previewDelivery} from './spieltisch/delivery-stage';
import {engineVision} from './vision-engine/engine-vision';
import engineStyles from './vision-engine/vision-engine.module.css';
import styles from './vision-direction-editor.module.css';

const SIZE_LABEL:Record<string,string>={nah:'Nah',mittel:'Mittel',weit:'Weit'};
const PLACE_LABEL:Record<string,string>={links:'Links',mitte:'Mitte',rechts:'Rechts'};
const INTENSITY_LABEL:Record<string,string>={soft:'Sanft',normal:'Normal',strong:'Intensiv'};
const fileUrl=(id:string)=>'/api/files?id='+encodeURIComponent(id);
const thumbUrl=(id:string)=>'/api/files?id='+encodeURIComponent(id)+'&size=thumb';

/** Regie einer Vision: Ablauf, Live-Bühne, Einstellungen je Bild. Nur die Bilder dieser Vision erscheinen hier. */
export function VisionDirectionEditor({current,files,update}:{current:SceneWhisper;files:PreparationFile[];update:(patch:Partial<SceneWhisper>)=>void}){
 const d:VisionDirection=current.direction||{v:1};
 const ids=current.fileIds;
 const [sel,setSel]=useState(0);
 const index=Math.min(sel,Math.max(0,ids.length-1));
 const selId=ids[index];
 const name=(id:string)=>files.find(f=>f.id===id)?.name||'Bild nicht verfügbar';
 const commit=(next:VisionDirection,fileIds:string[]=ids)=>update({direction:next,fileIds,fragments:directionFragments(next,fileIds)});
 const shot=(id:string):VisionShot=>shotOf(d,id)||{fileId:id};
 const setShot=(id:string,patch:Partial<VisionShot>)=>{
  const others=(d.shots||[]).filter(s=>s.fileId!==id&&ids.includes(s.fileId));
  const shots=[...others,{...shot(id),...patch}].sort((a,b)=>ids.indexOf(a.fileId)-ids.indexOf(b.fileId));
  commit({...d,shots});
 };
 const move=(i:number,step:number)=>{const j=i+step;if(j<0||j>=ids.length)return;const next=[...ids];[next[i],next[j]]=[next[j],next[i]];commit(d,next);if(sel===i)setSel(j);};
 const removeImage=(id:string)=>{commit({...d,shots:(d.shots||[]).filter(s=>s.fileId!==id)},ids.filter(x=>x!==id));setSel(Math.max(0,index-1));};
 const s=selId?shot(selId):null;
 return <section className={styles.direction} aria-label="Regie der Vision">
  <header><Clapperboard size={18}/><h4>Regie</h4><p>Bild und Text gehören je Moment zusammen. Bilder bleiben unbewegt; Nebel, Licht und Übergänge erzeugen die Bewegung.</p></header>
  <div className={styles.layout}>
   <div className={styles.flow}>
    <label>Eintauchen <small>erste Worte im Nebel, bevor ein Bild erscheint</small><textarea maxLength={600} rows={2} value={d.intro||''} onChange={e=>commit({...d,intro:e.target.value})}/></label>
    <ol className={styles.shots} aria-label="Ablauf der Bilder">
     {ids.map((id,i)=><li key={id} data-selected={i===index||undefined}>
      <button type="button" className={styles.pick} aria-pressed={i===index} onClick={()=>setSel(i)}>
       <img src={thumbUrl(id)} alt="" loading="lazy"/><span><strong>{i+1}. {name(id)}</strong><small>{(shot(id).text||'').trim()||'nur Bild'}{shot(id).echo?' · Nachhall: '+shot(id).echo:''}</small></span>
      </button>
      <span className={styles.moves}><button type="button" aria-label={'Bild '+(i+1)+' nach oben'} disabled={i===0} onClick={()=>move(i,-1)}><ArrowUp size={14}/></button><button type="button" aria-label={'Bild '+(i+1)+' nach unten'} disabled={i===ids.length-1} onClick={()=>move(i,1)}><ArrowDown size={14}/></button></span>
     </li>)}
    </ol>
    {!ids.length&&<p className={styles.hint}>Noch keine Bilder in dieser Vision. Lade unten Bilder hoch oder übernimm sie aus der Galerie.</p>}
    <label>Schlusssatz <small>bleibt stehen, bis der Spieler bestätigt</small><textarea maxLength={600} rows={2} value={d.finale||''} onChange={e=>commit({...d,finale:e.target.value})}/></label>
    <fieldset className={styles.seg}><legend>Intensität</legend>{VISION_INTENSITIES.map(v=><label key={v}><input type="radio" name={'intensity-'+current.id} checked={(d.intensity||'normal')===v} onChange={()=>commit({...d,intensity:v})}/><span>{INTENSITY_LABEL[v]}</span></label>)}</fieldset>
    <label>Farbfilter <small>{d.filter==null?'Standard des Visionstyps':Math.round(d.filter*100)+' %'}</small>
     <span className={styles.row}><input type="range" min={0} max={1} step={0.05} value={d.filter??0.45} onChange={e=>commit({...d,filter:Number(e.target.value)})}/>{d.filter!=null&&<button type="button" className={styles.link} onClick={()=>{const next={...d};delete next.filter;commit(next);}}>Standard</button>}</span>
    </label>
   </div>
   <div className={styles.side}>
    <LiveStage whisper={current} selected={index}/>
    {s&&selId&&<div className={styles.inspector} aria-label={'Einstellungen für Bild '+(index+1)}>
     <FocusPicker id={selId} focus={s.focus||SHOT_DEFAULTS.focus} core={s.core??SHOT_DEFAULTS.core} onFocus={focus=>setShot(selId,{focus})}/>
     <label>Kernbereich <small>bleibt immer klar sichtbar und nebelfrei</small><input type="range" min={0.15} max={0.6} step={0.01} value={s.core??SHOT_DEFAULTS.core} onChange={e=>setShot(selId,{core:Number(e.target.value)})}/></label>
     <fieldset className={styles.seg}><legend>Größe</legend>{VISION_SIZES.map(v=><label key={v}><input type="radio" name={'size-'+selId} checked={(s.size||SHOT_DEFAULTS.size)===v} onChange={()=>setShot(selId,{size:v})}/><span>{SIZE_LABEL[v]}</span></label>)}</fieldset>
     <fieldset className={styles.seg}><legend>Platz</legend>{VISION_PLACES.map(v=><label key={v}><input type="radio" name={'place-'+selId} checked={(s.place||AUTO_PLACES[index%AUTO_PLACES.length])===v} onChange={()=>setShot(selId,{place:v})}/><span>{PLACE_LABEL[v]}</span></label>)}</fieldset>
     <label>Text zu diesem Bild<textarea maxLength={600} rows={3} value={s.text||''} onChange={e=>setShot(selId,{text:e.target.value})}/></label>
     <label>Nachhall <small>ein Wort, das stehen bleibt, wenn der Rest verblasst</small><input maxLength={60} value={s.echo||''} onChange={e=>setShot(selId,{echo:e.target.value})}/></label>
     <label>Mindesthaltezeit <small>{s.holdMs?(s.holdMs/1000).toLocaleString('de-DE')+' s':'automatisch nach Lesezeit'}</small><input type="range" min={0} max={12000} step={500} value={s.holdMs||0} onChange={e=>setShot(selId,{holdMs:Number(e.target.value)})}/></label>
     <button type="button" className={styles.link} onClick={()=>removeImage(selId)}>Bild aus dieser Vision nehmen</button>
    </div>}
   </div>
  </div>
 </section>;
}

/** Brennpunkt per Klick oder Pfeiltasten; der Kreis zeigt den geschützten Kernbereich. */
function FocusPicker({id,focus,core,onFocus}:{id:string;focus:{x:number;y:number};core:number;onFocus:(f:{x:number;y:number})=>void}){
 const box=useRef<HTMLDivElement>(null);
 const [h,setH]=useState(0);
 const clamp=(v:number)=>Math.round(Math.min(1,Math.max(0,v))*1000)/1000;
 const from=(e:React.PointerEvent)=>{const r=box.current?.getBoundingClientRect();if(!r)return;onFocus({x:clamp((e.clientX-r.left)/r.width),y:clamp((e.clientY-r.top)/r.height)});};
 return <div className={styles.focusWrap}><span className={styles.label}>Wichtigster Bildbereich</span>
  <div ref={box} className={styles.focus} tabIndex={0} role="group" aria-label="Brennpunkt setzen: klicken oder mit den Pfeiltasten verschieben"
   onPointerDown={e=>{(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);from(e);}} onPointerMove={e=>{if((e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId))from(e);}}
   onKeyDown={e=>{const st=e.shiftKey?0.05:0.01;const m:Record<string,[number,number]>={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,-st],ArrowDown:[0,st]};const v=m[e.key];if(v){e.preventDefault();onFocus({x:clamp(focus.x+v[0]),y:clamp(focus.y+v[1])});}}}>
   <img src={fileUrl(id)} alt="" draggable={false} onLoad={e=>setH(e.currentTarget.clientHeight)}/>
   <span className={styles.core} style={{left:focus.x*100+'%',top:focus.y*100+'%',width:core*2*h,height:core*2*h}}/>
   <span className={styles.dot} style={{left:focus.x*100+'%',top:focus.y*100+'%'}}/>
  </div>
 </div>;
}

type EngineHandle={vision:unknown;tl:unknown;playing:boolean;ensureImages:(v:unknown)=>Promise<string[]>;rebuild:()=>void;seekMoment:(i:number)=>void;play:()=>void;pause:()=>void;setMuted:(m:boolean)=>void;load:(v:unknown)=>Promise<unknown>;destroy:()=>void};

/** Live-Bühne im Editor: dieselbe Engine wie beim Spieler, stumm, ohne Zustellung. Zeigt das gewählte Bild im Haltezustand. */
function LiveStage({whisper,selected}:{whisper:SceneWhisper;selected:number}){
 const box=useRef<HTMLDivElement>(null);
 const eng=useRef<EngineHandle|null>(null);
 const [playing,setPlaying]=useState(false);
 const vision=useMemo(()=>{const d=previewDelivery(whisper);return engineVision(visionPlan({preset:d.preset,tempo:d.tempo,images:d.images,fragments:d.fragments,audioFileId:null,direction:d.direction}),fileUrl);},[whisper]);
 const latest=useRef({vision,selected});
 useEffect(()=>{latest.current={vision,selected};});
 useEffect(()=>{
  const el=box.current;if(!el)return;
  let alive=true;
  void import('./vision-engine/player.js').then(({VisionPlayer:Engine})=>{
   if(!alive)return;
   const e=new Engine(el,{mode:'embedded',onState:(st:{playing:boolean;ended:boolean})=>setPlaying(st.playing&&!st.ended)}) as unknown as EngineHandle;
   eng.current=e;e.setMuted(true);
   void e.load(latest.current.vision).then(()=>{if(alive)e.seekMoment(latest.current.selected);});
  });
  return()=>{alive=false;eng.current?.destroy();eng.current=null;};
 },[]);
 useEffect(()=>{
  const e=eng.current;if(!e||!e.tl)return;
  const t=window.setTimeout(()=>{void (async()=>{e.vision=vision;await e.ensureImages(vision);e.rebuild();if(!e.playing)e.seekMoment(latest.current.selected);})();},220);
  return()=>window.clearTimeout(t);
 },[vision]);
 useEffect(()=>{const e=eng.current;if(e?.tl&&!e.playing)e.seekMoment(selected);},[selected]);
 return <div className={styles.live}>
  <div className={styles.frame}><div ref={box} className={engineStyles.root} aria-label="Live-Vorschau der Vision" role="img"/></div>
  <div className={styles.bar}><button type="button" onClick={()=>{const e=eng.current;if(!e)return;if(e.playing)e.pause();else{e.seekMoment(selected);e.play();}}}>{playing?<Pause size={14}/>:<Play size={14}/>} {playing?'Anhalten':'Ab diesem Bild abspielen'}</button><small>Live-Vorschau, stumm · nichts wird zugestellt</small></div>
 </div>;
}
