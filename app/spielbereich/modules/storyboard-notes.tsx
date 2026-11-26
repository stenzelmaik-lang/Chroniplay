"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, NotebookPen, Pencil, Plus, Trash2, X } from "lucide-react";
import type { CommandReference, MomentView } from "@/domain/command-workspace";
import { eventStateNames, momentKindNames, type EventState } from "@/domain/command-workspace";
import { today } from "@/domain/notebook";
import { emptyRefs, slNoteKindNames, slNoteKinds, type SlNote, type SlNoteKind, type SlNoteRefs } from "@/domain/sl-notes";
import type { SceneCast, ScenePlace } from "@/domain/story-scene";
import { RichTextView } from "./rich-text";
import { api } from "./api-client";
import s from "./storyboard.module.css";

/** Szene 2.0, Etappe 6: notes about this scene. SL notes are pages of the SL's own notebook with references (this
 * scene, optionally figures, places, the evening). Moments recorded at the table stay in the play log and are shown
 * here read-only. Nothing here reaches players. */

type Draft = { id: string; version: number; kind: SlNoteKind; text: string; refs: SlNoteRefs };
const fresh = (sceneId: string): Draft => ({ id: "", version: 0, kind: "note", text: "", refs: { ...emptyRefs(), sceneIds: [sceneId] } });

