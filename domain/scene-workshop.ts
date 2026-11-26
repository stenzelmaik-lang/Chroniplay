import { authoringTextMax } from './authoring-limits.ts';
import { encodeRichText, isRichTextWithinLimit, readRichText, richTextToPlainText, type RichTextBlock } from './location-rich-text.ts';
import { checksFromElements, freeTextChecks, withCheckMirrors } from './scene-checks.ts';
import { emptyCastRole, sceneCastLimits, type SceneCast, type SceneDocument, type SceneElement, type SceneMood, type ScenePassage, type ScenePlace } from './story-scene.ts';

/** Szene 2.0, Etappe 1: the scene as a workshop. Pure helpers; nothing here persists.
 *
 * Compatibility: the new parts are the source of truth, the old fields stay as mirrors so that the current Regie,
 * the classic view and older builds keep working unchanged:
 *   passages → narration (texts only, never the SL directions)
 *   default mood → backdropFileId and youtube
 * A legacy editor that changes a mirror (classic view) wins for that change; see `withWorkshopMirrors`. */

const plain = (value: string) => richTextToPlainText(value).trim();
const blocksOf = (value: string): RichTextBlock[] => plain(value) ? readRichText(value).blocks : [];
const heading = (title: string): RichTextBlock => ({ type: 'heading3', children: [{ text: title.slice(0, 200) }] });
const paragraph = (value: string): RichTextBlock => ({ type: 'paragraph', children: [{ text: value }] });
const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The narration mirror. One untitled passage is passed through unchanged; several passages become one text with
 * the passage titles as headings. Stays within the narration limit: passages that no longer fit are left out of the
 * mirror (they stay complete in the storyboard) and a short note says so. */
export function passagesToNarration(passages: readonly ScenePassage[]): string {
  const used = passages.filter(p => plain(p.text) || p.title.trim());
  if (!used.length) return '';
  if (used.length === 1 && !used[0].title.trim()) return used[0].text;
  const blocks: RichTextBlock[] = [];
  for (const [index, passage] of used.entries()) {
    const next = [...blocks, ...(passage.title.trim() ? [heading(passage.title.trim())] : []), ...blocksOf(passage.text)];
    if (!isRichTextWithinLimit(encodeRichText({ version: 1, blocks: next }), authoringTextMax - 200)) {
      blocks.push(paragraph(`… ${used.length - index} weitere Abschnitte stehen nur im Storyboard.`));
      break;
    }
    blocks.splice(0, blocks.length, ...next);
  }
  return encodeRichText({ version: 1, blocks });
}

export function defaultMood(moods: readonly SceneMood[] | undefined): SceneMood | undefined {
  return moods?.find(m => m.isDefault) || moods?.[0];
}

/** Applies the mirrors before a save. With `before` (the stored document) a legacy edit is detected: if a mirror field
 * changed while its source did not, the legacy value wins and the source follows (one passage with the new text and
 * all previous directions; the default mood takes the new picture and music). Nothing is lost. */
