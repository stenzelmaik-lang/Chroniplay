"use client";
// Öffentliche Welt im Command Center: one place to choose what guests see. Every entry the group already knows has a
// checkmark; "Für die Website freigeben" saves all changes at once. Below: the website introduction.
import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Save } from "lucide-react";
import { publicWorldIntroMaxPlain, publicWorldLimits, publicWorldOrderHints } from "@/domain/public-world";
import { defaultWorldIntro } from "@/app/kampagne/welt/content";
import { api } from "./api-client";
import { RichTextEditor, RichTextView } from "./rich-text";
import styles from "./recap-desk.module.css";
import own from "./public-world-desk.module.css";

type Section = { marked: number; limit: number; hint: string; items: { id: string; title: string; shown: boolean }[] };
type Candidate = { id: string; title: string; marked: boolean };
type Kind = "places" | "people" | "chronicle";
type Overview = {
  intro: { text: string; version: number; publicText: string };
  candidates: Record<Kind, Candidate[]>;
  places: Section; people: Section; chronicle: Section;
};
const titles: Record<Kind, string> = { places: "Orte", people: "Persönlichkeiten", chronicle: "Chronik" };
const kinds: Kind[] = ["places", "people", "chronicle"];

export function PublicWorldDesk() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [picked, setPicked] = useState<Record<Kind, Set<string>>>({ places: new Set(), people: new Set(), chronicle: new Set() });
  const [text, setText] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [releaseStatus, setReleaseStatus] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    api<Overview>("/api/cms/public-world").then(data => {
      if (!live) return;
      setOverview(data);
      setPicked({ places: new Set(data.candidates.places.filter(c => c.marked).map(c => c.id)), people: new Set(data.candidates.people.filter(c => c.marked).map(c => c.id)), chronicle: new Set(data.candidates.chronicle.filter(c => c.marked).map(c => c.id)) });
      setText(data.intro.text); setEditorKey(key => key + 1); setError("");
    }).catch(e => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [reload]);
  const changed = useMemo(() => !!overview && kinds.some(kind => overview.candidates[kind].some(c => c.marked !== picked[kind].has(c.id))), [overview, picked]);
  function toggle(kind: Kind, id: string, on: boolean) {
    setReleaseStatus("");
    setPicked(current => { const next = new Set(current[kind]); if (on) next.add(id); else next.delete(id); return { ...current, [kind]: next }; });
  }
  async function release() {
    if (!overview) return;
    setBusy(true); setReleaseStatus("");
    try {
      // The server changes only listed entries; a marked entry the group cannot see yet keeps its mark.
      const saved = await api<{ changed: number }>("/api/cms/public-world/release", "POST", { places: [...picked.places], people: [...picked.people], chronicle: [...picked.chronicle] });
      setReleaseStatus(saved.changed ? "Freigegeben. Die Website zeigt jetzt deine Auswahl." : "Keine Änderung.");
      setReload(n => n + 1);
    } catch (e) { setReleaseStatus((e as Error).message); }
    finally { setBusy(false); }
  }
  async function saveIntro() {
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
  if (!overview) return <p role="status">Website-Auswahl wird geladen …</p>;
  const releaseButton = <button type="button" className="button primary" disabled={busy || !changed} onClick={() => void release()}><Check size={16} aria-hidden="true" />Für die Website freigeben</button>;
  const dirty = text !== overview.intro.text;
  return <div className={own.desk}>
    <section className={own.overview} aria-label="Auswahl für die Website">
      <div className={own.headRow}><h2>Auswahl für die Website</h2><span className={own.actions}>{releaseButton}<a className="button" href="/kampagne/welt" target="_blank" rel="noopener"><ExternalLink size={15} aria-hidden="true" />Öffentliche Seite</a></span></div>
      <p className={styles.empty}>Hier steht alles, was die Gruppe schon kennt. Setze ein Häkchen bei dem, was Gäste sehen sollen, und gib frei.</p>
      {releaseStatus && <p role="status" className={own.status}>{releaseStatus}</p>}
      <div className={own.columns}>
        {kinds.map(kind => {
          const limit = publicWorldLimits[kind];
          const list = overview.candidates[kind];
          const checkedInOrder = list.filter(c => picked[kind].has(c.id)).map(c => c.id);
          const waiting = Math.max(0, overview[kind].marked - list.filter(c => c.marked).length);
          return <fieldset key={kind} className={own.column}>
            <legend>{titles[kind]} <span>{Math.min(checkedInOrder.length, limit)} von höchstens {limit}</span></legend>
            <p>{publicWorldOrderHints[kind]}</p>
            {list.length ? <ul>{list.map(c => {
              const on = picked[kind].has(c.id), rank = checkedInOrder.indexOf(c.id);
              return <li key={c.id}><label className={own.check} data-cut={on && rank >= limit || undefined}>
                <input type="checkbox" checked={on} disabled={busy} onChange={event => toggle(kind, c.id, event.target.checked)} />
                <span>{c.title}{on && rank >= limit && <small> · über der Obergrenze</small>}</span>
              </label></li>;
            })}</ul> : <p className={styles.empty}>Noch nichts, was die Gruppe kennt.</p>}
            {waiting > 0 && <p className={own.note}>{waiting} markiert, aber noch nicht für die Gruppe sichtbar.</p>}
          </fieldset>;
        })}
      </div>
      <footer className={styles.actions}>{releaseButton}{changed && <span>Ungespeicherte Auswahl</span>}</footer>
    </section>
    <section className={styles.editor} aria-label="Einleitung für die Website">
      <h2 className={own.subhead}>Einleitung für die Website</h2>
      <p className={styles.empty}>Worum geht es in der Chronik? Wenige Absätze genügen. Bilder und interne Links erscheinen nicht auf der Website.</p>
      <div className={styles.split}>
        <div><RichTextEditor key={editorKey} value={text} onChange={setText} label="Einleitung für die Website" placeholder="Kleve bei Nacht …" maximumPlainLength={publicWorldIntroMaxPlain} disabled={busy} /></div>
        <aside className={styles.preview} aria-label="So sehen es Gäste"><span>So sehen es Gäste</span>{overview.intro.publicText && !dirty ? <RichTextView value={overview.intro.publicText} readable /> : dirty ? <p className={styles.empty}>Nach dem Speichern siehst du hier die bereinigte Fassung.</p> : <p className={styles.empty}>Leer – Gäste lesen: „{defaultWorldIntro}“</p>}</aside>
      </div>
      <footer className={styles.actions}><button type="button" className="button primary" disabled={busy || !dirty} onClick={() => void saveIntro()}><Save size={16} aria-hidden="true" />Einleitung speichern</button><span role="status">{status}</span></footer>
    </section>
  </div>;
}
