/* eslint-disable @next/next/no-img-element -- GM-only previews from the protected file store. */
"use client";
import {useEffect,useMemo,useRef,useState,type MutableRefObject} from 'react';
import {ArrowUp,ArrowDown,Play,Pause,RotateCcw,SkipForward,Eye,Clapperboard,GripVertical} from 'lucide-react';
import type {SceneWhisper} from '@/domain/story-scene';
import {VISION_TEMPOS,tempoById,presetById,mediaSectionOf,mediaSectionLabel} from '@/domain/personal-delivery';
import {VISION_SIZES,VISION_PLACES,VISION_INTENSITIES,SHOT_DEFAULTS,AUTO_PLACES,shotOf,directionFragments,visionPlan,type VisionDirection,type VisionShot} from '@/domain/vision-direction';
import type {PreparationFile} from './protected-image-gallery';
import type {LatestPatch} from './prepared-whispers';
import {PreparationUpload} from './preparation-upload';
import {DeliveryPreview,previewDelivery} from './spieltisch/delivery-stage';
import {engineVision} from './vision-engine/engine-vision';
import {VISION_TYPES,typeById} from './vision-engine/presets.js';
import {buildTimeline,readingMs,echoIndices,FLASH_MIN_GAP_MS} from './vision-engine/timeline.js';
import engineStyles from './vision-engine/vision-engine.module.css';
import styles from './vision-workbench.module.css';

