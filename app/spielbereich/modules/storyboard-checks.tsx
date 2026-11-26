"use client";
import { useState } from "react";
import { Dices, PencilLine, Plus, Trash2, Users } from "lucide-react";
import { authoringTextMax } from "@/domain/authoring-limits";
import type { PreparationRecipient } from "@/domain/personal-message";
import { richTextToPlainText } from "@/domain/location-rich-text";
import { parsePreparedCheck } from "@/domain/live-checks";
import { difficultyName, ruleProfile, ruleProfiles, v20Profile, type RuleProfile } from "@/domain/rule-profiles";
import { newCheck } from "@/domain/scene-checks";
import { sceneRuleCheckLimits, type SceneElement, type SceneRuleCheck } from "@/domain/story-scene";
import { RichTextEditor, RichTextView } from "./rich-text";
import s from "./storyboard.module.css";

/** Szene 2.0, Etappe 5: checks by rule profile. The scene stores profile + spec; V20 checks reach the GE-02 check desk
 * of the Regie as before (same element), other profiles are prepared for the new Regie. Nothing is rolled here. */

const replace = (list: SceneRuleCheck[], id: string, patch: Partial<SceneRuleCheck>) => list.map(c => c.id === id ? { ...c, ...patch } : c);
const str = (v: unknown) => typeof v === "string" ? v : "";

