import { authoringTextMax } from './authoring-limits.ts';
import { encodeRichText, isRichTextWithinLimit, readRichText, richTextToPlainText, type RichTextBlock } from './location-rich-text.ts';
import type { SceneDocument } from './story-scene.ts';
import { ruleProfile, v20Profile } from './rule-profiles.ts';

/** Szene 2.0, Etappe 4: insights, interaction cards and events. Pure helpers; nothing here persists.
 * The old free texts (secrets, interactions, possibleConsequences) stay free notes. The current Regie gets the new
 * cards rendered in addition to them (read side only, never stored), so nothing is kept twice. */

export const availabilityNames = { known: 'Von Anfang an bekannt', discoverable: 'Entdeckbar', gm: 'Nur SL' } as const;
export const eventScopeNames = { scene: 'nur diese Szene', evening: 'den ganzen Abend', campaign: 'über mehrere Abende' } as const;

const plain = (v: string) => richTextToPlainText(v).trim();
const blocksOf = (v: string): RichTextBlock[] => plain(v) ? readRichText(v).blocks : [];
const heading = (t: string): RichTextBlock => ({ type: 'heading3', children: [{ text: t.slice(0, 200) }] });
const para = (t: string, bold = ''): RichTextBlock => ({ type: 'paragraph', children: bold ? [{ text: bold, bold: true }, { text: t }] : [{ text: t }] });

/** References inside the scene must exist in the same scene (cards → uses, insights, check elements, events). */
export function possibilityRefProblem(d: SceneDocument): string {
  const uses = new Set((d.materialUses || []).map(u => u.id)), insights = new Set((d.insights || []).map(i => i.id));
  const checks = new Set([...d.elements.filter(e => e.kind === 'check').map(e => e.id), ...(d.checks || []).map(c => c.id)]), events = new Set((d.events || []).map(e => e.id));
  for (const c of d.interactionCards || []) {
    if (c.materialUseIds.some(id => !uses.has(id))) return 'Eine Interaktion verweist auf Material, das nicht in dieser Szene verwendet wird.';
    if (c.insightIds.some(id => !insights.has(id))) return 'Eine Interaktion verweist auf eine Erkenntnis, die es in dieser Szene nicht gibt.';
    if (c.checkIds.some(id => !checks.has(id))) return 'Eine Interaktion verweist auf eine Probe, die es in dieser Szene nicht gibt.';
    if (c.eventIds.some(id => !events.has(id))) return 'Eine Interaktion verweist auf ein Ereignis, das es in dieser Szene nicht gibt.';
  }
  return '';
}

/** Removing an insight, event, use or check also removes it from the cards. */
export function withoutDanglingCardRefs(d: SceneDocument): SceneDocument {
  if (!d.interactionCards) return d;
  const uses = new Set((d.materialUses || []).map(u => u.id)), insights = new Set((d.insights || []).map(i => i.id));
  const checks = new Set([...d.elements.filter(e => e.kind === 'check').map(e => e.id), ...(d.checks || []).map(c => c.id)]), events = new Set((d.events || []).map(e => e.id));
  return { ...d, interactionCards: d.interactionCards.map(c => ({ ...c, materialUseIds: c.materialUseIds.filter(id => uses.has(id)), insightIds: c.insightIds.filter(id => insights.has(id)), checkIds: c.checkIds.filter(id => checks.has(id)), eventIds: c.eventIds.filter(id => events.has(id)) })) };
}

const titleOf = (d: SceneDocument, names: ReadonlyMap<string, string>) => ({
  use: (id: string) => d.elements.find(e => e.id === id)?.title || 'Material',
  insight: (id: string) => { const i = d.insights?.find(x => x.id === id); return i?.title || (i?.clueId && names.get(i.clueId)) || 'Erkenntnis'; },
  check: (id: string) => d.elements.find(e => e.id === id)?.title || d.checks?.find(c => c.id === id)?.title || 'Probe',
  event: (id: string) => d.events?.find(x => x.id === id)?.title || 'Ereignis',
});

