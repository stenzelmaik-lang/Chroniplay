"use client";

import {useEffect, useRef, useState} from 'react';
import {mountToys} from './toys-runtime.js';
import styles from './spielpause.module.css';

type Toy = 'cube' | 'doll' | 'spinner';
const names: Record<Toy, string> = {cube:'Rubikwürfel', doll:'Graf Knautsch', spinner:'Vampir-Spinner'};
const faces = [['U','Oben · W / ↑'],['L','Links · A / ←'],['D','Unten · S / ↓'],['R','Rechts · D / →'],['F','Vorne · Q'],['B','Hinten · E'],['M','Mitte X'],['E','Mitte Y'],['S','Mitte Z']];

/** Personal, client-only toys. No stage commands or character state enter this boundary. */
export function Spielpause({open, onMenuClose, personalKey, blocked}: {
  open:boolean; onMenuClose:()=>void; personalKey:string; blocked:boolean;
}) {
  const [toy,setToy] = useState<Toy|null>(null);
  const picker = useRef<HTMLElement>(null);
  const returnFocus = () => document.querySelector<HTMLButtonElement>('[aria-label="Spielpause"]')?.focus();
  useEffect(() => { if(open) picker.current?.querySelector<HTMLButtonElement>('button[data-choice]')?.focus(); },[open]);
  const closeMenu = () => { onMenuClose(); returnFocus(); };
  return <>
    {open && <aside ref={picker} className={styles.picker} aria-label="Spielpause auswählen" onKeyDown={e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();}
    }}>
      <header><strong>Spielpause</strong><button aria-label="Spielpause-Auswahl schließen" onClick={closeMenu}>×</button></header>
      <p>Ein kleiner Zeitvertreib. Nur auf deinem Tisch.</p>
      {(Object.keys(names) as Toy[]).map(id=><button data-choice key={id} aria-pressed={toy===id} onClick={()=>{setToy(id);onMenuClose();}}>{names[id]}</button>)}
      {toy && <button onClick={()=>{setToy(null);closeMenu();}}>Spielzeug wegräumen</button>}
    </aside>}
    {toy && <ToyTable key={toy} toy={toy} personalKey={personalKey} blocked={blocked||open} onClose={()=>{setToy(null);returnFocus();}}/>}
  </>;
}

function ToyTable({toy,personalKey,blocked,onClose}:{toy:Toy;personalKey:string;blocked:boolean;onClose:()=>void}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=root.current;
    if(!node)return;
    const dispose=mountToys(node,toy,personalKey);
    node.querySelector<HTMLCanvasElement>(`[data-toy-motion="${toy}"] canvas`)?.focus({preventScroll:true});
    return dispose;
  },[toy,personalKey]);
  return <div ref={root} className={styles.table} data-spielpause={toy} data-blocked={blocked} onKeyDown={e=>{
    if(e.key==='Escape' && !e.defaultPrevented){e.preventDefault();e.stopPropagation();onClose();}
  }}>
    <section data-toy-id="rubikwuerfel" hidden={toy!=='cube'} aria-label="Rubikwürfel">
      <div className={styles.object} data-toy-motion="cube"><canvas data-toy-id="cube-canvas" tabIndex={0} aria-label="Rubikwürfel bedienen" aria-describedby="spielpause-cube-help"/></div>
      <fieldset className={styles.controls} data-toy-controls="cube">
        <legend className={styles.sr}>Rubikwürfel bedienen</legend>
        <header><strong>Rubikwürfel</strong><span><b data-toy-id="cube-count">0</b> Züge · <span data-toy-id="cube-state" role="status">Gelöst</span></span><button onClick={onClose} aria-label="Spielzeug wegräumen">×</button></header>
        <div className={styles.faces}>{faces.map(([face,label])=><button key={face} data-face={face} aria-pressed={face==='F'}>{label}</button>)}</div>
        <div className={styles.actions}>
          <button data-toy-id="cube-ccw">↶ Drehen</button><button data-toy-id="cube-cw">↷ Drehen</button>
          <button data-toy-id="cube-undo">Rückgängig</button><button data-toy-id="cube-mix">Mischen</button>
          <button data-toy-id="cube-reset">Lösen</button><button data-toy-id="cube-view">Ansicht zurück</button>
        </div>
        <p id="spielpause-cube-help">Shift: andersherum · Fläche wischen: Ebene drehen · Rand ziehen oder Alt + Ziehen: Ansicht</p>
        <span className={styles.sr} data-toy-id="cube-history"/>
      </fieldset>
    </section>
    <section hidden={toy!=='doll'} aria-label="Graf Knautsch">
      <div className={styles.object} data-toy-motion="doll">
        <div data-toy-id="doll-speech" className={styles.speech} role="status"><span data-toy-id="doll-quote">Massier mich</span></div>
        <canvas data-toy-id="doll-canvas" tabIndex={0} role="button" aria-label="Graf Knautsch quetschen" aria-pressed={false}/>
      </div>
      <fieldset className={styles.controls} data-toy-controls="doll">
        <legend className={styles.sr}>Graf Knautsch bedienen</legend>
        <header><strong>Graf Knautsch</strong><span><b data-toy-id="doll-count">0</b> Quetscher</span><button onClick={onClose} aria-label="Spielzeug wegräumen">×</button></header>
        <div className={styles.actions}><span data-toy-id="doll-state">Zum Quetschen bereit</span><button data-toy-id="doll-reset">Zähler zurücksetzen</button></div>
        <p>Drücken und halten · Tastatur: Leertaste oder Enter auf der Puppe</p>
      </fieldset>
    </section>
    <section hidden={toy!=='spinner'} aria-label="Vampir-Spinner">
      <div className={styles.object} data-toy-motion="spinner"><canvas data-toy-id="spinner-canvas" tabIndex={0} role="button" aria-label="Vampir-Spinner anschubsen"/></div>
      <fieldset className={styles.controls} data-toy-controls="spinner">
        <legend className={styles.sr}>Vampir-Spinner bedienen</legend>
        <header><strong>Vampir-Spinner</strong><span><b data-toy-id="spinner-speed">0</b> U/min · <b data-toy-id="spinner-turns">0</b> Runden</span><button onClick={onClose} aria-label="Spielzeug wegräumen">×</button></header>
        <div className={styles.actions}><button data-toy-id="spinner-push">Schwung geben</button><button data-toy-id="spinner-stop">Stoppen</button></div>
        <p>Antippen oder im Kreis ziehen · Tastatur: ← / →, Leertaste oder Enter</p>
      </fieldset>
    </section>
    <button className={styles.cancelEntrance} onClick={onClose} aria-label="Auftritt abbrechen und Spielzeug wegräumen">×</button>
  </div>;
}
