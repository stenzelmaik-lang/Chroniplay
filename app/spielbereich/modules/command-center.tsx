"use client";
import { useState, useEffect } from 'react';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import type { Actor } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { commandCenterAllowed } from '@/domain/command-center';
import { LiveSession } from './live-session';
import { StoryWorkspace } from './story-workspace';
import { Storyboard } from './storyboard';
import { XpSessionDesk } from './xp-session-desk';
import { api } from './api-client';
import type { campaignEngagementOverview } from '@/server/engagement-awards';
import styles from './xp-session-access.module.css';

export function CommandCenter(props: { entries: Entry[]; a: Actor; onRefresh: () => void; preparation?: boolean; onPreparationDirty?: (dirty:boolean)=>void; engagementAvailable?: boolean }) {
  const [xpOpen,setXpOpen]=useState(false);
  const [progress,setProgress]=useState<Awaited<ReturnType<typeof campaignEngagementOverview>> | null>(null);
  const [progressError,setProgressError]=useState('');
  // Storyboard is the default preparation surface; the classic workspace stays reachable (?ansicht=klassisch)
  // for every tool the storyboard does not show yet. The choice is read from the URL once after mount.
  const [classic,setClassic]=useState<boolean|null>(null);
  useEffect(()=>{Promise.resolve().then(()=>setClassic(new URLSearchParams(window.location.search).get('ansicht')==='klassisch'));},[]);
  const openClassic=(sceneId?:string)=>{const url=new URL(window.location.href);for(const key of ['buch','abend','szene'])url.searchParams.delete(key);url.searchParams.set('ansicht','klassisch');if(sceneId)url.searchParams.set('scene',sceneId);window.location.assign(url.toString());};
  const openStoryboard=()=>{window.location.assign(new URL('/sl/command-center?bereich=sitzung',window.location.origin).toString());};
  if (props.preparation && commandCenterAllowed(props.a) && classic===null) return <p role="status">Lade Vorbereitung …</p>;
  if (props.preparation && commandCenterAllowed(props.a) && !classic) return <Storyboard key={props.a.campaignId+':'+props.a.id} a={props.a} onDirty={props.onPreparationDirty} onClassic={openClassic}/>;
  if (props.preparation && commandCenterAllowed(props.a)) return <div>
    <p><button type="button" className={styles.backLink} onClick={openStoryboard}>← Zurück zum Storyboard</button></p>
    <section className={styles.entry} aria-label="Erfahrungspunkte nach Spielabenden">
      <button type="button" className={styles.toggle} aria-expanded={xpOpen} onClick={()=>setXpOpen(open=>!open)}>
        <ClipboardList size={20} aria-hidden="true"/>
        <span><strong>EP-Abrechnung</strong><small>Anwesenheit, Belohnungen und gespielte Abende</small></span>
        {xpOpen?<ChevronUp size={18} aria-hidden="true"/>:<ChevronDown size={18} aria-hidden="true"/>}
      </button>
      {xpOpen&&<XpSessionDesk entries={props.entries}/>}
      {xpOpen && props.engagementAvailable && <details className="panel" onToggle={event => {
        if (!event.currentTarget.open) return;
        setProgress(null); setProgressError('');
        void api<Awaited<ReturnType<typeof campaignEngagementOverview>>>('/api/engagement?view=sl')
          .then(setProgress).catch(error => setProgressError((error as Error).message));
      }}>
        <summary>Engagement-EP im aktuellen Intervall</summary>
        {progressError ? <p role="alert">{progressError}</p> : !progress ? <p role="status">Summen werden geladen …</p> :
          progress.progress.length === 0 ? <p>Für dieses Intervall liegt noch keine bestätigte Vorbereitung vor.</p> :
          <ul>{progress.progress.map((row,index)=><li key={index}>{row.recipient} · {Math.floor(row.verifiedSeconds / 60)} Min. bestätigt · {row.bookedStages.length} von 2 EP gebucht</li>)}</ul>}
      </details>}
    </section>
    <StoryWorkspace a={props.a} onDirty={props.onPreparationDirty}/>
  </div>;
  return <LiveSession key={props.a.campaignId+':'+props.a.id} a={props.a}/>;
}