const FORMATS={desktop:{w:1440,h:810,label:'Desktop'},tablet:{w:1024,h:768,label:'Tablet'},handy:{w:390,h:844,label:'Handy'}} as const;
type FormatId=keyof typeof FORMATS;
const SIZE_LABEL:Record<string,string>={nah:'Nah',mittel:'Mittel',weit:'Weit'};
const PLACE_LABEL:Record<string,string>={links:'Links',mitte:'Mitte',rechts:'Rechts'};
const INTENSITY_LABEL:Record<string,string>={soft:'Sanft',normal:'Normal',strong:'Intensiv'};
const fileUrl=(id:string)=>'/api/files?id='+encodeURIComponent(id);
const thumbUrl=(id:string)=>'/api/files?id='+encodeURIComponent(id)+'&size=thumb';
const clock=(ms:number)=>{const s=Math.max(0,Math.round(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const secs=(ms:number)=>`${(ms/1000).toLocaleString('de-DE',{maximumFractionDigits:1})} s`;
const two=(n:number)=>String(n).padStart(2,'0');
type Sel=number|'intro'|'finale';
type Check=['ok'|'warn'|'info',string];
type EngineTimeline={duration:number;textEnter:number;texts:{key:string;inAt:number}[];moments:{index:number;emergeStart:number;dissolveEnd:number;hold:number;flashAt:number|null}[]};
type Engine={tl:EngineTimeline|null;t:number;playing:boolean;vision:unknown;load:(v:unknown)=>Promise<unknown>;ensureImages:(v:unknown)=>Promise<string[]>;rebuild:()=>void;seek:(t:number)=>void;seekMoment:(i:number)=>void;renderAt:(t:number)=>void;play:()=>void;pause:()=>void;toggle:()=>void;next:()=>void;setOwnReduced:(v:boolean)=>void;setMuted:(m:boolean)=>void;setDisplayScale:(k:number)=>void;measureContrast:()=>{key:string;contrastP95:number;contrastMean:number}[];destroy:()=>void};

/** Die Vision so, wie Spieler sie bekommen: derselbe Ablauf wie im Player. */
const visionFor=(w:SceneWhisper)=>{const d=previewDelivery(w);return engineVision(visionPlan({preset:d.preset,tempo:d.tempo,images:d.images,fragments:d.fragments,audioFileId:null,direction:d.direction}),fileUrl);};
function seekSel(e:Engine,sel:Sel){
 if(!e.tl)return;
 if(typeof sel==='number'){e.seekMoment(sel);return;}
 const x=e.tl.texts.find(t=>t.key===(sel==='intro'?'intro':'final'));
 e.seek(x?x.inAt+e.tl.textEnter+(sel==='intro'?300:600):sel==='intro'?400:e.tl.duration);
}

/**
 * Regie-Werkbank einer Vision (Schritt 6): links der Ablauf mit Eintauchen, Bildmomenten und Abschluss,
 * in der Mitte die Live-Bühne im echten Format mit Zeitleiste, rechts Visionstyp, Wirkung, Moment, Ton und Prüfung.
 * Nur die Bilder dieser Vision stehen im Ablauf; alle anderen bleiben in der Galerie.
 */
export function VisionWorkbench({current,files,update,onUpload}:{current:SceneWhisper;files:PreparationFile[];update:(patch:Partial<SceneWhisper>)=>void;onUpload:LatestPatch}){
 const d:VisionDirection=useMemo(()=>current.direction||{v:1},[current.direction]);
 const ids=current.fileIds;
 const [sel,setSel]=useState<Sel>(ids.length?0:'intro');
 const [live,setLive]=useState(-1);
 const [preview,setPreview]=useState(false);
 const [confirmRemove,setConfirmRemove]=useState(false);
 const [contrast,setContrast]=useState<Check[]>([]);
 const [measuring,setMeasuring]=useState(false);
 const [drag,setDrag]=useState<number|null>(null);
 const engine=useRef<Engine|null>(null);
 const section=mediaSectionOf('vision');
 const type=typeById(presetById(current.preset).id);
 const tempo=tempoById(current.tempo);
 const vision=useMemo(()=>visionFor(current),[current]);
 const tl=useMemo(()=>buildTimeline(vision) as unknown as EngineTimeline,[vision]);
 const index=typeof sel==='number'&&ids.length?Math.min(sel,ids.length-1):-1;
 const selId=index>=0?ids[index]:undefined;
 const name=(id:string)=>files.find(f=>f.id===id)?.name||'Bild nicht verfügbar';
 const commit=(next:VisionDirection,fileIds:string[]=ids)=>update({direction:next,fileIds,fragments:directionFragments(next,fileIds)});
 const shot=(id:string):VisionShot=>shotOf(d,id)||{fileId:id};
 const setShot=(id:string,patch:Partial<VisionShot>)=>{
  const others=(d.shots||[]).filter(s=>s.fileId!==id&&ids.includes(s.fileId));
  commit({...d,shots:[...others,{...shot(id),...patch}].sort((a,b)=>ids.indexOf(a.fileId)-ids.indexOf(b.fileId))});
 };
 const select=(s:Sel)=>{setSel(s);setConfirmRemove(false);const e=engine.current;if(e?.tl){e.pause();seekSel(e,s);}};
 const reorder=(from:number,to:number)=>{if(from===to||to<0||to>=ids.length)return;const next=[...ids];const [m]=next.splice(from,1);next.splice(to,0,m);commit(d,next);setSel(to);};
 const removeImage=(id:string)=>{commit({...d,shots:(d.shots||[]).filter(s=>s.fileId!==id)},ids.filter(x=>x!==id));setSel(ids.length>1?Math.max(0,index-1):'intro');setConfirmRemove(false);};
 const addImage=(id:string)=>{if(ids.includes(id)||ids.length>=20)return;commit(d,[...ids,id]);setSel(ids.length);};
 const gallery=files.filter(f=>f.section===section&&f.mime.startsWith('image/')&&!ids.includes(f.id));
 const sounds=files.filter(f=>f.mime.startsWith('audio/')&&(f.section===section||f.id===current.audioFileId));
 const checks=useMemo(()=>{
  const out:Check[]=[];
  if(!ids.length)out.push(['warn','Noch kein Bild. Eine Vision ohne Bild bleibt reine Schrift im Nebel.']);
  out.push(tl.duration>150000?['warn',`Gesamtdauer ${clock(tl.duration)}. Lange Visionen verlieren Spannung; „Weiter“ steht Spielern immer offen.`]:['ok',`Gesamtdauer ${clock(tl.duration)} bei Tempo „${tempo.label}“.`]);
  ids.forEach((id,i)=>{
   const s=shotOf(d,id),n=two(i+1);
   if(!files.some(f=>f.id===id))out.push(['warn',`Bild ${n}: Datei nicht verfügbar.`]);
   if((s?.text||'').length>220)out.push(['warn',`Bild ${n}: langer Text (${s?.text?.length} Zeichen). Lieber kürzen oder auf zwei Bilder verteilen.`]);
   if(s?.echo&&s.text&&!echoIndices(s.text,s.echo).length)out.push(['info',`Bild ${n}: Nachhall „${s.echo}“ steht nicht im Satz und erscheint als eigenes Wort.`]);
  });
  const flashes=tl.moments.filter(m=>m.flashAt!==null).map(m=>m.flashAt as number);
  if(type.flashes){const gaps=flashes.slice(1).map((f,k)=>f-flashes[k]);out.push(['ok',`Lichtimpulse: ${flashes.length}, Abstand mindestens ${gaps.length?secs(Math.min(...gaps)):'–'} (Grenze ${secs(FLASH_MIN_GAP_MS)}), kein Stroboskop. Im Ruhemodus keine.`]);}
  else out.push(['ok','Keine Lichtimpulse in diesem Visionstyp.']);
  out.push(['ok','Standbilder bleiben unbewegt. Bewegung entsteht nur durch Nebel, Licht, Partikel und Übergänge.']);
  return out;
 },[tl,ids,d,files,type,tempo]);
 async function measure(){
  const e=engine.current;if(!e?.tl||measuring)return;
  setMeasuring(true);
  const wasPlaying=e.playing,t0=e.t,results:{key:string;contrastP95:number;contrastMean:number}[]=[];
  e.pause();
  for(const x of e.tl.texts){e.renderAt(x.inAt+e.tl.textEnter+450);for(const r of e.measureContrast())if(r.key===x.key)results.push(r);await new Promise(r=>window.setTimeout(r,0));}
  e.seek(t0);if(wasPlaying)e.play();
  const worst=results.reduce<typeof results[number]|null>((a,r)=>a&&a.contrastP95<r.contrastP95?a:r,null);
  const out:Check[]=[];
  if(!worst)out.push(['warn','Lesbarkeit: keine Texte gemessen.']);
  else{
   const fails=results.filter(r=>r.contrastP95<4.5);
   out.push([fails.length?'warn':'ok',`Lesbarkeit (${results.length} Texte): schwächster Kontrast ${worst.contrastP95}:1 gegen die hellsten 5 % des Hintergrunds, im Mittel ${worst.contrastMean}:1. Ziel nach WCAG AA: 4,5:1.`]);
   for(const f of fails)out.push(['warn',`„${f.key}“ unter 4,5:1 (${f.contrastP95}:1). Platz oder Brennpunkt ändern.`]);
  }
  setContrast(out);setMeasuring(false);
 }
 const s=selId?shot(selId):null;
 const textOf=(t:string)=>`${t.length} Zeichen · Lesezeit ${secs(readingMs(t,type,tempo.factor))}`;
 return <section className={styles.bench} aria-label="Regie-Werkbank der Vision">
  <div className={styles.head}>
   <Clapperboard size={20} aria-hidden="true"/>
   <div><h4>Regie-Werkbank</h4><p>Bild und Text gehören je Moment zusammen. Bilder bleiben unbewegt; Nebel, Licht und Übergänge erzeugen die Bewegung.</p></div>
   <span className={styles.meta}>{ids.length} {ids.length===1?'Bild':'Bilder'} · {clock(tl.duration)}</span>
   <button type="button" className={styles.primary} onClick={()=>{engine.current?.pause();setPreview(true);}}><Eye size={16}/> Als Spieler ansehen</button>
  </div>
  <div className={styles.grid}>
   <div className={styles.board}>
    <h5>Ablauf</h5>
    <ol className={styles.flow} aria-label="Ablauf der Vision">
     <li className={styles.fixed} data-selected={sel==='intro'||undefined}><button type="button" className={styles.pick} aria-pressed={sel==='intro'} onClick={()=>select('intro')}><span className={styles.no}>01</span><span className={styles.txt}><strong>Eintauchen</strong><small>{(d.intro||'').trim()||'ohne Worte'}</small></span></button></li>
     {ids.map((id,i)=>{const sh=shot(id),m=tl.moments.find(x=>x.index===i);return <li key={id} draggable onDragStart={e=>{setDrag(i);e.dataTransfer.effectAllowed='move';}} onDragEnd={()=>setDrag(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag!==null)reorder(drag,i);setDrag(null);}} data-selected={index===i&&typeof sel==='number'||undefined} data-live={live===i||undefined} data-drag={drag===i||undefined}>
      <span className={styles.grip} aria-hidden="true"><GripVertical size={14}/></span>
      <button type="button" className={styles.pick} aria-pressed={index===i&&typeof sel==='number'} onClick={()=>select(i)}>
       <img src={thumbUrl(id)} alt="" loading="lazy"/>
       <span className={styles.txt}><strong>{two(i+2)} · {name(id)}</strong><small>{(sh.text||'').trim()||'nur Bild'}</small>
        <span className={styles.chips}>{sh.echo&&<span className={styles.chip}>Nachhall: {sh.echo}</span>}<span className={styles.chipMuted}>{PLACE_LABEL[sh.place||AUTO_PLACES[i%AUTO_PLACES.length]]} · {SIZE_LABEL[sh.size||SHOT_DEFAULTS.size]}</span>{m&&<span className={styles.chipMuted}>{secs(m.dissolveEnd-m.emergeStart)}</span>}</span>
       </span>
      </button>
      <span className={styles.moves}><button type="button" aria-label={'Bild '+(i+1)+' nach oben'} disabled={i===0} onClick={()=>reorder(i,i-1)}><ArrowUp size={14}/></button><button type="button" aria-label={'Bild '+(i+1)+' nach unten'} disabled={i===ids.length-1} onClick={()=>reorder(i,i+1)}><ArrowDown size={14}/></button></span>
     </li>;})}
     <li className={styles.fixed} data-selected={sel==='finale'||undefined}><button type="button" className={styles.pick} aria-pressed={sel==='finale'} onClick={()=>select('finale')}><span className={styles.no}>{two(ids.length+2)}</span><span className={styles.txt}><strong>Abschluss</strong><small>{(d.finale||'').trim()||'ohne Schlusssatz'}</small></span></button></li>
    </ol>
    <section className={styles.library} aria-label={'Bilder aus der Galerie '+mediaSectionLabel[section]}>
     <h5>Bilder dieser Vision</h5>
     <p className={styles.hint}>Nur Bilder im Ablauf erscheinen. Neue Bilder landen am Ende des Ablaufs.</p>
     <PreparationUpload kind="image" section={section} label="Bild hochladen" onUploaded={f=>onUpload(f,w=>w.fileIds.includes(f.id)||w.fileIds.length>=20?{}:{fileIds:[...w.fileIds,f.id]})}/>
     <details className={styles.gallery}><summary>Galerie „{mediaSectionLabel[section]}“ · weitere Bilder ({gallery.length})</summary>
      <p className={styles.hint}>Bilder anderer Einträge bleiben hier. Sie erscheinen erst nach „Bild verwenden“ in dieser Vision.</p>
      {gallery.length?<ul className={styles.lib}>{gallery.map(f=><li key={f.id}><button type="button" disabled={ids.length>=20} aria-label={'Bild verwenden: '+f.name} onClick={()=>addImage(f.id)}><img src={thumbUrl(f.id)} alt="" loading="lazy"/><span>+ {f.name}</span></button></li>)}</ul>:<p className={styles.hint}>Keine weiteren Bilder in der Galerie.</p>}
     </details>
    </section>
   </div>
   <div className={styles.center}><WorkbenchStage vision={vision} sel={sel} engineRef={engine} onLive={setLive}/></div>
   <aside className={styles.inspector} aria-label="Einstellungen der Vision">
    <section className={styles.panel} aria-label="Visionstyp">
     <h5>Visionstyp</h5>
     <div className={styles.types} role="radiogroup" aria-label="Visionstyp">{VISION_TYPES.map(t=><button key={t.id} type="button" role="radio" aria-checked={t.id===type.id} className={styles.type} onClick={()=>update({preset:t.id as SceneWhisper['preset']})}><span className={styles.swatch} style={{background:t.swatch}}/><span><strong>{t.label}</strong><small>{t.mood}</small></span></button>)}</div>
     <p className={styles.lang}>{type.language}</p>
    </section>
    <section className={styles.panel} aria-label="Wirkung">
     <h5>Wirkung</h5>
     <fieldset className={styles.seg}><legend>Tempo der Texte</legend>{VISION_TEMPOS.map(t=><label key={t.id}><input type="radio" name={'wb-tempo-'+current.id} checked={tempo.id===t.id} onChange={()=>update({tempo:t.id})}/><span>{t.label}</span></label>)}</fieldset>
     <fieldset className={styles.seg}><legend>Intensität</legend>{VISION_INTENSITIES.map(v=><label key={v}><input type="radio" name={'wb-intensity-'+current.id} checked={(d.intensity||'normal')===v} onChange={()=>commit({...d,intensity:v})}/><span>{INTENSITY_LABEL[v]}</span></label>)}</fieldset>
     <label className={styles.field}>Farbfilter <small>{d.filter==null?`${Math.round(type.image.filter*100)} % (Standard des Typs)`:`${Math.round(d.filter*100)} %`}</small>
      <span className={styles.row}><input type="range" min={0} max={1} step={0.05} value={d.filter??type.image.filter} onChange={e=>commit({...d,filter:Number(e.target.value)})}/>{d.filter!=null&&<button type="button" className={styles.link} onClick={()=>{const next={...d};delete next.filter;commit(next);}}>Standard</button>}</span>
     </label>
     <p className={styles.hint}>Intensität verändert Nebel, Licht, Partikel und Doppelkonturen. Das Bild selbst bleibt unbewegt, sein Kern immer klar.</p>
    </section>
    <section className={styles.panel} aria-label="Gewählter Moment">
     {sel==='intro'||sel==='finale'||!s||!selId
      ?<>
       <h5>{sel==='finale'?'Abschluss':'01 · Eintauchen'}</h5>
       <p className={styles.hint}>{sel==='finale'?'Das letzte Bild löst sich auf. Dieser Satz bleibt stehen, bis der Spieler bestätigt.':'Dunkelheit, aufziehender Nebel und die ersten Worte, noch bevor ein Bild erscheint.'}</p>
       <label className={styles.field}>Text<textarea maxLength={600} rows={3} value={(sel==='finale'?d.finale:d.intro)||''} onChange={e=>commit(sel==='finale'?{...d,finale:e.target.value}:{...d,intro:e.target.value})}/></label>
       <small className={styles.count}>{textOf(((sel==='finale'?d.finale:d.intro)||'').trim())}</small>
      </>
      :<>
       <h5>Moment {two(index+2)} · {name(selId)}</h5>
       <FocusPicker id={selId} focus={s.focus||SHOT_DEFAULTS.focus} core={s.core??SHOT_DEFAULTS.core} onFocus={focus=>setShot(selId,{focus})}/>
       <label className={styles.field}>Kernbereich <small>bleibt immer klar sichtbar und nebelfrei</small><input type="range" min={0.15} max={0.6} step={0.01} value={s.core??SHOT_DEFAULTS.core} onChange={e=>setShot(selId,{core:Number(e.target.value)})}/></label>
       <fieldset className={styles.seg}><legend>Größe</legend>{VISION_SIZES.map(v=><label key={v}><input type="radio" name={'wb-size-'+selId} checked={(s.size||SHOT_DEFAULTS.size)===v} onChange={()=>setShot(selId,{size:v})}/><span>{SIZE_LABEL[v]}</span></label>)}</fieldset>
       <fieldset className={styles.seg}><legend>Platz auf der Bühne</legend>{VISION_PLACES.map(v=><label key={v}><input type="radio" name={'wb-place-'+selId} checked={(s.place||AUTO_PLACES[index%AUTO_PLACES.length])===v} onChange={()=>setShot(selId,{place:v})}/><span>{PLACE_LABEL[v]}</span></label>)}</fieldset>
       <p className={styles.hint}>Die Worte stehen gegenüber dem Bild. Auf Handys steht das Bild oben, die Worte darunter.</p>
       <label className={styles.field}>Text zu diesem Bild<textarea maxLength={600} rows={3} value={s.text||''} onChange={e=>setShot(selId,{text:e.target.value})}/></label>
       <small className={styles.count}>{textOf((s.text||'').trim())}{tl.moments.find(m=>m.index===index)?` · Bild sichtbar ${secs(tl.moments.find(m=>m.index===index)!.hold)}`:''}</small>
       <label className={styles.field}>Nachhall <small>bleibt stehen, wenn der Rest verblasst</small><input maxLength={60} value={s.echo||''} placeholder="z. B. ein Wort aus dem Text" onChange={e=>setShot(selId,{echo:e.target.value})}/></label>
       <small className={styles.count}>{!(s.echo||'').trim()?'Ohne Nachhall verblasst der ganze Satz.':echoIndices(s.text||'',s.echo||'').length?'Steht im Satz: bleibt an seiner Stelle zurück.':'Nicht im Satz: erscheint als eigenes Wort nach dem Bild.'}</small>
       <label className={styles.field}>Mindesthaltezeit <small>{s.holdMs?secs(s.holdMs):'automatisch nach Lesezeit'}</small><input type="range" min={0} max={12000} step={500} value={s.holdMs||0} onChange={e=>setShot(selId,{holdMs:Number(e.target.value)})}/></label>
       {confirmRemove
        ?<div className={styles.confirm} role="group" aria-label="Bild aus der Vision nehmen bestätigen"><span>Dieses Bild aus der Vision nehmen? Es bleibt in der Galerie.</span><button type="button" onClick={()=>removeImage(selId)}>Herausnehmen</button><button type="button" onClick={()=>setConfirmRemove(false)}>Behalten</button></div>
        :<button type="button" className={styles.linkDanger} onClick={()=>setConfirmRemove(true)}>Bild aus dieser Vision nehmen</button>}
      </>}
    </section>
    <section className={styles.panel} aria-label="Ton">
     <h5>Ton</h5>
     <label className={styles.field}>Atmosphäre oder Musik<select value={current.audioFileId||''} onChange={e=>update({audioFileId:e.target.value||undefined})}><option value="">Kein Ton</option>{sounds.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
     <PreparationUpload kind="audio" section={section} label="Eigenen Ton hochladen" onUploaded={f=>onUpload(f,()=>({audioFileId:f.id}))}/>
     <p className={styles.hint}>Anschwellen, Lichtschlag, Flirren und Knistern erzeugt die Engine selbst, passend zum Visionstyp und genau zum Bild.</p>
    </section>
    <section className={styles.panel} aria-label="Interne Notiz">
     <h5>Notiz <small>nur Spielleitung</small></h5>
     <textarea className={styles.note} maxLength={2000} rows={2} value={current.note||''} placeholder="Wann und warum einsetzen?" onChange={e=>update({note:e.target.value})}/>
    </section>
    <section className={styles.panel} aria-label="Prüfung">
     <div className={styles.panelHead}><h5>Prüfung</h5><button type="button" className={styles.small} disabled={measuring} onClick={()=>void measure()}>{measuring?'Misst …':'Lesbarkeit messen'}</button></div>
     <ul className={styles.checks}>{[...checks,...contrast].map(([k,t],i)=><li key={i} data-kind={k}>{t}</li>)}</ul>
    </section>
   </aside>
  </div>
  {preview&&<DeliveryPreview whisper={current} onClose={()=>setPreview(false)}/>}
 </section>;
}

/** Live-Bühne im echten Format (verkleinert dargestellt), mit Zeitleiste, Sprungmarken und Lichtimpuls-Markierung. Stumm, ohne Zustellung. */
function WorkbenchStage({vision,sel,engineRef,onLive}:{vision:unknown;sel:Sel;engineRef:MutableRefObject<Engine|null>;onLive:(i:number)=>void}){
 const wrap=useRef<HTMLDivElement>(null),box=useRef<HTMLDivElement>(null);
 const [format,setFormat]=useState<FormatId>('desktop');
 const [fit,setFit]=useState({k:0.45,left:0});
 const [st,setSt]=useState({t:0,duration:0,playing:false,ended:false});
 const [reduced,setReduced]=useState(false),[muted,setMuted]=useState(true);
 const [marks,setMarks]=useState<{segs:{l:number;w:number}[];flashes:number[]}>({segs:[],flashes:[]});
 const latest=useRef({vision,sel,onLive});
 const lastLive=useRef(-2);
 useEffect(()=>{latest.current={vision,sel,onLive};});
 const F=FORMATS[format];
 const markOf=(t:EngineTimeline|null)=>{if(!t||!t.duration)return {segs:[],flashes:[]};const p=(v:number)=>v/t.duration*100;return {segs:t.moments.filter(m=>m.dissolveEnd>m.emergeStart).map(m=>({l:p(m.emergeStart),w:p(m.dissolveEnd-m.emergeStart)})),flashes:t.moments.filter(m=>m.flashAt!==null).map(m=>p(m.flashAt as number))};};
 useEffect(()=>{
  const el=wrap.current;if(!el)return;
  const ro=new ResizeObserver(()=>{const k=Math.min(el.clientWidth/F.w,Math.min(560,window.innerHeight*0.62)/F.h,1);setFit({k,left:Math.max(0,(el.clientWidth-F.w*k)/2)});engineRef.current?.setDisplayScale(k);});
  ro.observe(el);
  return()=>ro.disconnect();
 },[F.w,F.h,engineRef]);
 useEffect(()=>{
  const el=box.current;if(!el)return;
  let alive=true;
  void import('./vision-engine/player.js').then(({VisionPlayer:Ctor})=>{
   if(!alive)return;
   const e=new Ctor(el,{mode:'embedded',onState:(s:{t:number;duration:number;playing:boolean;ended:boolean;current:number})=>{
    setSt({t:s.t,duration:s.duration,playing:s.playing,ended:s.ended});
    if(s.current!==lastLive.current){lastLive.current=s.current;latest.current.onLive(s.current);}
   }}) as unknown as Engine;
   engineRef.current=e;e.setMuted(true);
   void e.load(latest.current.vision).then(()=>{if(!alive)return;seekSel(e,latest.current.sel);setMarks(markOf(e.tl));});
  });
  return()=>{alive=false;engineRef.current?.destroy();engineRef.current=null;};
 },[engineRef]);
 useEffect(()=>{
  const e=engineRef.current;if(!e||!e.tl)return;
  const t=window.setTimeout(()=>{void (async()=>{e.vision=vision;await e.ensureImages(vision);e.rebuild();if(!e.playing)seekSel(e,latest.current.sel);setMarks(markOf(e.tl));})();},220);
  return()=>window.clearTimeout(t);
 },[vision,engineRef]);
 const e=()=>engineRef.current;
 return <div className={styles.stageCol}>
  <div ref={wrap} className={styles.frameWrap} style={{height:Math.round(F.h*fit.k)}}>
   <div className={styles.frame} style={{width:F.w,height:F.h,transform:`scale(${fit.k})`,left:fit.left}}><div ref={box} className={engineStyles.root} role="img" aria-label="Live-Bühne der Vision"/></div>
  </div>
  <div className={styles.transport}>
   <button type="button" className={styles.round} aria-label={st.playing&&!st.ended?'Anhalten':'Abspielen'} onClick={()=>{const x=e();if(!x)return;if(!x.playing)seekSel(x,latest.current.sel);x.toggle();}}>{st.playing&&!st.ended?<Pause size={16}/>:<Play size={16}/>}</button>
   <button type="button" className={styles.small} onClick={()=>{const x=e();if(!x)return;x.seek(0);x.play();}}><RotateCcw size={14}/> Von vorn</button>
   <button type="button" className={styles.small} onClick={()=>e()?.next()}><SkipForward size={14}/> Weiter</button>
   <span className={styles.time}>{clock(st.t)} / {clock(st.duration)}</span>
  </div>
  <div className={styles.scrub}>
   <input type="range" min={0} max={1000} step={1} value={st.duration?Math.round(st.t/st.duration*1000):0} aria-label="Zeitposition im Ablauf" onChange={ev=>{const x=e();if(!x||!x.tl)return;x.pause();x.seek(Number(ev.target.value)/1000*x.tl.duration);}}/>
   <div className={styles.marks} aria-hidden="true">{marks.segs.map((m,i)=><span key={i} className={styles.seg2} style={{left:m.l+'%',width:m.w+'%'}}/>)}{marks.flashes.map((f,i)=><span key={'f'+i} className={styles.flash} style={{left:f+'%'}}/>)}</div>
  </div>
  <div className={styles.viewopts}>
   <div className={styles.segBtns} role="radiogroup" aria-label="Bildschirmformat">{(Object.keys(FORMATS) as FormatId[]).map(k=><button key={k} type="button" role="radio" aria-checked={format===k} onClick={()=>setFormat(k)}>{FORMATS[k].label}</button>)}</div>
   <button type="button" className={styles.small} aria-pressed={reduced} onClick={()=>{const v=!reduced;setReduced(v);e()?.setOwnReduced(v);}}>{reduced?'Effekte wieder voll':'Effekte ruhiger'}</button>
   <button type="button" className={styles.small} aria-pressed={!muted} onClick={()=>{const v=!muted;setMuted(v);e()?.setMuted(v);}}>{muted?'Ton an':'Ton aus'}</button>
   <span className={styles.hint}>Live-Bühne · nichts wird zugestellt</span>
  </div>
 </div>;
}

/** Brennpunkt per Klick, Ziehen oder Pfeiltasten; der Kreis zeigt den geschützten Kernbereich. */
function FocusPicker({id,focus,core,onFocus}:{id:string;focus:{x:number;y:number};core:number;onFocus:(f:{x:number;y:number})=>void}){
 const box=useRef<HTMLDivElement>(null);
 const [h,setH]=useState(0);
 const clamp=(v:number)=>Math.round(Math.min(1,Math.max(0,v))*1000)/1000;
 const from=(ev:React.PointerEvent)=>{const r=box.current?.getBoundingClientRect();if(!r)return;onFocus({x:clamp((ev.clientX-r.left)/r.width),y:clamp((ev.clientY-r.top)/r.height)});};
 return <div className={styles.focusWrap}><span className={styles.label}>Wichtigster Bildbereich</span>
  <div ref={box} className={styles.focus} tabIndex={0} role="group" aria-label="Brennpunkt setzen: klicken oder mit den Pfeiltasten verschieben"
   onPointerDown={ev=>{(ev.currentTarget as HTMLDivElement).setPointerCapture(ev.pointerId);from(ev);}} onPointerMove={ev=>{if((ev.currentTarget as HTMLDivElement).hasPointerCapture(ev.pointerId))from(ev);}}
   onKeyDown={ev=>{const step=ev.shiftKey?0.05:0.01;const m:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};const v=m[ev.key];if(v){ev.preventDefault();onFocus({x:clamp(focus.x+v[0]),y:clamp(focus.y+v[1])});}}}>
   <img src={fileUrl(id)} alt="" draggable={false} onLoad={ev=>setH(ev.currentTarget.clientHeight)}/>
   <span className={styles.core} style={{left:focus.x*100+'%',top:focus.y*100+'%',width:core*2*h,height:core*2*h}}/>
   <span className={styles.dot} style={{left:focus.x*100+'%',top:focus.y*100+'%'}}/>
  </div>
  <p className={styles.hint}>Klicke auf das, was erkennbar bleiben muss. Der Kreis bleibt auf jedem Bildschirm klar und nebelfrei.</p>
 </div>;
}
