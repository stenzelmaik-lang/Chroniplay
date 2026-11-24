"use client";

import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {mountToys} from './toys-runtime.js';
import {mountWatch} from './watch-runtime.js';
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
type Person = {id:string; name:string};
type WatchStatus = {runId:string; viewers:Person[]; candidates:Person[]; watching:Person[]};
type CubeFeed = {round:string; moves:string; overflow:boolean; timerState:string; timeMs:number; userMoves:number; solved:boolean};
const watchUrl = '/api/spielpause/watch';
const post = (body:unknown) => fetch(watchUrl,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});

/**
 * Watching (owner decisions 24.11.2026): a player invites people at the running evening to watch their cube live and
 * can withdraw that at any time. Viewers see the cube, time and moves, never the leaderboard. The server decides who
 * may watch; this only polls like the rest of the live table does.
 */
function useWatch(sessionId?:string, runId?:string) {
  const [status,setStatus] = useState<WatchStatus|null>(null),[error,setError]=useState('');
  const refresh = useCallback(async()=>{
    if(!sessionId)return;
    try{const r=await fetch(watchUrl+'?sessionId='+encodeURIComponent(sessionId),{credentials:'same-origin',cache:'no-store'});if(r.ok)setStatus(await r.json() as WatchStatus);}catch{/* keep the last state */}
  },[sessionId]);
  useEffect(()=>{
    if(!sessionId)return;
    queueMicrotask(()=>void refresh());
    const tick=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},4000);
    return()=>window.clearInterval(tick);
  },[sessionId,refresh]);
  const change = useCallback(async(action:'invite'|'withdraw',viewerId:string)=>{
    if(!sessionId||!runId)return;
    setError('');
    try{const r=await post({action,sessionId,runId,viewerId});const d=await r.json() as WatchStatus&{error?:string};if(!r.ok)throw new Error(d.error||'Nicht möglich.');setStatus(d);}
    catch(e){setError((e as Error).message);}
  },[sessionId,runId]);
  return {status,setStatus,error,change,enabled:!!sessionId&&!!runId};
}

export function Spielpause({open, onMenuClose, personalKey, blocked, pickerHost, sessionId, runId}: {
  open:boolean; onMenuClose:()=>void; personalKey:string; blocked:boolean; pickerHost?:HTMLElement|null; sessionId?:string; runId?:string;
}) {
  const [toy,setToy] = useState<Toy|null>(null),[keyboardFocus,setKeyboardFocus]=useState(false);
  const watch = useWatch(sessionId,runId);
  const [watchHost,setWatchHost] = useState<Person|null>(null),[dismissed,setDismissed]=useState<string[]>([]);
  const watching = watch.status?.watching||[];
  const invitation = !toy&&!watchHost&&!open ? watching.find(p=>!dismissed.includes(p.id)) : undefined;
  const startWatching = (p:Person) => { setToy(null); setWatchHost(p); setDismissed(d=>[...d,p.id]); onMenuClose(); };
  const picker = useRef<HTMLElement>(null);
  const returnFocus = () => document.querySelector<HTMLButtonElement>('[aria-label="Spielpause"]')?.focus();
  useEffect(() => { if(open) picker.current?.querySelector<HTMLButtonElement>('button[data-choice]')?.focus(); },[open]);
  const closeMenu = () => { onMenuClose(); returnFocus(); };
  const menu = <aside ref={picker} className={styles.picker} aria-label="Spielpause auswählen" onKeyDown={e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();}
    }}>
      <header><strong>Spielpause</strong><button aria-label="Spielpause-Auswahl schließen" onClick={closeMenu}>×</button></header>
      <p>Ein kleiner Zeitvertreib. Nur auf deinem Tisch.</p>
      {(Object.keys(names) as Toy[]).map(id=><button data-choice key={id} aria-pressed={toy===id} onClick={e=>{setKeyboardFocus(e.detail===0);setToy(id);setWatchHost(null);onMenuClose();}}>{names[id]}</button>)}
      {watching.map(p=><button data-choice data-watch-host={p.id} key={'watch-'+p.id} aria-pressed={watchHost?.id===p.id} onClick={()=>startWatching(p)}>Zuschauen: Würfel von {p.name}</button>)}
      {(toy||watchHost) && <button onClick={()=>{setToy(null);setWatchHost(null);closeMenu();}}>Spielzeug wegräumen</button>}
    </aside>;
  const notice = invitation && <aside className={styles.invite} role="status" aria-label="Einladung zum Zuschauen" data-watch-invite={invitation.id}>
      <p><strong>{invitation.name}</strong> lädt dich ein, beim Rubikwürfel zuzuschauen.</p>
      <div><button onClick={()=>startWatching(invitation)}>Zuschauen</button><button onClick={()=>setDismissed(d=>[...d,invitation.id])}>Später</button></div>
    </aside>;
  return <>
    {open && (pickerHost?createPortal(menu,pickerHost):menu)}
    {notice && !blocked && (pickerHost?createPortal(notice,pickerHost):notice)}
    {toy && <ToyTable key={toy} toy={toy} keyboardFocus={keyboardFocus} personalKey={personalKey} blocked={blocked||open} watch={watch} sessionId={sessionId} runId={runId} onClose={()=>{setToy(null);returnFocus();}}/>}
    {watchHost && sessionId && <WatchTable key={watchHost.id} host={watchHost} sessionId={sessionId} blocked={blocked||open} onClose={()=>{setWatchHost(null);returnFocus();}}/>}
  </>;
}

