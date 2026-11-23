"use client";
/* Voice in the table's top bar: join, microphone and leave in one compact group. Hidden unless voice is released. */
import {Headphones,Mic,MicOff,PhoneOff,Volume2,X} from 'lucide-react';
import type {Voice} from './use-voice';
import styles from './voice-control.module.css';

export function VoiceControl({voice:v}:{voice:Voice}){
 if(!v.status?.available)return null;
 const count=Object.keys(v.peers).length;
 const joined=v.phase==='joined';
 return <div className={styles.voice} data-joined={joined} role="group" aria-label="Sprachchat">
  {!joined?<button className={styles.join} onClick={()=>void v.join()} disabled={v.phase==='joining'||v.status.mode==='unconfigured'}
    title={v.status.mode==='unconfigured'?'Sprachchat ist noch nicht eingerichtet':'Dem Sprachchat beitreten. Dein Mikrofon bleibt aus, bis du es einschaltest. Es wird nichts aufgezeichnet.'}>
    <Headphones size={15} aria-hidden="true"/><span className={styles.label}>{v.phase==='joining'?'Verbinde …':'Voice'}</span></button>
  :<>
   <button className={styles.mic} data-on={v.micOn} onClick={()=>void v.toggleMic()} disabled={v.busy} aria-pressed={v.micOn} aria-label={v.micOn?'Mikrofon ausschalten':'Mikrofon einschalten'} title={v.micOn?'Mikrofon ausschalten':'Mikrofon einschalten'}>{v.micOn?<Mic size={16}/>:<MicOff size={16}/>}</button>
   <span className={styles.count} title={v.test?'Testmodus: keine echte Verbindung':count+(count===1?' Person':' Personen')+' im Sprachchat'}><Headphones size={13} aria-hidden="true"/>{v.test?'Test':count}</span>
   <button className={styles.leave} onClick={()=>void v.leave()} aria-label="Sprachchat verlassen" title="Sprachchat verlassen"><PhoneOff size={15}/></button>
  </>}
  {v.blocked&&<button className={styles.notice} onClick={v.resumeAudio}><Volume2 size={14} aria-hidden="true"/> Ton der anderen einschalten</button>}
  {v.error&&<p className={styles.notice} role="alert">{v.error}<button onClick={v.clearError} aria-label="Hinweis schließen"><X size={13}/></button></p>}
 </div>;
}
