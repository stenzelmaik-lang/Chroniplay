/* eslint-disable @next/next/no-img-element -- Existing NPC image references only. */
"use client";
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, Lock, MapPin, PencilLine, Plus, Trash2, UserRound } from "lucide-react";
import { authoringTextMax } from "@/domain/authoring-limits";
import { richTextToPlainText } from "@/domain/location-rich-text";
import { stageEffects, type StageEffect } from "@/domain/live-stage";
import type { CommandReference } from "@/domain/command-workspace";
import { sceneCastLimits, sceneWorkshopLimits, type SceneCast, type SceneCastRole, type SceneContext, type SceneElement, type SceneMood, type ScenePassage, type ScenePlace } from "@/domain/story-scene";
import { castHasContent, newCast, newPlace, workshopAreas, type WorkshopArea } from "@/domain/scene-workshop";
import { PreparationNPCs } from "./preparation-npcs";
import { RichTextEditor, RichTextView } from "./rich-text";
import { SceneBackdropPicker, SceneYoutubePicker } from "./preparation-upload";
import type { PreparationFile } from "./protected-image-gallery";
import { effectLabels } from "./spieltisch/atmosphere";
import s from "./storyboard.module.css";

/** Szene 2.0, Etappe 1: the scene as a workshop. Area list, context, narration passages and moods.
 * The other areas reuse the existing tools (see storyboard.tsx). Nothing here plays anything out. */

const reachNames = { table: "Kommt an den Tisch", sl: "Nur für dich" } as const;

/** The outline of the scene: four chapters, every area with its reach (gold = the Regie can play it out at the table,
 * silver = only for the SL) and how much is in it. Empty areas stay reachable, just quieter. */
export function WorkshopNav({ active, fill, primary, onSelect }: { active: WorkshopArea; fill: Record<WorkshopArea, number>; primary: Set<WorkshopArea>; onSelect: (area: WorkshopArea) => void }) {
  return <nav className={s.wsNav} aria-label="Gliederung der Szene">
    {workshopAreas.map((area, index) => {
      const head = index === 0 || workshopAreas[index - 1].group !== area.group ? <h4>{area.group}</h4> : null;
      return <span key={area.id} className={s.wsNavItem}>{head}
        <button type="button" aria-current={active === area.id ? "page" : undefined} data-secondary={!primary.has(area.id) || undefined} data-empty={!fill[area.id] || undefined} onClick={() => onSelect(area.id)}>
          <i className={s.wsReach} data-reach={area.reach} title={reachNames[area.reach]} aria-label={reachNames[area.reach]} />
          <span>{area.label}</span><small>{fill[area.id] || ""}</small>
        </button>
      </span>;
    })}
    <p className={s.wsLegend}><span><i className={s.wsReach} data-reach="table" />am Tisch</span><span><i className={s.wsReach} data-reach="sl" />nur du</span></p>
  </nav>;
}

/** Area head: title, its reach, and – on request – what happens with it at the table. */
export function WorkshopHead({ area, children }: { area: WorkshopArea; children?: ReactNode }) {
  const info = workshopAreas.find(a => a.id === area)!;
  const [help, setHelp] = useState(false);
  return <header className={s.wsHead}>
    <div className={s.wsHeadRow}>
      <h3>{info.label}</h3>
      <span className={s.wsReachChip} data-reach={info.reach}><i className={s.wsReach} data-reach={info.reach} />{reachNames[info.reach]}</span>
      <button type="button" className={s.wsHelp} aria-expanded={help} aria-label={"Was passiert am Spieltisch mit „" + info.label + "“?"} onClick={() => setHelp(!help)}>?</button>
    </div>
    {children}
    {help && <p className={s.wsTable}>{info.table}</p>}
  </header>;
}

/** An older free-text field: folded away unless it already holds text, so the area stays calm. */
export function LegacyText({ label, filled, children }: { label: string; filled: boolean; children: ReactNode }) {
  return <details className={s.wsLegacy} open={filled || undefined}>
    <summary><Lock size={13} aria-hidden="true" />{label}<small>{filled ? "enthält Text" : "leer"}</small></summary>
    {children}
  </details>;
}

