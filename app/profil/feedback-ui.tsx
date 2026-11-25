"use client";
/* Feedback & Fehler melden (2.5, issue #5): form, own reports with status and reply, and for the GM/owner the inbox. */
import {FormEvent,useCallback,useEffect,useState} from 'react';
import {FEEDBACK_KINDS,FEEDBACK_AREAS,FEEDBACK_STATUSES,FEEDBACK_SEVERITIES,kindLabels,areaLabels,statusLabels,isCritical,type FeedbackKind} from '@/domain/feedback';
import {accountApi} from './account-ui';
import {ProfileStyleReviews} from './profile-style-reviews';
import styles from './profile.module.css';

type Own={id:string;kind:string;area:string;title:string;description:string;status:string;reply:string;createdAt:string;updatedAt:string};
type Inbox=Own&{steps:string;expected:string;actual:string;page:string;appVersion:string;browser:string;severity:string|null;operatorNote:string;version:number;reporter:{id:string;name:string}};
const date=(s:string)=>new Date(s).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'});
const label=<T extends string>(map:Record<T,string>,key:string)=>map[key as T]??key;

export function FeedbackSection(){
 const [own,setOwn]=useState<Own[]>([]),[operator,setOperator]=useState(false),[inbox,setInbox]=useState<Inbox[]>([]);
 const [kind,setKind]=useState<FeedbackKind>('fehler'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const mine=await accountApi<{operator:boolean;reports:Own[]}>('/api/feedback');setOwn(mine.reports);setOperator(mine.operator);
  if(mine.operator)setInbox((await accountApi<{reports:Inbox[]}>('/api/feedback?alle=1')).reports);
 },[]);
 useEffect(()=>{queueMicrotask(()=>{void load().catch(e=>setError((e as Error).message));});},[load]);

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,d=Object.fromEntries(new FormData(form)) as Record<string,string>;
  setBusy(true);setError('');setNotice('');
  try{
   await accountApi('/api/feedback','POST',{kind,area:d.area,title:d.title,description:d.description,steps:d.steps??'',expected:d.expected??'',actual:d.actual??'',page:d.page??'',consentContext:d.consentContext==='on'});
   form.reset();setKind('fehler');setNotice('Danke! Deine Meldung ist eingegangen. Den Stand siehst du unten.');await load();
  }catch(e){setError((e as Error).message+' Falls das Senden nicht klappt, schreib an kontakt.pan0ram@gmail.com.');}
  finally{setBusy(false);}
 }
 async function update(r:Inbox,changes:Partial<Pick<Inbox,'status'|'severity'|'operatorNote'|'reply'>>){
  setBusy(true);setError('');
  try{await accountApi('/api/feedback','PATCH',{id:r.id,version:r.version,...changes});await load();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }

 return <>{operator&&<ProfileStyleReviews/>}<section className={styles.card} aria-label="Feedback und Fehler melden">
  <div className={styles.heading}><div><h2>Feedback & Fehler melden</h2><small>Deine Meldung sieht nur die Spielleitung. Nichts davon wird automatisch veröffentlicht.</small></div></div>
  {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.success}>{notice}</p>}
  <form onSubmit={submit}>
   <fieldset className={styles.introduction}><legend>Art der Meldung</legend>
    {FEEDBACK_KINDS.map(k=><label className={styles.check} key={k}><input type="radio" name="kind" value={k} checked={kind===k} onChange={()=>setKind(k)}/>{kindLabels[k]}</label>)}
   </fieldset>
   <label>Bereich<select name="area" defaultValue="sonstiges">{FEEDBACK_AREAS.map(a=><option key={a} value={a}>{areaLabels[a]}{isCritical(a)?' (wichtig)':''}</option>)}</select></label>
   <label>Kurzer Titel<input name="title" required minLength={3} maxLength={120} placeholder="Zum Beispiel: Würfel zeigen kein Ergebnis"/></label>
   <label>Beschreibung<textarea name="description" required minLength={10} maxLength={4000} rows={4}/></label>
   {kind==='fehler'&&<>
    <label>So kann man es nachstellen (optional)<textarea name="steps" maxLength={4000} rows={3} placeholder="1. … 2. … 3. …"/></label>
    <label>Was hast du erwartet? (optional)<textarea name="expected" maxLength={2000} rows={2}/></label>
    <label>Was ist stattdessen passiert? (optional)<textarea name="actual" maxLength={2000} rows={2}/></label>
   </>}
   <label>Auf welcher Seite? (optional)<input name="page" maxLength={200} placeholder="/spielbereich"/></label>
   <label className={styles.check}><input type="checkbox" name="consentContext"/>Version, Seite und Gerätetyp (zum Beispiel „Desktop · Chrome“) mitschicken</label>
   <small>Bitte keine Passwörter, Codes oder Geheimnisse anderer Spieler hineinschreiben.</small>
   <button className={styles.primary} disabled={busy}>{busy?'Wird gesendet…':'Meldung senden'}</button>
  </form>

  <h3>Deine Meldungen</h3>
  {own.length===0?<p>Du hast noch nichts gemeldet.</p>:own.map(r=><article className={styles.row} key={r.id}><div>
   <strong>{r.title}</strong><small>{label(kindLabels,r.kind)} · {label(areaLabels,r.area)} · {date(r.createdAt)} · <b>{label(statusLabels,r.status)}</b></small>
   {r.reply&&<p><b>Antwort der Spielleitung:</b> {r.reply}</p>}
  </div></article>)}

  {operator&&<details className={styles.personalSettings} open={inbox.some(r=>r.status==='eingegangen')}>
   <summary>Eingegangene Meldungen ({inbox.filter(r=>r.status==='eingegangen'||r.status==='in_pruefung').length} offen)</summary>
   <div>{inbox.length===0?<p>Noch keine Meldungen.</p>:inbox.map(r=><article className={styles.row} key={r.id}><div>
    <strong>{isCritical(r.area)?'⚠ ':''}{r.title}</strong>
    <small>{r.reporter.name} · {label(kindLabels,r.kind)} · {label(areaLabels,r.area)} · {date(r.createdAt)}{r.page&&' · '+r.page}{r.browser&&' · '+r.browser} · v{r.appVersion}</small>
    <p>{r.description}</p>
    {r.steps&&<p><b>Nachstellen:</b> {r.steps}</p>}{r.expected&&<p><b>Erwartet:</b> {r.expected}</p>}{r.actual&&<p><b>Passiert:</b> {r.actual}</p>}
    <label>Status<select value={r.status} disabled={busy} onChange={e=>void update(r,{status:e.target.value})}>{FEEDBACK_STATUSES.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
    <label>Schweregrad<select value={r.severity??''} disabled={busy} onChange={e=>void update(r,{severity:e.target.value||null})}><option value="">noch offen</option>{FEEDBACK_SEVERITIES.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
    <label>Interne Notiz (nur für dich)<textarea defaultValue={r.operatorNote} maxLength={4000} rows={2} onBlur={e=>{if(e.target.value!==r.operatorNote)void update(r,{operatorNote:e.target.value});}}/></label>
    <label>Antwort an die meldende Person<textarea defaultValue={r.reply} maxLength={2000} rows={2} onBlur={e=>{if(e.target.value!==r.reply)void update(r,{reply:e.target.value});}}/></label>
   </div></article>)}</div>
  </details>}
 </section></>;
}
