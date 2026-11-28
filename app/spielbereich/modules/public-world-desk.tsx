"use client";
// Öffentliche Welt im Command Center: the website introduction ("Einleitung für die Website") and an overview of what
// guests see right now, what the caps cut, and how many marked entries the group does not know yet.
import { useEffect, useState } from "react";
import { ExternalLink, Save } from "lucide-react";
import { publicWorldIntroMaxPlain } from "@/domain/public-world";
import { defaultWorldIntro } from "@/app/kampagne/welt/content";
import { api } from "./api-client";
import { RichTextEditor, RichTextView } from "./rich-text";
import styles from "./recap-desk.module.css";
import own from "./public-world-desk.module.css";

type Section = { marked: number; limit: number; hint: string; items: { id: string; title: string; shown: boolean }[] };
type Overview = { intro: { text: string; version: number; publicText: string }; places: Section; people: Section; chronicle: Section };

function OverviewList({ title, section }: { title: string; section: Section }) {
  const shown = section.items.filter(item => item.shown).length;
  const waiting = Math.max(0, section.marked - section.items.length);
  return <section className={own.column} aria-label={title}>
    <h3>{title} <span>{shown} von höchstens {section.limit}</span></h3>
    <p>{section.hint}</p>
    {section.items.length ? <ol>{section.items.map(item => <li key={item.id} data-cut={!item.shown || undefined}>{item.title}{!item.shown && <small> · über der Obergrenze</small>}</li>)}</ol> : <p className={styles.empty}>Noch nichts auf der Website.</p>}
    {waiting > 0 && <p className={own.note}>{waiting} markiert, aber noch nicht für die Gruppe sichtbar.</p>}
  </section>;
}

export function PublicWorldDesk() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [text, setText] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    api<Overview>("/api/cms/public-world").then(data => {
      if (!live) return;
      setOverview(data); setText(data.intro.text); setEditorKey(key => key + 1); setError("");
    }).catch(e => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [reload]);
  async function save() {
    if (!overview) return;
    setBusy(true); setStatus("");
    try {
      const saved = await api<{ version: number; publicText: string }>("/api/cms/public-world", "POST", { text, expectedVersion: overview.intro.version });
      setOverview({ ...overview, intro: { text, version: saved.version, publicText: saved.publicText } });
      setStatus("Gespeichert. Gäste sehen die neue Einleitung sofort.");
    } catch (e) {
      setStatus((e as Error).message);
      if ((e as { status?: number }).status === 409) setReload(n => n + 1);
    } finally { setBusy(false); }
  }
  if (error) return <p role="alert" className="error-box">{error}</p>;
  if (!overview) return <p role="status">Website-Übersicht wird geladen …</p>;
  const dirty = text !== overview.intro.text;
  return <div className={own.desk}>
    <section className={styles.editor} aria-label="Einleitung für die Website">
      <div className={own.headRow}><h2>Einleitung für die Website</h2><a className="button" href="/kampagne/welt" target="_blank" rel="noopener"><ExternalLink size={15} aria-hidden="true" />Öffentliche Seite</a></div>
      <p className={styles.empty}>Worum geht es in der Chronik? Wenige Absätze genügen. Bilder und interne Links erscheinen nicht auf der Website.</p>
      <div className={styles.split}>
        <div><RichTextEditor key={editorKey} value={text} onChange={setText} label="Einleitung für die Website" placeholder="Kleve bei Nacht …" maximumPlainLength={publicWorldIntroMaxPlain} disabled={busy} /></div>
        <aside className={styles.preview} aria-label="So sehen es Gäste"><span>So sehen es Gäste</span>{overview.intro.publicText && !dirty ? <RichTextView value={overview.intro.publicText} readable /> : dirty ? <p className={styles.empty}>Nach dem Speichern siehst du hier die bereinigte Fassung.</p> : <p className={styles.empty}>Leer – Gäste lesen: „{defaultWorldIntro}“</p>}</aside>
      </div>
      <footer className={styles.actions}><button type="button" className="button primary" disabled={busy || !dirty} onClick={() => void save()}><Save size={16} aria-hidden="true" />Speichern</button><span role="status">{status}</span></footer>
    </section>
    <section className={own.overview} aria-label="Auf der Website">
      <h2>Auf der Website</h2>
      <p className={styles.empty}>Du wählst über „Auf der Website zeigen“ in den Orten, im NSC-Editor und hier bei den Chronik-Einträgen. Es erscheint nur, was auch die Gruppe sieht.</p>
      <div className={own.columns}>
        <OverviewList title="Orte" section={overview.places} />
        <OverviewList title="Persönlichkeiten" section={overview.people} />
        <OverviewList title="Chronik" section={overview.chronicle} />
      </div>
    </section>
  </div>;
}