const emptyContext = (): SceneContext => ({ situation: "", purpose: "", prerequisites: "", entries: [], tone: "", ending: "open" });

export function ContextEditor({ value, onChange }: { value: SceneContext | undefined; onChange: (next: SceneContext) => void }) {
  const c = value || emptyContext();
  const [entry, setEntry] = useState("");
  const set = (patch: Partial<SceneContext>) => onChange({ ...c, ...patch });
  return <div className={s.wsGrid}>
    <label className={s.field}><span>Ausgangssituation</span><textarea rows={4} maxLength={sceneWorkshopLimits.short} value={c.situation} onChange={e => set({ situation: e.target.value })} placeholder="Was ist los, wenn die Szene beginnt? …" /></label>
    <label className={s.field}><span>Zweck in der Geschichte</span><textarea rows={4} maxLength={sceneWorkshopLimits.short} value={c.purpose} onChange={e => set({ purpose: e.target.value })} placeholder="Wozu dient die Szene? Was soll möglich werden? …" /></label>
    <label className={s.field}><span>Voraussetzungen</span><textarea rows={3} maxLength={sceneWorkshopLimits.short} value={c.prerequisites} onChange={e => set({ prerequisites: e.target.value })} placeholder="Was muss vorher geschehen sein – wenn überhaupt? …" /></label>
    <div>
      <label className={s.field}><span>Grundton</span><input maxLength={200} value={c.tone} onChange={e => set({ tone: e.target.value })} placeholder="z. B. beklemmend, intim, tragisch" /></label>
      <div className={s.field}><span>Ende</span><div className={s.seg}>
        <button type="button" aria-pressed={c.ending === "open"} onClick={() => set({ ending: "open" })}>Offen – entsteht im Spiel</button>
        <button type="button" aria-pressed={c.ending === "fixed"} onClick={() => set({ ending: "fixed" })}>Fester Ausgang</button>
      </div></div>
    </div>
    <div className={s.wsWide}>
      <span className={s.wsLabel}>Mögliche Einstiege</span>
      {c.entries.length > 0 && <ul className={s.wsList}>{c.entries.map((item, i) => <li key={i}><span>{item}</span><button type="button" className={s.ghost} aria-label={"Einstieg entfernen: " + item} onClick={() => set({ entries: c.entries.filter((_, n) => n !== i) })}><Trash2 size={14} aria-hidden="true" /></button></li>)}</ul>}
      {c.entries.length < sceneWorkshopLimits.entries && <form className={s.linkAdd} onSubmit={e => { e.preventDefault(); if (entry.trim()) { set({ entries: [...c.entries, entry.trim().slice(0, 300)] }); setEntry(""); } }}>
        <label className={s.field}><span className={s.srOnly}>Weiterer Einstieg</span><input value={entry} maxLength={300} onChange={e => setEntry(e.target.value)} placeholder="Wie kann die Runde hineinkommen? …" /></label>
        <button type="submit" className={s.ghost} disabled={!entry.trim()}><Plus size={14} aria-hidden="true" />Einstieg</button>
      </form>}
    </div>
  </div>;
}

