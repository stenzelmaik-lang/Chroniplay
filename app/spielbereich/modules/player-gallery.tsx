"use client";
/* eslint-disable @next/next/no-img-element -- Images come from the authenticated gallery endpoint. */
import {useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight,ImagePlus,X} from 'lucide-react';
import {api} from './api-client';
import styles from './player-gallery.module.css';

type Gallery={characters:{id:string;name:string;images:{url:string;caption:string;portrait:boolean}[]}[]};

/** Galerie: the player's personal gallery, the images of the own characters only (never other players' images; the server enforces it). */
export function PlayerGallery({characterId:givenCharacterId}:{characterId?:string|null}){
 const [selectedId,setSelectedId]=useState<string|null>(null);
 // The gallery page does not load the character list; fall back to the stored character choice.
 useEffect(()=>{if(givenCharacterId)return;let live=true;api<{characterId?:string|null}>('/api/character-selection').then(d=>{if(live)setSelectedId(d.characterId||null);}).catch(()=>{});return()=>{live=false;};},[givenCharacterId]);
 const characterId=givenCharacterId||selectedId;
 const [data,setData]=useState<Gallery|null>(null),[error,setError]=useState(''),[open,setOpen]=useState<{c:number;i:number}|null>(null),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 useEffect(()=>{let live=true;api<Gallery>('/api/character-gallery').then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError((e as Error).message);});return()=>{live=false;};},[reload]);
 /** Second way in: the picture lands in the character's image list ("Porträt & Referenzen"), private until the owner shares it there. */
 async function add(file:File|undefined){
  if(!file||!characterId)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){setStatus('Bitte JPG, PNG oder WebP bis 8 MB auswählen.');return;}
  setBusy(true);setStatus('');
  try{const form=new FormData();form.set('file',file);form.set('visibility','private');const up=await api<{id:string}>('/api/files','POST',form);const detail=await api<{revision:{version:number}}>('/api/character-detail?id='+encodeURIComponent(characterId));await api('/api/character-companion','PATCH',{action:'media',id:characterId,version:detail.revision.version,fileId:up.id,mediaType:'reference',shared:false});setStatus('Bild hinzugefügt. Es bleibt privat, bis du es im Charakterprofil freigibst.');setReload(n=>n+1);}
  catch(e){setStatus((e as Error).message);}
  finally{setBusy(false);}
 }
 const addButton=characterId?<div className={styles.add}><label className={styles.addButton} aria-disabled={busy||undefined}><ImagePlus size={18} aria-hidden="true"/><span>{busy?'Wird hochgeladen …':'Bild hinzufügen'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{void add(e.target.files?.[0]);e.target.value='';}}/></label><span role="status" className={styles.hint}>{status||'Landet privat in deinem Charakterprofil unter „Porträt & Referenzen“. Dort änderst du Freigabe und Bildunterschrift.'}</span></div>:null;
 useEffect(()=>{if(!open||!data)return;const key=(e:KeyboardEvent)=>{const n=data.characters[open.c].images.length;if(e.key==='Escape')setOpen(null);if(e.key==='ArrowRight')setOpen({c:open.c,i:(open.i+1)%n});if(e.key==='ArrowLeft')setOpen({c:open.c,i:(open.i+n-1)%n});};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[open,data]);
 if(error)return <p role="alert">{error}</p>;
 if(!data)return <p role="status">Galerie wird geladen …</p>;
 if(!data.characters.length)return <>{addButton}<section className={styles.empty}><p>Deine Galerie ist noch leer.</p><p className={styles.hint}>Hier liegen nur die Bilder deiner eigenen Charaktere. Du pflegst sie im Charakterprofil unter „Porträt & Referenzen“.</p></section></>;
 const current=open?data.characters[open.c]:null,image=current&&open?current.images[open.i]:null;
 return <div className={styles.gallery}>
  {addButton}
  {data.characters.map((c,ci)=><section key={c.id} className={styles.character} aria-labelledby={'g-'+c.id}>
   <h2 id={'g-'+c.id}>{c.name}</h2>
   <ul>{c.images.map((img,ii)=><li key={img.url}><button type="button" onClick={()=>setOpen({c:ci,i:ii})} aria-label={(img.caption||(img.portrait?'Porträt':'Bild '+(ii+1)))+' von '+c.name+' groß ansehen'}><img src={img.url} alt="" loading="lazy"/>{(img.caption||img.portrait)&&<span>{img.caption||'Porträt'}</span>}</button></li>)}</ul>
  </section>)}
  {current&&image&&open&&<div className={styles.viewer} role="dialog" aria-modal="true" aria-label={current.name+' · Bild '+(open.i+1)+' von '+current.images.length}>
   <button type="button" className={styles.close} onClick={()=>setOpen(null)} aria-label="Schließen"><X size={20}/></button>
   <figure><img src={image.url} alt={image.caption||current.name}/><figcaption><strong>{current.name}</strong>{image.caption&&<> · {image.caption}</>} <small>{open.i+1} / {current.images.length}</small></figcaption></figure>
   {current.images.length>1&&<><button type="button" className={styles.prev} onClick={()=>setOpen({c:open.c,i:(open.i+current.images.length-1)%current.images.length})} aria-label="Vorheriges Bild"><ChevronLeft size={28}/></button><button type="button" className={styles.next} onClick={()=>setOpen({c:open.c,i:(open.i+1)%current.images.length})} aria-label="Nächstes Bild"><ChevronRight size={28}/></button></>}
  </div>}
 </div>;
}
