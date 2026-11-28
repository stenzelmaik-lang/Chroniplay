"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Crossing player and SL surfaces deliberately clears client context. */
import { useEffect, useState } from 'react';
import {Clapperboard, Users, MapPin, Play, Images, FolderOpen, Download, UserRoundPlus, BookOpen, House, HeartHandshake, ArrowLeft, Palette, RotateCcw } from 'lucide-react';
import type { Actor } from '@/domain/types';
import { Toaster } from '@/components/ui/sonner';
import {MessageCenter} from './message-center';
import styles from './sl-workspace-shell.module.css';
import { useLive } from './live-state';
import { storyboardThemes, type StoryboardTheme } from './storyboard-themes';

/** The modules of the Command Center. `description` is the short line, `explain` what you do there (overview only). */
const preparationTools = [
  { name: 'Spielabende & Szenen', description: 'Abende planen und Geschichten vorbereiten', explain: 'Bücher, Spielabende und Szenen in der Werkbank vorbereiten – alles, was du am Tisch erzählst, zeigst und auslöst.', section: 'sitzung', icon: Clapperboard },
  { name: 'Spieler & Charaktere', description: 'Charaktere einsehen und Spieler einladen', explain: 'Die Charakterbögen deiner Runde prüfen, Spieler einladen und Zugänge verwalten.', section: 'charaktere', icon: Users },
  { name: 'Galerie', description: 'Bilder und Dateien finden, sortieren und verwalten', explain: 'Alle Bilder und Dateien der Kampagne an einem Ort: hochladen, sortieren, wiederfinden.', section: 'galerie', icon: Images },
  { name: 'Material', description: 'Dokumente und Unterlagen zum Ausspielen vorbereiten', explain: 'Briefe, Akten, Fotos und Ton als Material vorbereiten, das du am Tisch ausspielst.', section: 'vorbereitung', icon: FolderOpen },
  { name: 'NPCs', description: 'Nichtspielercharaktere anlegen, bearbeiten und freigeben', explain: 'Die Figuren deiner Welt: Akten anlegen, Bilder und Wissen pflegen, für Spieler freigeben.', section: 'nscs', icon: UserRoundPlus },
  { name: 'Gefallen & Schulden', description: 'Verpflichtungen prüfen und Krisen bearbeiten', explain: 'Wer wem was schuldet: Verpflichtungen prüfen, eintragen und Krisen klären.', section: 'gefallen', icon: HeartHandshake },
  { name: 'Orte', description: 'Schauplätze, Bereiche und Räume verwalten', explain: 'Orte, Bereiche und Räume der Welt pflegen – mit Karte und Freigaben für die Spieler.', section: 'ortscms', icon: MapPin },
  { name: 'Rückblicke & Chronik', description: 'Spielabende zusammenfassen, Chronik und Website pflegen', explain: 'Nach dem Abend: Zusammenfassungen schreiben, Ereignisse der Domäne festhalten und die Einleitung der öffentlichen Website pflegen.', section: 'rueckblick', icon: BookOpen },
];

type Resume = { book?: string; evening?: string; scene?: string; title?: string };
/** Overview = Command Center without a chosen area (`bereich` missing in the address). Read on the client only. */
const atOverview = () => !new URLSearchParams(window.location.search).get('bereich');