export function withWorkshopMirrors(next: SceneDocument, before?: SceneDocument | null): SceneDocument {
  let doc = next;
  // A defined list is the source (also when empty: removing every passage empties the narration mirror).
  if (doc.passages) {
    const legacyNarration = before && !equal(doc.narration, before.narration) && equal(doc.passages, before.passages);
    if (legacyNarration) {
      const first = doc.passages[0];
      const directions = doc.passages.map(p => p.direction.trim()).filter(Boolean).join('\n\n').slice(0, 5000);
      doc = { ...doc, passages: plain(doc.narration) ? [{ id: first?.id || crypto.randomUUID(), title: '', text: doc.narration, direction: directions, moodId: first?.moodId || '' }] : [] };
    } else doc = { ...doc, narration: passagesToNarration(doc.passages) };
  }
  if (doc.moods) {
    const mood = defaultMood(doc.moods);
    const legacyStage = before && (!equal(doc.backdropFileId, before.backdropFileId) || !equal(doc.youtube ?? [], before.youtube ?? [])) && equal(doc.moods, before.moods);
    if (legacyStage) {
      doc = mood
        ? { ...doc, moods: doc.moods.map(m => m.id === mood.id ? { ...m, backdropFileId: doc.backdropFileId, youtube: doc.youtube || [] } : m) }
        : { ...doc, moods: doc.backdropFileId || doc.youtube?.length ? [{ id: crypto.randomUUID(), name: 'Szenenstimmung', backdropFileId: doc.backdropFileId, youtube: doc.youtube || [], effects: [], isDefault: true }] : [] };
    } else doc = { ...doc, backdropFileId: mood?.backdropFileId || '', youtube: mood?.youtube || [] };
  }
  // Etappe 2: cast → npcIds, main place → placeId. A legacy edit of the mirror wins; roles and notes stay.
  if (doc.cast) {
    const legacyNpcs = before && !equal(doc.npcIds, before.npcIds) && equal(doc.cast, before.cast);
    if (legacyNpcs) {
      const kept = new Map(doc.cast.map(c => [c.npcId, c]));
      doc = { ...doc, cast: doc.npcIds.map(npcId => kept.get(npcId) || newCast(npcId)) };
    } else doc = { ...doc, npcIds: doc.cast.map(c => c.npcId) };
  }
  if (doc.places) {
    const legacyPlace = before && !equal(doc.placeId, before.placeId) && equal(doc.places, before.places);
    if (legacyPlace) {
      const target = doc.placeId;
      const places = doc.places.map(p => ({ ...p, main: !!target && p.placeId === target }));
      doc = { ...doc, places: target && !places.some(p => p.placeId === target) ? [{ ...newPlace(target), main: true }, ...places] : places };
    } else doc = { ...doc, placeId: doc.places.find(p => p.main)?.placeId || '' };
  }
  // Etappe 5: V20 checks ⇄ classic check elements (same id).
  return withCheckMirrors(doc, before);
}

export function newCast(npcId: string, id: string = crypto.randomUUID()): SceneCast {
  return { id, npcId, presence: 'start', role: emptyCastRole(), dialogue: '', cardNote: '' };
}
export function newPlace(placeId: string, id: string = crypto.randomUUID()): ScenePlace {
  return { id, placeId, main: false, note: '', unlockable: false };
}
/** True when the SL wrote something for this NPC in this scene (asked before removing). */
export function castHasContent(c: SceneCast): boolean {
  return !!(c.dialogue.trim() || c.cardNote.trim() || Object.values(c.role).some(v => v.trim()));
}

/** Elements of the classic scene that the cast and places areas can take over on request (never automatically):
 * person references to an NPC, dialogue notes, and place references. Only plain elements without files or material. */