/** Sends the latest cube state while somebody is invited: at most one request in flight, the newest state wins. */
function useCubeBroadcast(watch:ReturnType<typeof useWatch>|undefined, sessionId?:string, runId?:string) {
  const latest = useRef<CubeFeed|null>(null),busy=useRef(false),pending=useRef(false),last=useRef(0),timer=useRef(0);
  const live = (watch?.status?.viewers.length||0)>0 && !!watch?.enabled;
  const liveRef = useRef(live);
  useEffect(()=>{liveRef.current=live;},[live]);
  const setStatus = watch?.setStatus;
  const flush = useCallback(async function send():Promise<void>{
    if(!liveRef.current||!latest.current||!sessionId||!runId)return;
    if(busy.current){pending.current=true;return;}
    const wait=350-(Date.now()-last.current);
    if(wait>0){if(!timer.current)timer.current=window.setTimeout(()=>{timer.current=0;void send();},wait);return;}
    busy.current=true;pending.current=false;last.current=Date.now();
    try{const r=await post({action:'publish',sessionId,runId,feed:latest.current});if(r.ok)setStatus?.(await r.json() as WatchStatus);}catch{/* the cube keeps working */}
    finally{busy.current=false;if(pending.current)void send();}
  },[sessionId,runId,setStatus]);
  useEffect(()=>{liveRef.current=live;if(live)void flush();},[live,flush]);
  useEffect(()=>()=>window.clearTimeout(timer.current),[]);
  return useCallback((feed:CubeFeed)=>{latest.current=feed;void flush();},[flush]);
}

type ResultService = {loadResults?:()=>Promise<Result[]>; saveResult?:(result:{game:string;timeMs:number;moves:number})=>Promise<Result[]>};

