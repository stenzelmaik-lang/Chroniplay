import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneDocumentSchema, emptyScene } from '../domain/story-scene.ts';
import { encodeRichText, richTextToPlainText } from '../domain/location-rich-text.ts';
import { momentSchema } from '../domain/command-workspace.ts';
import { eveningPlayLog } from '../domain/play-log.ts';
import { possibilityRefProblem, regieTexts, sceneWithoutPossibilities, withoutDanglingCardRefs } from '../domain/scene-possibilities.ts';
import { workshopFill } from '../domain/scene-workshop.ts';

let n = 0;
const id = () => '00000000-0000-4000-a000-' + String(++n).padStart(12, '0');
const rich = text => encodeRichText({ version: 1, blocks: [{ type: 'paragraph', children: [{ text }] }] });
const insight = (title, over = {}) => ({ id: id(), title, text: rich('Text ' + title), availability: 'discoverable', howFound: '', clueId: '', ...over });
const event = (title, over = {}) => ({ id: id(), title, trigger: '', effect: '', followUps: '', scope: 'scene', timerMinutes: 0, timerVisible: false, manualOnly: true, ...over });
const card = over => ({ id: id(), when: '', then: '', materialUseIds: [], insightIds: [], checkIds: [], eventIds: [], ...over });
const scene = over => sceneDocumentSchema.parse({ ...emptyScene(), ...over });

test('Insights, cards and events are optional and validated', () => {
  const plain = scene({});
  assert.equal('insights' in plain || 'interactionCards' in plain || 'events' in plain, false);
  const doc = scene({ insights: [insight('Zustand')], events: [event('Das Tier erwacht', { timerMinutes: 10 })], interactionCards: [card({ when: 'Emil untersuchen', then: 'Probe' })] });
  assert.equal(doc.insights[0].availability, 'discoverable');
  assert.equal(doc.events[0].manualOnly, true, 'events never run by themselves unless the SL says so');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), events: [event('x', { timerMinutes: 601 })] }).success, false);
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), insights: [insight('x', { availability: 'public' })] }).success, false);
  const i = insight('d');
  assert.equal(sceneDocumentSchema.safeParse({ ...emptyScene(), insights: [i, i] }).success, false);
});

test('Cards refer only to parts of the same scene; removing a part removes the link', () => {
  const i = insight('Zustand'), e = event('Kontrollverlust');
  const check = { id: id(), kind: 'check', title: 'Zustand untersuchen', text: '', referenceId: '', fileId: '' };
  const ok = scene({ elements: [check], insights: [i], events: [e], interactionCards: [card({ insightIds: [i.id], eventIds: [e.id], checkIds: [check.id] })] });
  assert.equal(possibilityRefProblem(ok), '');
  assert.match(possibilityRefProblem({ ...ok, interactionCards: [card({ insightIds: [id()] })] }), /Erkenntnis/);
  assert.match(possibilityRefProblem({ ...ok, interactionCards: [card({ materialUseIds: [id()] })] }), /Material/);
  assert.match(possibilityRefProblem({ ...ok, interactionCards: [card({ checkIds: [i.id] })] }), /Probe/);
  const pruned = withoutDanglingCardRefs({ ...ok, insights: [], events: [] });
  assert.deepEqual([pruned.interactionCards[0].insightIds, pruned.interactionCards[0].eventIds, pruned.interactionCards[0].checkIds], [[], [], [check.id]]);
});

test('The current Regie shows the new cards in addition to the old free texts (read side)', () => {
  const i = insight('', { clueId: 'clue-1', availability: 'gm', howFound: 'nur wenn jemand fragt' });
  const e = event('Kontrollverlust', { trigger: 'Emil wird bedrängt', timerMinutes: 5, timerVisible: true });
  const doc = scene({ secrets: rich('Alte Geheimnisse'), insights: [i], events: [e], interactionCards: [card({ when: 'die Runde Emil beruhigt', then: 'er erzählt', insightIds: [i.id], eventIds: [e.id] })] });
  const t = regieTexts(doc, new Map([['clue-1', 'Laborbefund']]));
  const secrets = richTextToPlainText(t.secrets);
  assert.match(secrets, /Alte Geheimnisse/);
  assert.match(secrets, /Laborbefund · Nur SL/);
  assert.match(secrets, /Fundweg: nur wenn jemand fragt/);
  assert.match(richTextToPlainText(t.interactions), /Wenn die Runde Emil beruhigt → er erzählt\nDazu: Laborbefund · Kontrollverlust/);
  assert.match(richTextToPlainText(t.possibleConsequences), /Ereignis: Kontrollverlust\nAuslöser: Emil wird bedrängt\nDauer: nur diese Szene · Timer 5 min \(für Spieler sichtbar\) · nur durch dich/);
  const empty = scene({ secrets: rich('Nur alt') });
  assert.equal(regieTexts(empty).secrets, empty.secrets, 'without new cards nothing changes');
});

test('Fill counts include the new cards', () => {
  const fill = workshopFill(scene({ insights: [insight('a'), insight('b')], events: [event('e')], interactionCards: [card({})] }));
  assert.deepEqual([fill.insights, fill.events, fill.interactions], [2, 1, 1]);
});

test('Event log: an event moment needs scene, event and state; the evening log lists it', () => {
  const base = { clientRequestId: id(), text: 'Kontrollverlust ausgelöst', sessionId: 'session-1', storyId: '', sceneId: 'scene-1', runId: id(), references: [] };
  assert.equal(momentSchema.safeParse({ ...base, kind: 'event', eventId: id(), eventState: 'triggered' }).success, true);
  assert.equal(momentSchema.safeParse({ ...base, kind: 'event', eventState: 'triggered' }).success, false);
  assert.equal(momentSchema.safeParse({ ...base, kind: 'note', eventId: id(), eventState: 'triggered' }).success, false);
  assert.equal(momentSchema.safeParse({ ...base, kind: 'event', eventId: id(), eventState: 'exploded' }).success, false);
  const log = eveningPlayLog('session-1', [], [], [{ id: 'm1', kind: 'event', text: 'x', sessionId: 'session-1', sceneId: 'scene-1', occurredAt: '2026-11-26T20:00:00.000Z', eventId: 'e1', eventState: 'postponed' }]);
  assert.equal(log.events.length, 1);
});

test('Rollback writes the cards into the old free texts and keeps a valid old scene', () => {
  const doc = scene({ interactions: rich('Frei'), insights: [insight('Zustand', { availability: 'gm' })], events: [event('Kontrollverlust')], interactionCards: [card({ when: 'a', then: 'b' })] });
  const { document, changed } = sceneWithoutPossibilities(doc);
  assert.equal(changed, true);
  assert.equal('insights' in document || 'events' in document || 'interactionCards' in document, false);
  assert.match(richTextToPlainText(document.interactions), /Frei\nInteraktionskarten\nWenn a → b/);
  assert.match(richTextToPlainText(document.secrets), /Zustand · Nur SL/);
  assert.match(richTextToPlainText(document.possibleConsequences), /Ereignis: Kontrollverlust/);
  assert.equal(sceneDocumentSchema.safeParse(document).success, true);
  assert.equal(sceneWithoutPossibilities(document).changed, false);
});