/** Narration passages in their likely order. Text is read aloud (never played out); the direction is for the SL only. */
export function PassagesEditor({ passages, moods, onChange, onAsk }: { passages: ScenePassage[]; moods: SceneMood[]; onChange: (next: ScenePassage[]) => void; onAsk: (question: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState("");
  const update = (id: string, patch: Partial<ScenePassage>) => onChange(passages.map(p => p.id === id ? { ...p, ...patch } : p));
  const move = (i: number, d: number) => { const next = [...passages]; [next[i], next[i + d]] = [next[i + d], next[i]]; onChange(next); };
  async function remove(p: ScenePassage) {
    if (richTextToPlainText(p.text).trim() || p.direction.trim()) { if (!(await onAsk("Abschnitt „" + (p.title || "ohne Titel") + "“ mit seinem Text entfernen?"))) return; }
    onChange(passages.filter(x => x.id !== p.id));
  }
  function add() {
    const p: ScenePassage = { id: crypto.randomUUID(), title: "", text: "", direction: "", moodId: "" };
    onChange([...passages, p]); setEditing(p.id);
  }
  return <div className={s.wsPassages}>
    {passages.length === 0 && <p className={s.planBlank}>Noch kein Abschnitt. Ein Abschnitt ist ein Stück Erzählung, das du am Tisch vorliest – etwa Einstieg, Ortswechsel, Auftritt einer Figur.</p>}
    {passages.map((p, i) => {
      const hasText = !!richTextToPlainText(p.text).trim();
      return <article key={p.id} className={s.wsPassage}>
        <span className={s.wsNo}>{String(i + 1).padStart(2, "0")}</span>
        <div className={s.wsPassageBody}>
          <div className={s.wsPassageHead}>
            <label className={s.wsTitle}><span className={s.srOnly}>Titel des Abschnitts</span><input value={p.title} maxLength={sceneWorkshopLimits.title} onChange={e => update(p.id, { title: e.target.value })} placeholder={"Abschnitt " + (i + 1)} /></label>
            <span className={s.wsTools}>
              <button type="button" aria-label="Nach oben" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} aria-hidden="true" /></button>
              <button type="button" aria-label="Nach unten" disabled={i === passages.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} aria-hidden="true" /></button>
              <button type="button" aria-label="Abschnitt entfernen" onClick={() => void remove(p)}><Trash2 size={14} aria-hidden="true" /></button>
            </span>
          </div>
          {editing === p.id
            ? <div className={s.writer}><RichTextEditor key={p.id} label={"Vorlesetext " + (i + 1)} value={p.text} onChange={text => update(p.id, { text })} maximumPlainLength={authoringTextMax} placeholder="Was liest du vor? …" advanced htmlSource compactTools preparationTools inlineGallery={false} proseClassName={s.prose} />
              <div className={s.pageActions}><button type="button" className={s.primary} onClick={() => setEditing("")}>Fertig – Lesefassung zeigen</button></div></div>
            : <div className={s.reader}>{hasText ? <RichTextView value={p.text} readable flowing className={s.prose} /> : <p className={s.blank}>Noch kein Vorlesetext.</p>}
              <div className={s.pageActions}><button type="button" className={s.ghost} onClick={() => setEditing(p.id)}><PencilLine size={15} aria-hidden="true" />{hasText ? "Text bearbeiten" : "Text schreiben"}</button></div></div>}
          <label className={s.wsDirection}><span><Lock size={13} aria-hidden="true" /> Regie · nur für dich</span>
            <textarea rows={2} maxLength={sceneWorkshopLimits.direction} value={p.direction} onChange={e => update(p.id, { direction: e.target.value })} placeholder="z. B. langsam lesen, Pause lassen, Bild wechseln …" /></label>
          <div className={s.wsCue}>
            <label><span>Stimmung beim Aufruf</span>
              <select value={p.moodId} onChange={e => update(p.id, { moodId: e.target.value })}>
                <option value="">bleibt, wie sie ist</option>
                {moods.map(m => <option key={m.id} value={m.id}>wechselt zu „{m.name}“</option>)}
              </select></label>
            <span className={s.wsBadge}>wird vorgelesen, nicht ausgespielt</span>
          </div>
        </div>
      </article>;
    })}
    {passages.length < sceneWorkshopLimits.passages && <button type="button" className={s.ghost} onClick={add}><Plus size={15} aria-hidden="true" />Abschnitt hinzufügen</button>}
  </div>;
}

/** Named moods: picture, music and table effects together. One is the scene default (it starts with the scene). */
export function MoodsEditor({ moods, files, passages, onChange, onUploaded }: { moods: SceneMood[]; files: PreparationFile[]; passages: ScenePassage[]; onChange: (moods: SceneMood[], passages?: ScenePassage[]) => void; onUploaded: (file: PreparationFile) => void }) {
  const update = (id: string, patch: Partial<SceneMood>) => onChange(moods.map(m => m.id === id ? { ...m, ...patch } : m));
  const setDefault = (id: string) => onChange(moods.map(m => ({ ...m, isDefault: m.id === id })));
  function add() { onChange([...moods, { id: crypto.randomUUID(), name: "Neue Stimmung", backdropFileId: "", youtube: [], effects: [], isDefault: moods.length === 0 }]); }
  function remove(m: SceneMood) {
    const rest = moods.filter(x => x.id !== m.id);
    if (m.isDefault && rest.length) rest[0] = { ...rest[0], isDefault: true };
    onChange(rest, passages.map(p => p.moodId === m.id ? { ...p, moodId: "" } : p));
  }
  const toggleEffect = (m: SceneMood, effect: StageEffect) => update(m.id, { effects: m.effects.includes(effect) ? m.effects.filter(e => e !== effect) : [...m.effects, effect] });
  return <div className={s.wsMoods}>
    {moods.length === 0 && <p className={s.planBlank}>Noch keine Stimmung. Eine Stimmung bündelt Bild, Musik und Tischeffekte. Die Standardstimmung startet mit der Szene; Abschnitte können gezielt zu einer anderen wechseln.</p>}
    {moods.map(m => {
      const used = passages.filter(p => p.moodId === m.id).length;
      return <article key={m.id} className={s.wsMood} data-default={m.isDefault || undefined}>
        <div className={s.wsPassageHead}>
          <label className={s.wsTitle}><span className={s.srOnly}>Name der Stimmung</span><input value={m.name} maxLength={sceneWorkshopLimits.moodName} onChange={e => update(m.id, { name: e.target.value })} onBlur={() => { if (!m.name.trim()) update(m.id, { name: "Stimmung" }); }} /></label>
          <span className={s.wsTools}><button type="button" aria-label={"Stimmung entfernen: " + m.name} onClick={() => remove(m)}><Trash2 size={14} aria-hidden="true" /></button></span>
        </div>
        <label className={s.wsCheck}><input type="radio" name="sb-default-mood" checked={m.isDefault} onChange={() => setDefault(m.id)} /> Szenenstandard – startet mit der Szene</label>
        {used > 0 && <p className={s.viewHint}>Wechsel bei {used} {used === 1 ? "Abschnitt" : "Abschnitten"}.</p>}
        <div className={s.tools}>
          <SceneBackdropPicker fileId={m.backdropFileId} files={files} onChange={backdropFileId => update(m.id, { backdropFileId })} onUploaded={onUploaded} />
          <SceneYoutubePicker tracks={m.youtube} onChange={youtube => update(m.id, { youtube })} />
        </div>
        <div className={s.field}><span>Tischeffekte</span><div className={s.wsEffects}>
          {stageEffects.map(effect => <label key={effect} className={s.wsCheck}><input type="checkbox" checked={m.effects.includes(effect)} onChange={() => toggleEffect(m, effect)} /> {effectLabels[effect]}</label>)}
        </div></div>
      </article>;
    })}
    {moods.length < sceneWorkshopLimits.moods && <button type="button" className={s.ghost} onClick={add}><Plus size={15} aria-hidden="true" />Stimmung hinzufügen</button>}
  </div>;
}

const roleFields: [keyof SceneCastRole, string, string][] = [
  ["why", "Warum ist die Figur da?", "Auftrag, Zufall, eigene Absicht …"],
  ["wants", "Was will sie?", "Ziel in dieser Szene …"],
  ["knows", "Was weiß sie?", "Situatives Wissen …"],
  ["hides", "Was verschweigt sie?", "Und was müsste passieren, damit sie es sagt …"],
  ["reacts", "Worauf reagiert sie?", "Drohung, Mitgefühl, Fragen nach … "],
  ["intervenes", "Greift ein, wenn …", "z. B. jemand bedroht Emil"],
  ["leaves", "Verlässt die Szene, wenn …", "z. B. die Runde zu lange bleibt"],
];
const presenceNames: Record<SceneCast["presence"], string> = { start: "Von Beginn an", later: "Kommt später", maybe: "Vielleicht" };

/** Cast: NPCs from the world (references, never copies) with the SL's role for this scene and an addition for the
 * player card. The NPC dossier itself stays in the NPC management. */
export function CastEditor({ cast, references, persons, dialogues, onChange, onTakeoverPerson, onTakeoverDialogue, onAsk }: {
  cast: SceneCast[]; references: CommandReference[]; persons: SceneElement[]; dialogues: SceneElement[];
  onChange: (next: SceneCast[]) => void; onTakeoverPerson: (elementId: string) => void; onTakeoverDialogue: (elementId: string, castId: string) => void; onAsk: (question: string) => Promise<boolean>;
}) {
  const [expanded, setExpanded] = useState<string>(() => cast.find(castHasContent)?.id || "");
  const [dialogueTarget, setDialogueTarget] = useState<Record<string, string>>({});
  const byId = new Map(references.map(r => [r.id, r]));
  const name = (npcId: string) => byId.get(npcId)?.title || "NSC derzeit nicht verfügbar";
  const update = (id: string, patch: Partial<SceneCast>) => onChange(cast.map(c => c.id === id ? { ...c, ...patch } : c));
  const move = (i: number, d: number) => { const next = [...cast]; [next[i], next[i + d]] = [next[i + d], next[i]]; onChange(next); };
  async function pick(ids: string[]) {
    const lost = cast.filter(c => !ids.includes(c.npcId) && castHasContent(c));
    if (lost.length && !(await onAsk("Beteiligte mit Rolle entfernen: " + lost.map(c => name(c.npcId)).join(", ") + "?"))) return;
    const kept = new Map(cast.map(c => [c.npcId, c]));
    const next = ids.map(npcId => kept.get(npcId) || newCast(npcId));
    onChange(next);
    const added = next.find(c => !kept.has(c.npcId));
    if (added) setExpanded(added.id);
  }
  async function remove(c: SceneCast) {
    if (castHasContent(c) && !(await onAsk("„" + name(c.npcId) + "“ mit Rolle aus der Szene nehmen? Die NSC-Akte bleibt unverändert."))) return;
    onChange(cast.filter(x => x.id !== c.id));
  }
  return <div className={s.wsCastList}>
    <PreparationNPCs references={references} values={cast.map(c => c.npcId)} onChange={ids => void pick(ids)} />
    {cast.map((c, i) => {
      const ref = byId.get(c.npcId), open = expanded === c.id;
      const filled = roleFields.filter(([k]) => c.role[k].trim()).length + (c.dialogue.trim() ? 1 : 0);
      return <article key={c.id} className={s.wsCast} data-open={open || undefined}>
        <div className={s.wsCastHead}>
          {ref?.imagePrimary ? <img className={s.wsAvatar} src={ref.imagePrimary} alt="" loading="lazy" /> : <span className={s.wsAvatar}><UserRound size={20} aria-hidden="true" /></span>}
          <button type="button" className={s.wsCastName} aria-expanded={open} onClick={() => setExpanded(open ? "" : c.id)}>
            {open ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
            <span><b>{name(c.npcId)}</b><small>{filled ? filled + " von 8 Rollenangaben" : "Noch keine Rolle"}{c.cardNote.trim() ? " · Kartenzusatz" : ""}</small></span>
          </button>
          <div className={s.seg} role="group" aria-label={"Anwesenheit von " + name(c.npcId)}>
            {(Object.keys(presenceNames) as SceneCast["presence"][]).map(p => <button key={p} type="button" aria-pressed={c.presence === p} onClick={() => update(c.id, { presence: p })}>{presenceNames[p]}</button>)}
          </div>
          <span className={s.wsTools}>
            <button type="button" aria-label="Nach oben" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} aria-hidden="true" /></button>
            <button type="button" aria-label="Nach unten" disabled={i === cast.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} aria-hidden="true" /></button>
            <button type="button" aria-label={"Aus der Szene nehmen: " + name(c.npcId)} onClick={() => void remove(c)}><Trash2 size={14} aria-hidden="true" /></button>
          </span>
        </div>
        {open && <div className={s.wsCastBody}>
          <h4 className={s.wsSub}><Lock size={13} aria-hidden="true" /> Rolle in dieser Szene · nur für dich</h4>
          <div className={s.wsRoles}>
            {roleFields.map(([key, label, hint]) => <label key={key} className={s.field}><span>{label}</span>
              <textarea rows={2} maxLength={sceneCastLimits.field} value={c.role[key]} placeholder={hint} onChange={e => update(c.id, { role: { ...c.role, [key]: e.target.value } })} /></label>)}
          </div>
          <label className={s.field}><span>Dialoghilfen</span>
            <textarea rows={3} maxLength={sceneCastLimits.dialogue} value={c.dialogue} placeholder="Typische Sätze, Sprechweise, Ausweichen …" onChange={e => update(c.id, { dialogue: e.target.value })} /></label>
          <label className={s.wsCard}><span><Eye size={13} aria-hidden="true" /> Zusatz für die Spieler-Karte in dieser Szene</span>
            <textarea rows={2} maxLength={sceneCastLimits.cardNote} value={c.cardNote} placeholder="Was die Runde hier an der Figur bemerkt – z. B. „zittert, Blut an den Ärmeln“" onChange={e => update(c.id, { cardNote: e.target.value })} />
            <small>Erscheint später unter der Wiki-Karte, wenn du die Figur am Tisch zeigst. Die Wiki-Karte selbst bleibt unverändert.</small></label>
        </div>}
      </article>;
    })}
    {(persons.length > 0 || (dialogues.length > 0 && cast.length > 0)) && <section className={s.wsOffer}>
      <h4 className={s.wsSub}>Aus der klassischen Szene übernehmen</h4>
      <p className={s.viewHint}>Diese Bausteine stammen aus der bisherigen Szenenansicht. Übernehmen verschiebt den Text in die Rolle; Formatierung wird zu einfachem Text.</p>
      <ul className={s.wsList}>
        {persons.map(e => <li key={e.id}><span>Personenverweis „{e.title}“ · {name(e.referenceId)}</span><button type="button" className={s.ghost} onClick={() => onTakeoverPerson(e.id)}>Als Beteiligte übernehmen</button></li>)}
        {cast.length > 0 && dialogues.map(e => {
          const target = dialogueTarget[e.id] || cast[0].id;
          return <li key={e.id}><span>Dialog „{e.title}“ →
            <select aria-label={"Dialog übernehmen zu"} value={target} onChange={ev => setDialogueTarget(t => ({ ...t, [e.id]: ev.target.value }))}>{cast.map(c => <option key={c.id} value={c.id}>{name(c.npcId)}</option>)}</select></span>
            <button type="button" className={s.ghost} onClick={() => onTakeoverDialogue(e.id, target)}>Als Dialoghilfe übernehmen</button></li>;
        })}
      </ul>
    </section>}
  </div>;
}

/** Scene places: nodes of the place tree (location, area, room). The place data stays in the place management;
 * here only what is different in this scene and whether the SL may unlock it here. */
export function PlacesEditor({ places, placesOpen, references, offers, onChange, onTakeover, onAsk }: {
  places: ScenePlace[]; placesOpen: boolean; references: CommandReference[]; offers: SceneElement[];
  onChange: (places: ScenePlace[], placesOpen?: boolean) => void; onTakeover: (elementId: string) => void; onAsk: (question: string) => Promise<boolean>;
}) {
  const [choice, setChoice] = useState("");
  const options = references.filter(r => r.type === "PLACE").sort((a, b) => a.summary.localeCompare(b.summary, "de"));
  const byId = new Map(options.map(r => [r.id, r]));
  const label = (placeId: string) => byId.get(placeId)?.summary || byId.get(placeId)?.title || "Ort derzeit nicht verfügbar";
  const update = (id: string, patch: Partial<ScenePlace>) => onChange(places.map(p => p.id === id ? { ...p, ...patch } : p));
  function add() {
    if (!choice) return;
    onChange([...places, { ...newPlace(choice), main: !places.some(p => p.main) }]); setChoice("");
  }
  async function remove(p: ScenePlace) {
    if (p.note.trim() && !(await onAsk("Schauplatz „" + label(p.placeId) + "“ mit Notiz entfernen? Der Ort selbst bleibt unverändert."))) return;
    const rest = places.filter(x => x.id !== p.id);
    if (p.main && rest.length) rest[0] = { ...rest[0], main: true };
    onChange(rest);
  }
  const free = options.filter(r => !places.some(p => p.placeId === r.id));
  return <div className={s.wsPlaces}>
    {places.length === 0 && !placesOpen && <p className={s.planBlank}>Noch kein Schauplatz. Wähle Orte, Bereiche oder Räume aus der Ortsverwaltung – keinen, einen oder mehrere.</p>}
    {places.map(p => <article key={p.id} className={s.wsPlace} data-main={p.main || undefined}>
      <div className={s.wsCastHead}>
        <span className={s.wsAvatar}><MapPin size={18} aria-hidden="true" /></span>
        <span className={s.wsCastName}><span><b>{label(p.placeId)}</b><small>{p.main ? "Hauptschauplatz" : "Weiterer Schauplatz"}{p.unlockable ? " · freischaltbar" : ""}</small></span></span>
        <span className={s.wsTools}><button type="button" aria-label={"Schauplatz entfernen: " + label(p.placeId)} onClick={() => void remove(p)}><Trash2 size={14} aria-hidden="true" /></button></span>
      </div>
      <div className={s.wsPlaceFlags}>
        <label className={s.wsCheck}><input type="radio" name="sb-main-place" checked={p.main} onChange={() => onChange(places.map(x => ({ ...x, main: x.id === p.id })))} /> Hauptschauplatz</label>
        <label className={s.wsCheck}><input type="checkbox" checked={p.unlockable} onChange={() => update(p.id, { unlockable: !p.unlockable })} /> In dieser Szene freischaltbar</label>
      </div>
      {p.unlockable && <p className={s.viewHint}>Am Tisch schaltest du den Ort über die Karte frei. Danach sehen die Spieler seine Infos dauerhaft im Wiki.</p>}
      <label className={s.wsDirection}><span><Lock size={13} aria-hidden="true" /> Was ist hier in dieser Szene anders · nur für dich</span>
        <textarea rows={2} maxLength={sceneCastLimits.placeNote} value={p.note} placeholder="z. B. Tür zugestellt, Licht aus, Emil schläft in der Nische …" onChange={e => update(p.id, { note: e.target.value })} /></label>
    </article>)}
    {places.length < sceneCastLimits.places && <div className={s.linkAdd}>
      <label className={s.field}><span className={s.srOnly}>Ort, Bereich oder Raum</span>
        <select value={choice} onChange={e => setChoice(e.target.value)}>
          <option value="">Ort, Bereich oder Raum wählen …</option>
          {free.map(r => <option key={r.id} value={r.id}>{r.summary || r.title}</option>)}
        </select></label>
      <button type="button" className={s.ghost} disabled={!choice} onClick={add}><Plus size={14} aria-hidden="true" />Schauplatz</button>
    </div>}
    <label className={s.wsCheck}><input type="checkbox" checked={placesOpen} onChange={() => onChange(places, !placesOpen)} /> Der Schauplatz entsteht erst im Spiel</label>
    {offers.length > 0 && <section className={s.wsOffer}>
      <h4 className={s.wsSub}>Aus der klassischen Szene übernehmen</h4>
      <ul className={s.wsList}>{offers.map(e => <li key={e.id}><span>Ortsverweis „{e.title}“ · {label(e.referenceId)}</span><button type="button" className={s.ghost} onClick={() => onTakeover(e.id)}>Als Schauplatz übernehmen</button></li>)}</ul>
    </section>}
    <p className={s.viewHint}>Ortsdaten, Bilder und Karte bleiben in der Ortsverwaltung.</p>
  </div>;
}