export function takeoverElements(doc: SceneDocument, npcIds: ReadonlySet<string>, placeIds: ReadonlySet<string>) {
  const plainElement = (e: SceneElement) => !e.fileId && !e.material && !e.pager && !e.check;
  return {
    persons: doc.elements.filter(e => e.kind === 'person' && plainElement(e) && npcIds.has(e.referenceId)),
    dialogues: doc.elements.filter(e => e.kind === 'dialogue' && plainElement(e)),
    places: doc.elements.filter(e => e.kind === 'place' && plainElement(e) && placeIds.has(e.referenceId)),
  };
}
const elementText = (e: SceneElement) => [e.title.trim(), plain(e.text)].filter(Boolean).join(': ');
/** Moves a person element into the cast (its text becomes "why in this scene"; an existing entry gets it appended). */
export function takeOverPerson(doc: SceneDocument, elementId: string, newId: () => string = () => crypto.randomUUID()): SceneDocument {
  const e = doc.elements.find(x => x.id === elementId && x.kind === 'person');
  if (!e || !e.referenceId) return doc;
  const cast = doc.cast || [];
  const text = elementText(e);
  const existing = cast.find(c => c.npcId === e.referenceId);
  if (existing ? existing.role.why.length + text.length + 2 > sceneCastLimits.field : cast.length >= sceneCastLimits.cast || text.length > sceneCastLimits.field) return doc;
  const nextCast = existing
    ? cast.map(c => c === existing ? { ...c, role: { ...c.role, why: join(c.role.why, text, sceneCastLimits.field) } } : c)
    : [...cast, { ...newCast(e.referenceId, newId()), role: { ...emptyCastRole(), why: text } }];
  return { ...doc, cast: nextCast, elements: doc.elements.filter(x => x.id !== e.id) };
}
/** Moves a dialogue element into the dialogue help of one cast member. */
export function takeOverDialogue(doc: SceneDocument, elementId: string, castId: string): SceneDocument {
  const e = doc.elements.find(x => x.id === elementId && x.kind === 'dialogue');
  const target = doc.cast?.find(c => c.id === castId);
  if (!e || !target) return doc;
  const text = elementText(e);
  if (target.dialogue.length + text.length + 2 > sceneCastLimits.dialogue) return doc;
  return { ...doc, cast: doc.cast!.map(c => c.id === castId ? { ...c, dialogue: join(c.dialogue, text, sceneCastLimits.dialogue) } : c), elements: doc.elements.filter(x => x.id !== e.id) };
}
/** Moves a place element into the scene places (its text becomes the scene note). */
export function takeOverPlace(doc: SceneDocument, elementId: string, newId: () => string = () => crypto.randomUUID()): SceneDocument {
  const e = doc.elements.find(x => x.id === elementId && x.kind === 'place');
  if (!e || !e.referenceId) return doc;
  const places = doc.places || [];
  const text = elementText(e);
  const existing = places.find(p => p.placeId === e.referenceId);
  if (existing ? existing.note.length + text.length + 2 > sceneCastLimits.placeNote : places.length >= sceneCastLimits.places || text.length > sceneCastLimits.placeNote) return doc;
  const nextPlaces = existing
    ? places.map(p => p === existing ? { ...p, note: join(p.note, text, sceneCastLimits.placeNote) } : p)
    : [...places, { ...newPlace(e.referenceId, newId()), note: text, main: !places.some(p => p.main) }];
  return { ...doc, places: nextPlaces, elements: doc.elements.filter(x => x.id !== e.id) };
}
const join = (a: string, b: string, max: number) => (a.trim() ? a.trim() + '\n\n' + b : b).slice(0, max);

/** Opens an older scene in the workshop without losing anything: its narration becomes passage 1, its picture and
 * music become the scene's default mood. Ids come from `newId` so the result is testable. */
export function toWorkshop(doc: SceneDocument, newId: () => string = () => crypto.randomUUID()): SceneDocument {
  let out = doc;
  if (!doc.passages?.length && plain(doc.narration)) out = { ...out, passages: [{ id: newId(), title: '', text: doc.narration, direction: '', moodId: '' }] };
  if (!doc.moods?.length && (doc.backdropFileId || doc.youtube?.length)) out = { ...out, moods: [{ id: newId(), name: 'Szenenstimmung', backdropFileId: doc.backdropFileId, youtube: doc.youtube || [], effects: [], isDefault: true }] };
  // Etappe 2: selected NPCs become cast members, the central place becomes the main scene place.
  if (!doc.cast?.length && doc.npcIds.length) out = { ...out, cast: doc.npcIds.map(npcId => newCast(npcId, newId())) };
  if (!doc.places?.length && doc.placeId) out = { ...out, places: [{ ...newPlace(doc.placeId, newId()), main: true }] };
  // Etappe 5: structured check elements become checks by rule profile (same id, lossless).
  return checksFromElements(out);
}

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Rollback aid (Etappe 1+2 release): older builds reject the new keys. The narration, default-mood, npcIds and placeId
 * mirrors already hold what the old fields need; context, passage titles and directions, other moods, roles and place
 * notes move into the SL notes as text. Pure and idempotent. */
