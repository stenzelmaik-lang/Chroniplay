"use client";

import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {mountToys} from './toys-runtime.js';
import {BASIC_MOVES,SLICES} from './cube-moves.js';
import styles from './spielpause.module.css';

type Toy = 'cube' | 'doll' | 'spinner';
const names: Record<Toy, string> = {cube:'Rubikwürfel', doll:'Graf Knautsch', spinner:'Vampir-Spinner'};
const basicMoves = BASIC_MOVES;
const sliceMoves = SLICES.flatMap(slice=>[slice, slice+'′']);
type Result = {timeMs:number; moves:number; createdAt?:string};

/** Personal results live on ChroniPlay (only the player sees them). Outside the app the list is simply unavailable. */
const resultService = {
  async loadResults():Promise<Result[]> {
    const response = await fetch('/api/spielpause?spiel=rubik',{credentials:'same-origin'});
    if(!response.ok) throw new Error('Bestenliste nicht erreichbar');
    return ((await response.json()) as {results:Result[]}).results;
  },
  async saveResult(result:{game:string;timeMs:number;moves:number}):Promise<Result[]> {
    const response = await fetch('/api/spielpause',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(result)});
    if(!response.ok) throw new Error('Speichern fehlgeschlagen');
    return ((await response.json()) as {results:Result[]}).results;
  }
};

/**
 * Personal, client-only toys. No stage commands or character state enter this boundary.
 * The picker belongs above the table HUD: the stage is an isolated stacking context below
 * the player's own vitals panel, so inside it the choices were covered on smaller screens.
 */
export function Spielpause({open, onMenuClose, personalKey, blocked, pickerHost}: {
  open:boolean; onMenuClose:()=>void; personalKey:string; blocked:boolean; pickerHost?:HTMLElement|null;
}) {
  const [toy,setToy] = useState<Toy|null>(null),[keyboardFocus,setKeyboardFocus]=useState(false);
  const picker = useRef<HTMLElement>(null);
  const returnFocus = () => document.querySelector<HTMLButtonElement>('[aria-label="Spielpause"]')?.focus();
  useEffect(() => { if(open) picker.current?.querySelector<HTMLButtonElement>('button[data-choice]')?.focus(); },[open]);
  const closeMenu = () => { onMenuClose(); returnFocus(); };
  const menu = <aside ref={picker} className={styles.picker} aria-label="Spielpause auswählen" onKeyDown={e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();}
    }}>
      <header><strong>Spielpause</strong><button aria-label="Spielpause-Auswahl schließen" onClick={closeMenu}>×</button></header>
      <p>Ein kleiner Zeitvertreib. Nur auf deinem Tisch.</p>
      {(Object.keys(names) as Toy[]).map(id=><button data-choice key={id} aria-pressed={toy===id} onClick={e=>{setKeyboardFocus(e.detail===0);setToy(id);onMenuClose();}}>{names[id]}</button>)}
      {toy && <button onClick={()=>{setToy(null);closeMenu();}}>Spielzeug wegräumen</button>}
    </aside>;
  return <>
    {open && (pickerHost?createPortal(menu,pickerHost):menu)}
    {toy && <ToyTable key={toy} toy={toy} keyboardFocus={keyboardFocus} personalKey={personalKey} blocked={blocked||open} onClose={()=>{setToy(null);returnFocus();}}/>}
  </>;
}