export function SLWorkspaceShell({a,section,navigate,children,preparationDirty=false}:{a:Actor;section:string;navigate:(id:string)=>void;children:React.ReactNode;preparationDirty?:boolean}) {
  const live = useLive();
  const tools = preparationTools.filter(tool=>a.role!=='campaign_editor'||tool.section==='ortscms');
  const themeKey = 'chroniplay-storyboard-theme:' + a.id, resumeKey = 'chroniplay-storyboard-resume:' + a.campaignId + ':' + a.id;
  const [overview, setOverview] = useState(false);
  const [theme, setTheme] = useState<StoryboardTheme>('nacht');
  const [resume, setResume] = useState<Resume | null>(null);
  useEffect(() => {
    const sync = () => setOverview(atOverview() && a.role !== 'campaign_editor');
    Promise.resolve().then(() => {
      sync();
      try {
        const t = localStorage.getItem(themeKey); if (t && storyboardThemes.some(x => x.id === t)) setTheme(t as StoryboardTheme);
        const r = JSON.parse(localStorage.getItem(resumeKey) || 'null'); if (r && typeof r.scene === 'string') setResume(r);
      } catch { /* per-viewer convenience only */ }
    });
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [themeKey, resumeKey, a.role]);
  function chooseTheme(next: StoryboardTheme) { setTheme(next); try { localStorage.setItem(themeKey, next); } catch { /* per-viewer convenience only */ } }
  function open(id: string) {
    if (preparationDirty) return;
    setOverview(false);
    if (id === 'sitzung' && section === 'sitzung') { window.history.pushState(null, '', '/sl/command-center?bereich=sitzung'); window.dispatchEvent(new PopStateEvent('popstate')); }
    else navigate(id);
  }
  function toOverview() {
    if (preparationDirty) return;
    window.history.pushState(null, '', '/sl/command-center');
    setOverview(true);
  }
  function resumeScene() {
    if (!resume?.scene) return;
    const q = new URLSearchParams({ bereich: 'sitzung', ...(resume.book ? { buch: resume.book } : {}), ...(resume.evening ? { abend: resume.evening } : {}), szene: resume.scene });
    setOverview(false);
    if (section !== 'sitzung') navigate('sitzung');
    // Same way the storyboard follows its own links: new address, then a popstate so it reads the route.
    window.history.pushState(null, '', '/sl/command-center?' + q.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  const current = tools.find(tool => tool.section === section);
  const CurrentIcon = current?.icon;
  return <div className={`${styles.shell} ${styles.central}`} data-cp-theme={theme === 'nacht' ? undefined : theme}>
    {a.status==='active'&&a.gm&&<MessageCenter key={a.campaignId+a.id} a={a} showTrigger={false}/>}
    <header className={styles.header}><a href="/" className={styles.brand}>CHRONIPLAY</a><strong>COMMAND CENTER · VORBEREITUNG</strong><span>{a.name} · Kampagnenredaktion</span>
      <nav className={styles.headerActions} aria-label="Wechseln">
        {a.gm&&<a href="/spielbereich?bereich=sitzung" className={styles.tableLink}><Play aria-hidden="true" size={15}/>Zum Spieltisch{live!==null&&<small data-live={live||undefined}>{live?"live":"nicht live"}</small>}</a>}
        <a href="/spielbereich"><House aria-hidden="true" size={15}/>Zur Zuflucht</a>
        {a.gm&&<a href="/api/export?scope=campaign" title="Gesamte Kampagne als Sicherung herunterladen"><Download aria-hidden="true" size={15}/>Kampagne sichern</a>}
        <details className={styles.themeMenu}>
          <summary aria-label="Farbmodell wählen" title="Farbmodell"><Palette size={15} aria-hidden="true"/></summary>
          <div role="menu" onClick={event => { (event.currentTarget.parentElement as HTMLDetailsElement).open = false; }}>
            {storyboardThemes.map(item => <button key={item.id} type="button" role="menuitemradio" aria-checked={theme === item.id} onClick={() => chooseTheme(item.id)}><i style={{ background: item.swatch }} aria-hidden="true"/>{item.label}</button>)}
          </div>
        </details>
      </nav></header>
    <main className={styles.content}>
      {overview ? <section className={styles.overview} aria-labelledby="cc-overview">
        <header className={styles.overviewHead}>
          <h1 id="cc-overview">Was bereitest du heute vor?</h1>
          <p>Wähle ein Modul. Die Seite gehört dann ganz diesem Bereich; über „Übersicht“ kommst du hierher zurück.</p>
          {resume?.scene && <button type="button" className={styles.resume} onClick={resumeScene}><RotateCcw size={15} aria-hidden="true"/>Weitermachen: {resume.title || 'zuletzt geöffnete Szene'}</button>}
        </header>
        <nav className={styles.modules} aria-label="Verwaltungsbereiche">
          {tools.map(tool => { const Icon = tool.icon; return <button key={tool.section} type="button" onClick={() => open(tool.section)}>
            <span className={styles.moduleIcon}><Icon aria-hidden="true" size={22}/></span>
            <span><strong>{tool.name}</strong><small>{tool.explain}</small></span>
          </button>; })}
        </nav>
      </section> : <>
        <nav className={styles.moduleBar} aria-label="Modul">
          {a.role !== 'campaign_editor' && <button type="button" onClick={toOverview} disabled={preparationDirty} title={preparationDirty ? 'Erst speichern oder verwerfen' : 'Zur Modulauswahl'}><ArrowLeft size={16} aria-hidden="true"/>Übersicht</button>}
          {current && CurrentIcon && <span className={styles.moduleName}><CurrentIcon size={17} aria-hidden="true"/><strong>{current.name}</strong><small>{current.description}</small></span>}
        </nav>
        {preparationDirty&&<p className={styles.unsavedNotice} role="status">Offene Eingaben: vor dem Bereichswechsel speichern oder im Editor bewusst verwerfen.</p>}
        {section==='charaktere'&&<div className={styles.inspection} role="status"><strong>SL-INSPEKTION · KAMPAGNENCHARAKTERE</strong><span>Du prüfst fremde Charaktere als Spielleitung. Du spielst sie nicht; persönliche Spielerauswahl bleibt getrennt.</span></div>}
        {section==='charaktere'&&a.gm&&<div className={styles.inviteEntry}><a href="/zugang/verwaltung"><UserRoundPlus size={17} aria-hidden="true"/> Spieler einladen und Einladungen verwalten</a></div>}
        {children}
      </>}
    </main>
    <Toaster position="bottom-right" theme="dark"/>
  </div>;
}