function insightBlocks(d: SceneDocument, names: ReadonlyMap<string, string>): RichTextBlock[] {
  const t = titleOf(d, names);
  return (d.insights || []).flatMap(i => [
    heading(t.insight(i.id) + ' · ' + availabilityNames[i.availability]),
    ...blocksOf(i.text),
    ...(i.howFound.trim() ? [para(i.howFound.trim(), 'Fundweg: ')] : []),
    ...(i.clueId ? [para(names.get(i.clueId) || 'nicht verfügbar', 'Hinweis-Akte: ')] : []),
  ]);
}
function cardBlocks(d: SceneDocument, names: ReadonlyMap<string, string>): RichTextBlock[] {
  const t = titleOf(d, names);
  return (d.interactionCards || []).flatMap(c => {
    const links = [...c.materialUseIds.map(t.use), ...c.insightIds.map(t.insight), ...c.checkIds.map(t.check), ...c.eventIds.map(t.event)];
    return [para(c.then.trim() || '…', 'Wenn ' + (c.when.trim() || '…') + ' → '), ...(links.length ? [para(links.join(' · '), 'Dazu: ')] : [])];
  });
}
function eventBlocks(d: SceneDocument): RichTextBlock[] {
  return (d.events || []).flatMap(e => [
    heading('Ereignis: ' + e.title),
    ...(e.trigger.trim() ? [para(e.trigger.trim(), 'Auslöser: ')] : []),
    ...(e.effect.trim() ? [para(e.effect.trim(), 'Wirkung: ')] : []),
    ...(e.followUps.trim() ? [para(e.followUps.trim(), 'Folgen: ')] : []),
    para([eventScopeNames[e.scope], e.timerMinutes ? 'Timer ' + e.timerMinutes + ' min' + (e.timerVisible ? ' (für Spieler sichtbar)' : '') : '', e.manualOnly ? 'nur durch dich' : ''].filter(Boolean).join(' · '), 'Dauer: '),
  ]);
}
/** Checks of profiles without a classic element (e.g. narrative): shown as text in the current Regie. */
function otherCheckBlocks(d: SceneDocument): RichTextBlock[] {
  return (d.checks || []).filter(c => c.profileId !== v20Profile.id).flatMap(c => {
    const p = ruleProfile(c.profileId);
    if (!p) return [];
    return [heading('Probe: ' + c.title + ' · ' + p.name), para(p.describe(c.spec, c.difficulty)),
      ...p.outcomes.filter(o => c.outcomes[o.id]?.trim()).map(o => para(c.outcomes[o.id].trim(), o.label + ': ')), ...blocksOf(c.note)];
  });
}
function combine(old: string, title: string, blocks: RichTextBlock[]): string {
  if (!blocks.length) return old;
  return encodeRichText({ version: 1, blocks: [...blocksOf(old), ...(plain(old) ? [heading(title)] : []), ...blocks] });
}

/** What the current Regie shows in its tabs "Interaktion", "Geheimnisse" and "Folgen" (read side, never stored). */
export function regieTexts(d: SceneDocument, names: ReadonlyMap<string, string> = new Map()) {
  return {
    interactions: combine(d.interactions, 'Interaktionskarten', cardBlocks(d, names)),
    secrets: combine(d.secrets, 'Erkenntnisse', insightBlocks(d, names)),
    possibleConsequences: combine(d.possibleConsequences, 'Ereignisse und Proben', [...eventBlocks(d), ...otherCheckBlocks(d)]),
  };
}

/** Rollback aid: older builds reject the new keys; their content is written into the old free texts (as the Regie
 * shows it), within the text limit (the rest goes to the SL notes). Pure and idempotent. */
export function sceneWithoutPossibilities(document: Record<string, unknown>): { document: Record<string, unknown>; changed: boolean } {
  if (!['insights', 'interactionCards', 'events'].some(k => k in document)) return { document, changed: false };
  const texts = regieTexts(document as unknown as SceneDocument);
  const { insights: _i, interactionCards: _c, events: _e, ...rest } = document;
  void _i; void _c; void _e;
  const out: Record<string, unknown> = { ...rest };
  const overflow: string[] = [];
  for (const key of ['interactions', 'secrets', 'possibleConsequences'] as const) {
    if (texts[key] === rest[key]) continue;
    if (isRichTextWithinLimit(texts[key], authoringTextMax)) out[key] = texts[key];
    else overflow.push(plain(texts[key]).slice(0, 4000));
  }
  if (overflow.length) out.gmNotes = String(rest.gmNotes || '') + '<p>Szene 2.0 (zurückgeführt, gekürzt):</p>' + overflow.map(t => '<p>' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>').join('');
  return { document: out, changed: true };
}