export function NotesArea({ sceneId, sessionId, cast, places, references, onCount, onAsk }: {
  sceneId: string; sessionId: string; cast: SceneCast[]; places: ScenePlace[]; references: CommandReference[];
  onCount: (count: number) => void; onAsk: (question: string) => Promise<boolean>;
}) {
  const [notes, setNotes] = useState<SlNote[]>([]), [moments, setMoments] = useState<MomentView[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => fresh(sceneId));
  const name = new Map(references.map(r => [r.id, r.summary && r.type === "PLACE" ? r.summary : r.title]));
  const load = useCallback(async () => {
    const [n, m] = await Promise.all([
      api<{ notes: SlNote[] }>("/api/command-center/notes?sceneId=" + encodeURIComponent(sceneId)),
      api<{ moments: MomentView[] }>("/api/command-center/moments").catch(() => ({ moments: [] as MomentView[] })),
    ]);
    setNotes(n.notes); setMoments(m.moments.filter(x => x.sceneId === sceneId));
    onCount(n.notes.length);
  }, [sceneId, onCount]);
  useEffect(() => { let live = true; Promise.resolve().then(() => live ? load() : undefined).catch(e => { if (live) setError((e as Error).message); }); return () => { live = false; }; }, [load]);

  const toggleRef = (key: keyof SlNoteRefs, id: string) => setDraft(d => ({ ...d, refs: { ...d.refs, [key]: d.refs[key].includes(id) ? d.refs[key].filter(x => x !== id) : [...d.refs[key], id].slice(0, 10) } }));
  async function save() {
    if (!draft.text.trim()) return;
    setBusy(true); setError("");
    try {
      await api("/api/command-center/notes", "POST", { action: "save", ...(draft.id ? { id: draft.id, version: draft.version } : {}), title: "", text: draft.text, date: today(), tags: [], kind: draft.kind, refs: draft.refs });
      setDraft(fresh(sceneId)); await load();
    } catch (e) { setError((e as Error).message + " Dein Entwurf bleibt erhalten."); } finally { setBusy(false); }
  }
  async function remove(n: SlNote) {
    if (!(await onAsk("Notiz löschen? Sie verschwindet auch aus deinem Notizbuch."))) return;
    try { await api("/api/command-center/notes", "POST", { action: "delete", id: n.id, version: n.version }); await load(); } catch (e) { setError((e as Error).message); }
  }
  const edit = (n: SlNote) => setDraft({ id: n.id, version: n.version, kind: n.kind, text: n.text, refs: { ...n.refs, sceneIds: n.refs.sceneIds.includes(sceneId) ? n.refs.sceneIds : [...n.refs.sceneIds, sceneId] } });
  const chips = (n: SlNote) => [...n.refs.npcIds, ...n.refs.placeIds].map(id => name.get(id) || "nicht verfügbar").concat(n.refs.sessionIds.length ? ["Spielabend"] : []).concat(n.refs.sceneIds.length > 1 ? [n.refs.sceneIds.length - 1 + " weitere Szene(n)"] : []);

  return <div className={s.wsCards}>
    {error && <p className={s.wsError} role="alert">{error}</p>}
    <article className={s.wsCardItem} data-tone="draft">
      <div className={s.seg} role="group" aria-label="Art der Notiz">{slNoteKinds.map(k => <button key={k} type="button" aria-pressed={draft.kind === k} onClick={() => setDraft(d => ({ ...d, kind: k }))}>{slNoteKindNames[k]}</button>)}</div>
      <label className={s.field}><span className={s.srOnly}>Notiz</span><textarea rows={3} maxLength={30000} value={draft.text} placeholder="Was willst du dir merken? z. B. „Die zugestellte Tür später aufgreifen“" onChange={e => setDraft(d => ({ ...d, text: e.target.value }))} /></label>
      {(cast.length > 0 || places.length > 0 || sessionId) && <fieldset className={s.wsLinkGroup}><legend>Auch beziehen auf</legend>
        {cast.map(c => <label key={c.id} className={s.wsChip} data-on={draft.refs.npcIds.includes(c.npcId) || undefined}><input type="checkbox" checked={draft.refs.npcIds.includes(c.npcId)} onChange={() => toggleRef("npcIds", c.npcId)} />{name.get(c.npcId) || "NSC"}</label>)}
        {places.map(p => <label key={p.id} className={s.wsChip} data-on={draft.refs.placeIds.includes(p.placeId) || undefined}><input type="checkbox" checked={draft.refs.placeIds.includes(p.placeId)} onChange={() => toggleRef("placeIds", p.placeId)} />{name.get(p.placeId) || "Ort"}</label>)}
        {sessionId && <label className={s.wsChip} data-on={draft.refs.sessionIds.includes(sessionId) || undefined}><input type="checkbox" checked={draft.refs.sessionIds.includes(sessionId)} onChange={() => toggleRef("sessionIds", sessionId)} />diesen Spielabend</label>}
      </fieldset>}
      <div className={s.wsCardActions}>
        <small className={s.viewHint}>Landet auch in deinem Notizbuch – nur für dich.</small>
        <span className={s.wsShelfActions}>
          {draft.id && <button type="button" className={s.ghost} onClick={() => setDraft(fresh(sceneId))}><X size={14} aria-hidden="true" />Abbrechen</button>}
          <button type="button" className={s.primary} disabled={busy || !draft.text.trim()} onClick={() => void save()}>{draft.id ? <><Check size={15} aria-hidden="true" />Speichern</> : <><Plus size={15} aria-hidden="true" />Notiz festhalten</>}</button>
        </span>
      </div>
    </article>
    {notes.map(n => <article key={n.id} className={s.wsCardItem} data-tone={n.kind}>
      <div className={s.wsCardActions}>
        <span className={s.wsBadge}>{slNoteKindNames[n.kind]} · {new Date(n.updatedAt).toLocaleDateString("de-DE")}</span>
        <span className={s.wsTools}>
          {!n.rich && <button type="button" aria-label="Notiz bearbeiten" onClick={() => edit(n)}><Pencil size={14} aria-hidden="true" /></button>}
          <button type="button" aria-label="Notiz löschen" onClick={() => void remove(n)}><Trash2 size={14} aria-hidden="true" /></button>
        </span>
      </div>
      {n.rich ? <RichTextView value={n.text} readable flowing className={s.prose} /> : <p className={s.wsNoteText}>{n.text}</p>}
      {chips(n).length > 0 && <p className={s.wsChips}>{chips(n).map((c, i) => <span key={i} className={s.wsChip} data-on>{c}</span>)}</p>}
    </article>)}
    {moments.length > 0 && <section className={s.wsOffer}>
      <h4 className={s.wsSub}><NotebookPen size={13} aria-hidden="true" /> Am Tisch festgehalten · {moments.length}</h4>
      <ul className={s.wsList}>{moments.map(m => <li key={m.id}><span>{m.text}<small> · {momentKindNames[m.kind]}{m.eventState && m.eventState in eventStateNames ? " · " + eventStateNames[m.eventState as EventState] : ""} · {new Date(m.occurredAt).toLocaleDateString("de-DE")}</small></span></li>)}</ul>
    </section>}
  </div>;
}