export function sceneWithoutWorkshop(document: Record<string, unknown>): { document: Record<string, unknown>; changed: boolean } {
  if (!['context', 'passages', 'moods', 'cast', 'places', 'placesOpen'].some(key => key in document)) return { document, changed: false };
  const { context, passages, moods, cast, places, placesOpen, ...rest } = document as Record<string, unknown> & { context?: Record<string, unknown>; passages?: Record<string, unknown>[]; moods?: Record<string, unknown>[]; cast?: Record<string, unknown>[]; places?: Record<string, unknown>[]; placesOpen?: unknown };
  const lines: string[] = [];
  if (context && typeof context === 'object') {
    const c = context as Record<string, unknown>;
    const parts = [['Ausgangssituation', c.situation], ['Zweck', c.purpose], ['Voraussetzungen', c.prerequisites], ['Grundton', c.tone], ['Ende', c.ending === 'fixed' ? 'fester Ausgang' : '']]
      .filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => '<p>' + k + ': ' + esc(v) + '</p>');
    const entries = Array.isArray(c.entries) && c.entries.length ? ['<p>Einstiege: ' + c.entries.map(esc).join(' · ') + '</p>'] : [];
    lines.push(...parts, ...entries);
  }
  for (const [i, p] of (Array.isArray(passages) ? passages : []).entries()) {
    const title = typeof p.title === 'string' && p.title.trim() ? p.title.trim() : 'Abschnitt ' + (i + 1);
    if (typeof p.direction === 'string' && p.direction.trim()) lines.push('<p>Regie zu „' + esc(title) + '“: ' + esc(p.direction) + '</p>');
  }
  const moodList = (Array.isArray(moods) ? moods : []).map(m => esc(m.name) + (m.isDefault ? ' (Standard)' : '') + (Array.isArray(m.effects) && m.effects.length ? ' – Effekte: ' + m.effects.map(esc).join(', ') : ''));
  if (moodList.length) lines.push('<p>Stimmungen: ' + moodList.join(' · ') + '</p>');
  // Etappe 2: npcIds and placeId already mirror cast and main place; roles, card additions and place notes become text.
  const roleNames: Record<string, string> = { why: 'warum da', wants: 'will', knows: 'weiß', hides: 'verschweigt', reacts: 'reagiert auf', intervenes: 'greift ein, wenn', leaves: 'verlässt die Szene, wenn' };
  for (const c of Array.isArray(cast) ? cast : []) {
    const role = c.role && typeof c.role === 'object' ? c.role as Record<string, unknown> : {};
    const parts = [...Object.entries(roleNames).map(([k, label]) => [label, role[k]]), ['Dialoghilfen', c.dialogue], ['Zusatz Spieler-Karte', c.cardNote]]
      .filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => esc(k) + ': ' + esc(v));
    if (parts.length) lines.push('<p>Beteiligte ' + esc(c.npcId) + ': ' + parts.join(' · ') + '</p>');
  }
  for (const p of Array.isArray(places) ? places : []) {
    const parts = [p.main ? 'Hauptschauplatz' : '', p.unlockable ? 'freischaltbar' : '', typeof p.note === 'string' ? p.note.trim() : ''].filter(Boolean).map(esc);
    lines.push('<p>Schauplatz ' + esc(p.placeId) + (parts.length ? ': ' + parts.join(' · ') : '') + '</p>');
  }
  if (placesOpen === true) lines.push('<p>Schauplatz wird im Spiel bestimmt.</p>');
  const note = lines.length ? '<p>Szene 2.0 (zurückgeführt):</p>' + lines.join('') : '';
  return { document: note ? { ...rest, gmNotes: String(rest.gmNotes || '') + note } : rest, changed: true };
}

/** The workshop areas, their grouping and what happens with their content at the table (shown on request).
 * `reach`: 'table' = the Regie can play it out and it appears at the table (gold); 'sl' = only for the SL (silver).
 * The new Regie takes its buttons from the areas with reach 'table' (ADR-001). */