function ToyTable({toy,keyboardFocus,personalKey,blocked,onClose}:{toy:Toy;keyboardFocus:boolean;personalKey:string;blocked:boolean;onClose:()=>void}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=root.current;
    if(!node)return;
    node.dataset.input=keyboardFocus?'keyboard':'pointer';
    const dispose=mountToys(node,toy,personalKey,resultService);
    node.querySelector<HTMLCanvasElement>(`[data-toy-motion="${toy}"] canvas`)?.focus({preventScroll:true});
    return dispose;
  },[toy,personalKey,keyboardFocus]);
  return <div ref={root} className={styles.table} data-spielpause={toy} data-blocked={blocked} onKeyDown={e=>{
    if(e.key==='Escape' && !e.defaultPrevented){e.preventDefault();e.stopPropagation();onClose();}
  }}>
    <section data-toy-id="rubikwuerfel" hidden={toy!=='cube'} aria-label="Rubikwürfel">
      <div className={styles.object} data-toy-motion="cube"><canvas data-toy-id="cube-canvas" tabIndex={0} aria-label="Rubikwürfel bedienen" aria-describedby="spielpause-cube-help"/></div>
      <canvas className={styles.confetti} data-toy-id="cube-confetti" aria-hidden="true"/>
      <div className={styles.win} data-toy-id="cube-win" role="status" hidden>
        <strong>Gelöst!</strong>
        <span className={styles.winTime} data-toy-id="cube-win-time">0,00</span>
        <span data-toy-id="cube-win-moves">0 Züge</span>
        <em data-toy-id="cube-win-best" hidden>Neue Bestzeit</em>
        <div><button data-toy-id="cube-again">Neue Runde</button><button data-toy-id="cube-win-close">Schließen</button></div>
      </div>
      {/* Timer and leaderboard stand on their own, apart from the control panel. */}
      <div className={styles.hud} role="group" aria-label="Runde">
        <span className={styles.clock} data-toy-id="cube-time" aria-label="Zeit">0,00</span>
        <button className={`${styles.hudClose} ${styles.hudCloseMobile}`} onClick={onClose} aria-label="Spielzeug wegräumen">×</button>
        <span className={styles.hudMeta}><b data-toy-id="cube-count">0</b> Züge</span>
        <span className={styles.hudState} data-toy-id="cube-state" role="status">Gelöst</span>
        <button data-toy-id="cube-mix" className={`${styles.hudButton} ${styles.hudPrimary}`}>Neue Runde</button>
        <button data-toy-id="cube-ranking-toggle" className={styles.hudButton} aria-expanded={false} aria-controls="spielpause-cube-ranking">Bestenliste</button>
        <button data-toy-id="cube-menu-toggle" className={styles.hudButton} aria-expanded={false} aria-controls="spielpause-cube-menu">Menü</button>
        <button className={`${styles.hudClose} ${styles.hudCloseWide}`} onClick={onClose} aria-label="Spielzeug wegräumen">×</button>
      </div>
      <aside className={styles.ranking} id="spielpause-cube-ranking" data-toy-id="cube-ranking" aria-label="Deine Bestenliste" hidden>
        <header><strong>Bestenliste</strong><button data-toy-id="cube-ranking-close" aria-label="Bestenliste schließen">×</button></header>
        <ol data-toy-id="cube-ranking-list"/>
        <p data-toy-id="cube-ranking-note"/>
      </aside>
      {/* Mouse play needs no panel: the menu starts hidden and opens from the round display. */}
      <fieldset className={`${styles.controls} ${styles.cubeControls}`} data-toy-controls="cube" data-toy-id="cube-menu" id="spielpause-cube-menu" hidden>
        <legend className={styles.sr}>Rubikwürfel bedienen</legend>
        <header>
          <strong>Menü</strong>
          <span/>
          <button data-toy-id="cube-menu-close" aria-label="Menü ausblenden">×</button>
        </header>
        <div className={styles.actions}>
          <button data-toy-id="cube-undo">↶ Rückgängig</button>
          <button data-toy-id="cube-reset">Lösen</button>
          <span className={styles.spacer}/>
          <button data-toy-id="cube-mode" className={styles.toggle} aria-pressed={false}>Ziehen: Ebene drehen</button>
          <button data-toy-id="cube-keys" className={styles.toggle} aria-pressed={false}>Tastatur: aus</button>
          <button data-toy-id="cube-view">Ansicht zurück</button>
        </div>
        <div className={styles.moves} role="group" aria-label="Drehungen">
          {basicMoves.map(move=><button key={move} data-move={move} data-face={move[0]}>{move}</button>)}
        </div>
        <details className={styles.more}>
          <summary>Mittelebenen</summary>
          <div className={styles.moves}>{sliceMoves.map(move=><button key={move} data-move={move}>{move}</button>)}</div>
        </details>
        <p id="spielpause-cube-help" data-toy-id="cube-help">Fläche ziehen: Ebene drehen · Daneben ziehen: Ansicht</p>
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
