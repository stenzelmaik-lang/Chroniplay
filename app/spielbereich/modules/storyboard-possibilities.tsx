"use client";
import { useState } from "react";
import { Eye, EyeOff, Link2, Lock, PencilLine, Plus, Timer, Trash2 } from "lucide-react";
import { authoringTextMax } from "@/domain/authoring-limits";
import type { CommandReference } from "@/domain/command-workspace";
import { richTextToPlainText } from "@/domain/location-rich-text";
import { availabilityNames, eventScopeNames } from "@/domain/scene-possibilities";
import { scenePossibilityLimits, type SceneDocument, type SceneEvent, type SceneInsight, type SceneInteractionCard } from "@/domain/story-scene";
import { RichTextEditor, RichTextView } from "./rich-text";
import s from "./storyboard.module.css";

/** Szene 2.0, Etappe 4: insights, interaction cards and events. All optional, no fixed order (except the list order
 * you choose). Discovery is recorded at the table only (knowledge); events are triggered by the SL, never by
 * themselves. */

type Ask = (question: string) => Promise<boolean>;
const replace = <T extends { id: string }>(list: T[], id: string, patch: Partial<T>) => list.map(x => x.id === id ? { ...x, ...patch } : x);

export function InsightsEditor({ insights, references, onChange, onAsk }: { insights: SceneInsight[]; references: CommandReference[]; onChange: (next: SceneInsight[]) => void; onAsk: Ask }) {
  const [editing, setEditing] = useState("");
  const clues = references.filter(r => r.type === "CLUE" || r.type === "HANDOUT");
  const clueName = new Map(clues.map(c => [c.id, c.title]));
  function add() { const i: SceneInsight = { id: crypto.randomUUID(), title: "", text: "", availability: "discoverable", howFound: "", clueId: "" }; onChange([...insights, i]); setEditing(i.id); }
  async function remove(i: SceneInsight) {
    if ((richTextToPlainText(i.text).trim() || i.howFound.trim()) && !(await onAsk("Erkenntnis „" + (i.title || clueName.get(i.clueId) || "ohne Titel") + "“ entfernen?"))) return;
    onChange(insights.filter(x => x.id !== i.id));
  }
  return <div className={s.wsCards}>
    {!insights.length && <p className={s.planBlank}>Noch keine Erkenntnis. Was können die Spieler hier erfahren – von Anfang an, durch Nachforschen oder gar nicht (nur du)? Entdeckt wird erst am Tisch, wenn du es markierst.</p>}
    {insights.map(i => {
      const hasText = !!richTextToPlainText(i.text).trim();
      return <article key={i.id} className={s.wsCardItem} data-tone={i.availability}>
        <div className={s.wsPassageHead}>
          <label className={s.wsTitle}><span className={s.srOnly}>Titel der Erkenntnis</span><input value={i.title} maxLength={scenePossibilityLimits.title} placeholder={clueName.get(i.clueId) || "Was erfährt man?"} onChange={e => onChange(replace(insights, i.id, { title: e.target.value }))} /></label>
          <span className={s.wsTools}><button type="button" aria-label="Erkenntnis entfernen" onClick={() => void remove(i)}><Trash2 size={14} aria-hidden="true" /></button></span>
        </div>
        <div className={s.seg} role="group" aria-label="Verfügbarkeit">
          {(Object.keys(availabilityNames) as SceneInsight["availability"][]).map(a => <button key={a} type="button" aria-pressed={i.availability === a} onClick={() => onChange(replace(insights, i.id, { availability: a }))}>{a === "gm" ? <Lock size={12} aria-hidden="true" /> : a === "known" ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />} {availabilityNames[a]}</button>)}
        </div>
        {editing === i.id
          ? <div className={s.writer}><RichTextEditor key={i.id} label="Inhalt der Erkenntnis" value={i.text} onChange={text => onChange(replace(insights, i.id, { text }))} maximumPlainLength={authoringTextMax} placeholder="Was genau ist die Erkenntnis? …" compactTools inlineGallery={false} proseClassName={s.prose} />
            <div className={s.pageActions}><button type="button" className={s.primary} onClick={() => setEditing("")}>Fertig</button></div></div>
          : <div className={s.reader}>{hasText ? <RichTextView value={i.text} readable flowing className={s.prose} /> : <p className={s.blank}>Noch kein Inhalt.</p>}
            <div className={s.pageActions}><button type="button" className={s.ghost} onClick={() => setEditing(i.id)}><PencilLine size={15} aria-hidden="true" />{hasText ? "Bearbeiten" : "Inhalt schreiben"}</button></div></div>}
        {i.availability !== "known" && <label className={s.wsDirection}><span><Lock size={13} aria-hidden="true" /> {i.availability === "gm" ? "Wann du es preisgibst – wenn überhaupt" : "Fundweg · wie man es entdeckt"}</span>
          <textarea rows={2} maxLength={scenePossibilityLimits.long} value={i.howFound} placeholder="z. B. Emil untersuchen, Gespräch mit Avi, Akte lesen …" onChange={e => onChange(replace(insights, i.id, { howFound: e.target.value }))} /></label>}
        <label className={s.field}><span>Hinweis- oder Handout-Akte der Welt (optional)</span>
          <select value={i.clueId} onChange={e => onChange(replace(insights, i.id, { clueId: e.target.value }))}>
            <option value="">– keine –</option>
            {clues.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            {i.clueId && !clueName.has(i.clueId) && <option value={i.clueId}>Akte derzeit nicht verfügbar</option>}
          </select></label>
      </article>;
    })}
    {insights.length < scenePossibilityLimits.insights && <button type="button" className={s.ghost} onClick={add}><Plus size={15} aria-hidden="true" />Erkenntnis hinzufügen</button>}
  </div>;
}

type LinkOption = { id: string; title: string };
function LinkPicker({ label, options, values, onChange }: { label: string; options: LinkOption[]; values: string[]; onChange: (ids: string[]) => void }) {
  if (!options.length) return null;
  return <fieldset className={s.wsLinkGroup}><legend>{label}</legend>
    {options.map(o => <label key={o.id} className={s.wsChip} data-on={values.includes(o.id) || undefined}><input type="checkbox" checked={values.includes(o.id)} onChange={() => onChange(values.includes(o.id) ? values.filter(v => v !== o.id) : [...values, o.id].slice(0, scenePossibilityLimits.refs))} />{o.title}</label>)}
  </fieldset>;
}

export function InteractionCardsEditor({ cards, doc, references, onChange, onAsk }: { cards: SceneInteractionCard[]; doc: SceneDocument; references: CommandReference[]; onChange: (next: SceneInteractionCard[]) => void; onAsk: Ask }) {
  const [linking, setLinking] = useState("");
  const clueName = new Map(references.map(r => [r.id, r.title]));
  const uses: LinkOption[] = (doc.materialUses || []).map(u => ({ id: u.id, title: doc.elements.find(e => e.id === u.id)?.title || "Material" }));
  const insights: LinkOption[] = (doc.insights || []).map(i => ({ id: i.id, title: i.title || clueName.get(i.clueId) || "Erkenntnis" }));
  const checks: LinkOption[] = doc.elements.filter(e => e.kind === "check").map(e => ({ id: e.id, title: e.title }));
  const events: LinkOption[] = (doc.events || []).map(e => ({ id: e.id, title: e.title }));
  const titleOf = new Map([...uses, ...insights, ...checks, ...events].map(o => [o.id, o.title]));
  function add() { const c: SceneInteractionCard = { id: crypto.randomUUID(), when: "", then: "", materialUseIds: [], insightIds: [], checkIds: [], eventIds: [] }; onChange([...cards, c]); }
  async function remove(c: SceneInteractionCard) {
    if ((c.when.trim() || c.then.trim()) && !(await onAsk("Interaktionskarte entfernen?"))) return;
    onChange(cards.filter(x => x.id !== c.id));
  }
  const nothingToLink = !uses.length && !insights.length && !checks.length && !events.length;
  return <div className={s.wsCardGrid}>
    {!cards.length && <p className={s.planBlank}>Noch keine Karte. Eine Karte hält fest, was passieren kann – „Wenn die Spieler … dann …“ – ohne Reihenfolge und ohne Pflicht.</p>}
    {cards.map(c => {
      const links = [...c.materialUseIds, ...c.insightIds, ...c.checkIds, ...c.eventIds];
      return <article key={c.id} className={s.wsCardItem}>
        <label className={s.field}><span>Wenn die Spieler …</span><input maxLength={scenePossibilityLimits.short} value={c.when} placeholder="z. B. Emil beruhigen" onChange={e => onChange(replace(cards, c.id, { when: e.target.value }))} /></label>
        <label className={s.field}><span>… dann</span><textarea rows={3} maxLength={scenePossibilityLimits.long} value={c.then} placeholder="z. B. erzählt er vom Labor" onChange={e => onChange(replace(cards, c.id, { then: e.target.value }))} /></label>
        {links.length > 0 && <p className={s.wsChips}>{links.map(id => <span key={id} className={s.wsChip} data-on>{titleOf.get(id) || "nicht verfügbar"}</span>)}</p>}
        <div className={s.wsCardActions}>
          <button type="button" className={s.ghost} disabled={nothingToLink} aria-expanded={linking === c.id} onClick={() => setLinking(linking === c.id ? "" : c.id)}><Link2 size={14} aria-hidden="true" />{nothingToLink ? "Noch nichts zum Verknüpfen" : "Verknüpfen"}</button>
          <span className={s.wsTools}><button type="button" aria-label="Karte entfernen" onClick={() => void remove(c)}><Trash2 size={14} aria-hidden="true" /></button></span>
        </div>
        {linking === c.id && <div className={s.wsLinks}>
          <LinkPicker label="Material" options={uses} values={c.materialUseIds} onChange={ids => onChange(replace(cards, c.id, { materialUseIds: ids }))} />
          <LinkPicker label="Erkenntnisse" options={insights} values={c.insightIds} onChange={ids => onChange(replace(cards, c.id, { insightIds: ids }))} />
          <LinkPicker label="Proben" options={checks} values={c.checkIds} onChange={ids => onChange(replace(cards, c.id, { checkIds: ids }))} />
          <LinkPicker label="Ereignisse" options={events} values={c.eventIds} onChange={ids => onChange(replace(cards, c.id, { eventIds: ids }))} />
        </div>}
      </article>;
    })}
    {cards.length < scenePossibilityLimits.cards && <button type="button" className={s.ghost} onClick={add}><Plus size={15} aria-hidden="true" />Karte hinzufügen</button>}
  </div>;
}

export function EventsEditor({ events, onChange, onAsk }: { events: SceneEvent[]; onChange: (next: SceneEvent[]) => void; onAsk: Ask }) {
  function add() { onChange([...events, { id: crypto.randomUUID(), title: "Neues Ereignis", trigger: "", effect: "", followUps: "", scope: "scene", timerMinutes: 0, timerVisible: false, manualOnly: true }]); }
  async function remove(e: SceneEvent) {
    if ((e.trigger.trim() || e.effect.trim() || e.followUps.trim()) && !(await onAsk("Ereignis „" + e.title + "“ entfernen?"))) return;
    onChange(events.filter(x => x.id !== e.id));
  }
  return <div className={s.wsCards}>
    {!events.length && <p className={s.planBlank}>Noch kein Ereignis. Ein Ereignis kann eintreten – du entscheidest am Tisch, ob und wann: auslösen, verschieben, überspringen oder verwerfen.</p>}
    {events.map(e => <article key={e.id} className={s.wsCardItem} data-tone="event">
      <div className={s.wsPassageHead}>
        <label className={s.wsTitle}><span className={s.srOnly}>Titel des Ereignisses</span><input value={e.title} maxLength={scenePossibilityLimits.title} onChange={ev => onChange(replace(events, e.id, { title: ev.target.value }))} onBlur={() => { if (!e.title.trim()) onChange(replace(events, e.id, { title: "Ereignis" })); }} /></label>
        <span className={s.wsTools}><button type="button" aria-label={"Ereignis entfernen: " + e.title} onClick={() => void remove(e)}><Trash2 size={14} aria-hidden="true" /></button></span>
      </div>
      <div className={s.wsUseGrid}>
        <label className={s.field}><span>Auslöser</span><textarea rows={2} maxLength={scenePossibilityLimits.long} value={e.trigger} placeholder="z. B. jemand bedrängt Emil" onChange={ev => onChange(replace(events, e.id, { trigger: ev.target.value }))} /></label>
        <label className={s.field}><span>Wirkung</span><textarea rows={2} maxLength={scenePossibilityLimits.long} value={e.effect} placeholder="Was geschieht?" onChange={ev => onChange(replace(events, e.id, { effect: ev.target.value }))} /></label>
        <label className={s.field}><span>Folgen</span><textarea rows={2} maxLength={scenePossibilityLimits.long} value={e.followUps} placeholder="Was ändert sich danach?" onChange={ev => onChange(replace(events, e.id, { followUps: ev.target.value }))} /></label>
      </div>
      <div className={s.field}><span>Wie lange kann es laufen?</span><div className={s.seg}>
        {(Object.keys(eventScopeNames) as SceneEvent["scope"][]).map(sc => <button key={sc} type="button" aria-pressed={e.scope === sc} onClick={() => onChange(replace(events, e.id, { scope: sc }))}>{eventScopeNames[sc]}</button>)}
      </div></div>
      <div className={s.wsPlaceFlags}>
        <label className={s.wsCheck}><Timer size={14} aria-hidden="true" /> Timer <input className={s.wsMinutes} type="number" min={0} max={scenePossibilityLimits.timerMinutes} value={e.timerMinutes} onChange={ev => onChange(replace(events, e.id, { timerMinutes: Math.max(0, Math.min(scenePossibilityLimits.timerMinutes, Math.round(Number(ev.target.value) || 0))) }))} /> Minuten{e.timerMinutes ? "" : " (keiner)"}</label>
        {e.timerMinutes > 0 && <label className={s.wsCheck}><input type="checkbox" checked={e.timerVisible} onChange={() => onChange(replace(events, e.id, { timerVisible: !e.timerVisible }))} /> Spieler sehen den Timer</label>}
        <label className={s.wsCheck}><input type="checkbox" checked={e.manualOnly} onChange={() => onChange(replace(events, e.id, { manualOnly: !e.manualOnly }))} /> Nur durch dich auslösen</label>
      </div>
    </article>)}
    {events.length < scenePossibilityLimits.events && <button type="button" className={s.ghost} onClick={add}><Plus size={15} aria-hidden="true" />Ereignis hinzufügen</button>}
  </div>;
}