export const workshopAreas = [
  { id: 'overview', reach: 'sl', group: 'Rahmen', label: 'Überblick', table: 'Nichts – der Überblick ist nur für dich.' },
  { id: 'places', reach: 'table', group: 'Rahmen', label: 'Schauplätze', table: 'Du schaltest den Ort über die Karte unten frei; die Spieler sehen seine Infos. Einmal freigeschaltet, bleibt er dauerhaft im Wiki sichtbar.' },
  { id: 'cast', reach: 'table', group: 'Rahmen', label: 'Beteiligte', table: 'Das Figurenbild liegt auf dem Tisch („ist vor Ort“); rechts im Slider erscheint die Charakterkarte wie im Wiki. Deine Notizen zur Rolle siehst nur du.' },
  { id: 'passages', reach: 'sl', group: 'Erzählen', label: 'Erzählung', table: 'Nichts – die Erzählung liest du vor. Nur die Stimmung kann bei einem Abschnitt wechseln, wenn du es festlegst.' },
  { id: 'moods', reach: 'table', group: 'Erzählen', label: 'Atmosphäre', table: 'Die Stimmung liegt auf dem Tisch: Bild, Klang und Effekte zusammen.' },
  { id: 'interactions', reach: 'sl', group: 'Möglichkeiten', label: 'Interaktionen', table: 'Läuft zwischen dir und den Spielern – ohne feste Reihenfolge.' },
  { id: 'material', reach: 'table', group: 'Möglichkeiten', label: 'Material', table: 'Du spielst es aus – an eine Person, eine Teilgruppe oder alle. Manches können Spieler einstecken; jedes gibt es nur einmal.' },
  { id: 'checks', reach: 'table', group: 'Möglichkeiten', label: 'Proben', table: 'Die Würfel sind vorbereitet: Der Spieler wählt in seinem Bogen Attribut und Fähigkeit, gewürfelt wird gegen deine Schwierigkeit.' },
  { id: 'insights', reach: 'table', group: 'Möglichkeiten', label: 'Erkenntnisse & Geheimnisse', table: 'Nur für bestimmte Spieler – wenn du sie als entdeckt markierst. Geheimnisse bleiben bei dir.' },
  { id: 'visions', reach: 'table', group: 'Möglichkeiten', label: 'Visionen', table: 'Für alle oder bestimmte Spieler – einmal kurz.' },
  { id: 'events', reach: 'table', group: 'Möglichkeiten', label: 'Ereignisse', table: 'Global; kann über längere Zeit laufen.' },
  { id: 'exits', reach: 'sl', group: 'Abschluss', label: 'Ausgänge', table: 'Nichts – du entscheidest, wohin es geht.' },
  { id: 'notes', reach: 'sl', group: 'Abschluss', label: 'Notizen', table: 'Nichts – Notizen sind nur für dich.' },
] as const;
export type WorkshopArea = typeof workshopAreas[number]['id'];
export type WorkshopReach = typeof workshopAreas[number]['reach'];

/** How full each area is (for the area list). Counts only what exists; nothing is required. */
export function workshopFill(doc: SceneDocument): Record<WorkshopArea, number> {
  const has = (v: string) => plain(v) ? 1 : 0;
  const c = doc.context;
  return {
    overview: c ? [c.situation, c.purpose, c.prerequisites, c.tone].filter(v => v.trim()).length + (c.entries.length ? 1 : 0) : 0,
    places: (doc.places ? doc.places.length : doc.placeId ? 1 : 0) + (doc.placesOpen ? 1 : 0),
    cast: (doc.cast ? doc.cast.length : doc.npcIds.length) + doc.standardFigures.length + has(doc.dialogueNotes),
    passages: doc.passages?.length || has(doc.narration),
    moods: doc.moods?.length || (doc.backdropFileId || doc.youtube?.length ? 1 : 0),
    interactions: (doc.interactionCards?.length || 0) + has(doc.interactions),
    material: doc.elements.filter(e => e.kind !== 'check').length,
    checks: doc.checks ? doc.checks.length + freeTextChecks(doc).length : doc.elements.filter(e => e.kind === 'check').length,
    insights: (doc.insights?.length || 0) + has(doc.secrets),
    visions: doc.whispers.length,
    events: doc.events?.length || 0,
    exits: (doc.board?.links?.length || 0) + doc.possibilities.length,
    notes: has(doc.gmNotes),
  };
}

/** Which areas a block type (Phase 1) puts first; the others stay reachable, just quieter. */
const typeAreaMap: Record<string, WorkshopArea[]> = {
  narration: ['passages'], atmosphere: ['moods'], dialogueNotes: ['cast'], interactions: ['interactions', 'material'],
  secrets: ['insights'], visions: ['visions'], possibleConsequences: ['checks', 'exits'], gmNotes: ['notes'],
};
export function primaryWorkshopAreas(typeAreas: readonly string[]): Set<WorkshopArea> {
  return new Set<WorkshopArea>(['overview', 'places', 'events', ...typeAreas.flatMap(a => typeAreaMap[a] || [])]);
}