/** Also used by the public Spielbox (`app/spielbox`), which passes browser-only `services` and no `watch` (no live table, no watching). */
export function ToyTable({toy,keyboardFocus,personalKey,blocked,watch,sessionId,runId,onClose,services=resultService}:{toy:Toy;keyboardFocus:boolean;personalKey:string;blocked:boolean;watch?:ReturnType<typeof useWatch>;sessionId?:string;runId?:string;onClose:()=>void;services?:ResultService}) {
  const root = useRef<HTMLDivElement>(null);
  const [watchOpen,setWatchOpen] = useState(false);
  const broadcast = useCubeBroadcast(watch,sessionId,runId);
  const broadcastRef = useRef(broadcast);
  useEffect(()=>{broadcastRef.current=broadcast;},[broadcast]);
  const viewers = watch?.status?.viewers||[], candidates = watch?.status?.candidates||[];
  useEffect(()=>{
    const node=root.current;
    if(!node)return;
    node.dataset.input=keyboardFocus?'keyboard':'pointer';
    const dispose=mountToys(node,toy,personalKey,{...services,onCubeChange:(feed:CubeFeed)=>broadcastRef.current(feed)});
    node.querySelector<HTMLCanvasElement>(`[data-toy-motion="${toy}"] canvas`)?.focus({preventScroll:true});
    return dispose;
  },[toy,personalKey,keyboardFocus,services]);
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
        {watch?.enabled && <button data-toy-id="cube-watch-toggle" className={styles.hudButton} aria-expanded={watchOpen} aria-controls="spielpause-cube-watch" onClick={()=>setWatchOpen(v=>!v)}>Zuschauen{viewers.length?' · '+viewers.length:''}</button>}
        <button data-toy-id="cube-menu-toggle" className={styles.hudButton} aria-expanded={false} aria-controls="spielpause-cube-menu">Menü</button>
        <button className={`${styles.hudClose} ${styles.hudCloseWide}`} onClick={onClose} aria-label="Spielzeug wegräumen">×</button>
      </div>
      <aside className={styles.ranking} id="spielpause-cube-ranking" data-toy-id="cube-ranking" aria-label="Deine Bestenliste" hidden>
        <header><strong>Bestenliste</strong><button data-toy-id="cube-ranking-close" aria-label="Bestenliste schließen">×</button></header>
        <ol data-toy-id="cube-ranking-list"/>
        <p data-toy-id="cube-ranking-note"/>
      </aside>
      {watch?.enabled && watchOpen && <aside className={styles.watchPanel} id="spielpause-cube-watch" data-toy-id="cube-watch" aria-label="Zum Zuschauen einladen">
        <header><strong>Zuschauen</strong><button onClick={()=>setWatchOpen(false)} aria-label="Zuschauen schließen">×</button></header>
        <p>Eingeladene sehen deinen Würfel, die Zeit und die Züge. Deine Bestenliste bleibt privat. Du kannst jederzeit zurücknehmen.</p>
        {candidates.length ? <ul>{candidates.map(p=>{const invited=viewers.some(v=>v.id===p.id);return <li key={p.id} data-watch-candidate={p.id}>
          <span>{p.name}{invited&&<small> · schaut zu</small>}</span>
          <button aria-pressed={invited} onClick={()=>void watch?.change(invited?'withdraw':'invite',p.id)}>{invited?'Zurücknehmen':'Einladen'}</button>
        </li>;})}</ul> : <p>Gerade sitzt niemand sonst am Tisch.</p>}
        {watch?.error && <p role="alert">{watch.error}</p>}
      </aside>}
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

/** Read-only view of an inviting player's cube. Polls the feed; a withdrawn invitation ends the view at once. */
function WatchTable({host,sessionId,blocked,onClose}:{host:Person;sessionId:string;blocked:boolean;onClose:()=>void}) {
  const root = useRef<HTMLDivElement>(null);
  const [ended,setEnded] = useState(false);
  useEffect(()=>{
    const node=root.current;
    if(!node)return;
    const view=mountWatch(node);
    node.querySelector<HTMLCanvasElement>('canvas')?.focus({preventScroll:true});
    let alive=true,inFlight=false,tick=0;
    const url=watchUrl+'?sessionId='+encodeURIComponent(sessionId)+'&host='+encodeURIComponent(host.id);
    const poll=async()=>{
      if(inFlight||document.visibilityState!=='visible')return;
      inFlight=true;
      try{
        const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});
        if(!alive)return;
        if(r.status===404||r.status===409){setEnded(true);window.clearInterval(tick);return;}
        if(r.ok){const d=await r.json() as {feed:CubeFeed|null;ageMs:number|null};view.update(d.feed,d.ageMs||0);}
      }catch{/* try again with the next tick */}
      finally{inFlight=false;}
    };
    tick=window.setInterval(()=>void poll(),700);
    void poll();
    return()=>{alive=false;window.clearInterval(tick);view.dispose();};
  },[host.id,sessionId]);
  return <div ref={root} className={styles.table} data-spielpause="watch" data-watch-host={host.id} data-watch-ended={ended} data-blocked={blocked} onKeyDown={e=>{
    if(e.key==='Escape' && !e.defaultPrevented){e.preventDefault();e.stopPropagation();onClose();}
  }}>
    <section aria-label={'Rubikwürfel von '+host.name}>
      <div className={styles.object}><canvas data-watch-id="canvas" tabIndex={0} aria-label={'Rubikwürfel von '+host.name+' ansehen. Ziehen oder Pfeiltasten drehen nur deine Ansicht.'}/></div>
      <div className={styles.hud} role="group" aria-label="Zuschauen">
        <span className={styles.watchName}>Würfel von {host.name}</span>
        <span className={styles.clock} data-watch-id="time" aria-label="Zeit">0,00</span>
        <span className={styles.hudMeta}><b data-watch-id="count">0</b> Züge</span>
        <span className={styles.hudState} data-watch-id="state" role="status">Wartet …</span>
        <button className={styles.hudClose} onClick={onClose} aria-label="Zuschauen beenden">×</button>
      </div>
      {ended && <div className={styles.win} role="status" data-watch-id="ended"><strong>Zuschauen beendet</strong><span>{host.name} hat die Einladung zurückgenommen oder der Spielabend ist vorbei.</span><div><button onClick={onClose}>Schließen</button></div></div>}
    </section>
  </div>;
}