function SpecFields({ profile, check, onSpec }: { profile: RuleProfile; check: SceneRuleCheck; onSpec: (spec: Record<string, unknown>) => void }) {
  if (profile.traitGroups.length) {
    const select = (role: "attribute" | "ability", key: string, label: string) => <label className={s.field}><span>{label}</span>
      <select value={str(check.spec[key])} onChange={e => onSpec({ ...check.spec, [key]: e.target.value })}>
        <option value="">Spieler wählt</option>
        {profile.traitGroups.filter(g => g.role === role).map(g => <optgroup key={g.id} label={g.label}>{g.traits.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</optgroup>)}
      </select></label>;
    return <>{select("attribute", "attributeId", "Attribut")}{select("ability", "abilityId", "Fähigkeit")}</>;
  }
  return <label className={s.field}><span>Ansatz</span><input maxLength={300} value={str(check.spec.approach)} placeholder="z. B. mit Respekt, mit Druck, heimlich …" onChange={e => onSpec({ ...check.spec, approach: e.target.value })} /></label>;
}

export function ChecksEditor({ checks, freeText, players, onChange, onAsk }: { checks: SceneRuleCheck[]; freeText: SceneElement[]; players: PreparationRecipient[]; onChange: (next: SceneRuleCheck[]) => void; onAsk: (question: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState("");
  const figures = players.flatMap(p => p.character ? [{ id: p.character.id, name: p.character.name, player: p.name }] : []);
  function add(profileId: string) { onChange([...checks, newCheck(profileId)]); }
  function switchProfile(c: SceneRuleCheck, profileId: string) {
    const p = ruleProfile(profileId);
    if (!p || p.id === c.profileId) return;
    // Outcomes keep their text where the new profile knows the same outcome.
    onChange(replace(checks, c.id, { profileId: p.id, spec: p.emptySpec(), difficulty: p.difficulty.default, outcomes: Object.fromEntries(Object.entries(c.outcomes).filter(([k]) => p.outcomes.some(o => o.id === k))) }));
  }
  async function remove(c: SceneRuleCheck) {
    if (!(await onAsk("Probe „" + c.title + "“ entfernen?"))) return;
    onChange(checks.filter(x => x.id !== c.id));
  }
  function takeOver(e: SceneElement) {
    // Same reading as the Regie used so far (title and free text); the text stays as your note in the check.
    const parsed = parsePreparedCheck(e.title, richTextToPlainText(e.text));
    onChange([...checks, { id: e.id, title: e.title, profileId: v20Profile.id, spec: { attributeId: parsed.attributeId || "", abilityId: parsed.abilityId || "" }, difficulty: parsed.difficulty ?? v20Profile.difficulty.default, outcomes: {}, note: e.text, targetCharacterIds: [] }]);
  }
  return <div className={s.wsCards}>
    {!checks.length && !freeText.length && <p className={s.planBlank}>Noch keine Probe. Eine Probe bereitet vor, was gewürfelt (oder entschieden) wird, wie schwer es ist und was daraus folgt. Ausgegeben wird sie erst am Tisch.</p>}
    {checks.map(c => {
      const profile = ruleProfile(c.profileId) || v20Profile, hasNote = !!richTextToPlainText(c.note).trim();
      const range = Array.from({ length: profile.difficulty.max - profile.difficulty.min + 1 }, (_, i) => profile.difficulty.min + i);
      return <article key={c.id} className={s.wsCardItem} data-tone={profile.dice ? "dice" : "story"}>
        <div className={s.wsPassageHead}>
          <label className={s.wsTitle}><span className={s.srOnly}>Titel der Probe</span><input value={c.title} maxLength={sceneRuleCheckLimits.title} onChange={e => onChange(replace(checks, c.id, { title: e.target.value }))} onBlur={() => { if (!c.title.trim()) onChange(replace(checks, c.id, { title: "Probe" })); }} /></label>
          <span className={s.wsTools}><button type="button" aria-label={"Probe entfernen: " + c.title} onClick={() => void remove(c)}><Trash2 size={14} aria-hidden="true" /></button></span>
        </div>
        <p className={s.wsCheckLine}><Dices size={14} aria-hidden="true" /> {profile.describe(c.spec, c.difficulty)}{profile.difficulty.names?.[c.difficulty] && profile.dice ? " (" + difficultyName(profile, c.difficulty) + ")" : ""}</p>
        <div className={s.wsUseGrid}>
          <label className={s.field}><span>Regelprofil</span>
            <select value={c.profileId} onChange={e => switchProfile(c, e.target.value)}>{ruleProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <SpecFields profile={profile} check={c} onSpec={spec => onChange(replace(checks, c.id, { spec }))} />
          <label className={s.field}><span>{profile.difficulty.label}</span>
            <select value={c.difficulty} onChange={e => onChange(replace(checks, c.id, { difficulty: Number(e.target.value) }))}>{range.map(v => <option key={v} value={v}>{profile.dice ? v + (profile.difficulty.names?.[v] ? " · " + profile.difficulty.names[v] : "") : difficultyName(profile, v)}</option>)}</select></label>
        </div>
        <p className={s.viewHint}>{profile.summary}</p>
        <div className={s.wsUseGrid}>
          {profile.outcomes.map(o => <label key={o.id} className={s.field}><span>Bei {o.label}</span>
            <textarea rows={2} maxLength={sceneRuleCheckLimits.outcome} value={c.outcomes[o.id] || ""} placeholder="Was folgt? Nur für dich" onChange={e => { const outcomes = { ...c.outcomes, [o.id]: e.target.value }; if (!e.target.value) delete outcomes[o.id]; onChange(replace(checks, c.id, { outcomes })); }} /></label>)}
        </div>
        {profile.dice && <fieldset className={s.wsLinkGroup}><legend><Users size={12} aria-hidden="true" /> Wer würfelt?</legend>
          <label className={s.wsChip} data-on={!c.targetCharacterIds.length || undefined}><input type="checkbox" checked={!c.targetCharacterIds.length} onChange={() => onChange(replace(checks, c.id, { targetCharacterIds: [] }))} />Entscheide ich live</label>
          {figures.map(f => <label key={f.id} className={s.wsChip} data-on={c.targetCharacterIds.includes(f.id) || undefined}><input type="checkbox" checked={c.targetCharacterIds.includes(f.id)} onChange={() => onChange(replace(checks, c.id, { targetCharacterIds: c.targetCharacterIds.includes(f.id) ? c.targetCharacterIds.filter(x => x !== f.id) : [...c.targetCharacterIds, f.id] }))} />{f.name} · {f.player}</label>)}
          {c.targetCharacterIds.filter(t => !figures.some(f => f.id === t)).length > 0 && <small>{c.targetCharacterIds.filter(t => !figures.some(f => f.id === t)).length} vorgesehene Figur(en) derzeit nicht aktiv – bleiben erhalten.</small>}
        </fieldset>}
        {editing === c.id
          ? <div className={s.writer}><RichTextEditor key={c.id} label="Hinweis für dich" value={c.note} onChange={note => onChange(replace(checks, c.id, { note }))} maximumPlainLength={authoringTextMax} placeholder="Wann, warum, Modifikatoren im Kopf …" compactTools inlineGallery={false} proseClassName={s.prose} />
            <div className={s.pageActions}><button type="button" className={s.primary} onClick={() => setEditing("")}>Fertig</button></div></div>
          : <div className={s.reader}>{hasNote ? <RichTextView value={c.note} readable flowing className={s.prose} /> : null}
            <div className={s.pageActions}><button type="button" className={s.ghost} onClick={() => setEditing(c.id)}><PencilLine size={15} aria-hidden="true" />{hasNote ? "Hinweis bearbeiten" : "Hinweis für dich"}</button></div></div>}
      </article>;
    })}
    {checks.length < sceneRuleCheckLimits.checks && <div className={s.wsShelfActions}>
      {ruleProfiles.map(p => <button key={p.id} type="button" className={s.ghost} onClick={() => add(p.id)}><Plus size={15} aria-hidden="true" />{p.dice ? "Probe (" + p.name + ")" : "Probe " + p.name}</button>)}
    </div>}
    {freeText.length > 0 && <section className={s.wsOffer}>
      <h4 className={s.wsSub}>Ältere Proben als Freitext · {freeText.length}</h4>
      <p className={s.viewHint}>Diese Proben liest die Regie bisher aus Titel und Text. Übernehmen macht daraus eine Probe mit festen Feldern; der Text bleibt dein Hinweis.</p>
      <ul className={s.wsList}>{freeText.map(e => <li key={e.id}><span>{e.title}</span><button type="button" className={s.ghost} disabled={checks.length >= sceneRuleCheckLimits.checks} onClick={() => takeOver(e)}>Übernehmen</button></li>)}</ul>
    </section>}
  </div>;
}
