import { randomUUID } from 'node:crypto';
import { emptyScene } from '../domain/story-scene.ts';
import { emptyStory } from '../domain/command-workspace.ts';

// Orte in der Regie: a real scene that is prepared with the existing place "place.electric-taberna" must show its
// state on site to the SL (read), switch it with a version-protected write, and hide it from players.
export async function regieLocationIntegration({ req, check, base }) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Regie location QA requires an isolated local worker.');
  const place = 'place.electric-taberna';
  const storyDoc = emptyStory(); storyDoc.title = 'SYNTHETIC Regie-Ort-Fixture';
  const story = await req('/api/command-center/story', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: storyDoc });
  check(story.s === 201, 'REGIE-ORT synthetic story created in the isolated database');
  const doc = { ...emptyScene(story.d.story.id), title: 'SYNTHETIC Regie-Ort-Szene', placeId: place, places: [{ id: randomUUID(), placeId: place, main: true, note: '', unlockable: false }] };
  const created = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: doc });
  check(created.s === 201, 'REGIE-ORT scene with the existing place is prepared (' + created.s + ')');
  const sceneId = created.d?.scene?.id;

  const sessionId = randomUUID();
  check((await req('/api/live-table', 'gm', 'POST', { action: 'start', sessionId, title: 'SYNTHETIC Regie-Ort', create: true })).s === 200, 'REGIE-ORT evening started for the Regie');
  const context = (who) => req('/api/live-stage?sessionId=' + sessionId + '&regie=' + encodeURIComponent(sceneId), who);

  const read = await context('gm');
  const locations = read.d?.locations ?? [];
  const entry = locations.find(item => item.id === place);
  check(read.s === 200 && Array.isArray(locations), 'REGIE-ORT SL reads the scene context with a locations array');
  check(!!entry && entry.main === true && entry.locationId === place && typeof entry.revision === 'number' && typeof entry.worldState === 'string', 'REGIE-ORT the main place carries its id, revision and state on site');
  check(entry?.worldState === 'active', 'REGIE-ORT the place starts open in this fixture (' + entry?.worldState + ')');

  const denied = await context('a');
  check([401, 403, 404].includes(denied.s) && !JSON.stringify(denied.d ?? {}).includes('"locations"'), 'REGIE-ORT players get no Regie context and no locations (' + denied.s + ')');
  const anonymous = await fetch(base + '/api/live-stage?sessionId=' + sessionId + '&regie=' + encodeURIComponent(sceneId));
  check(anonymous.status === 401, 'REGIE-ORT anonymous visitors get no Regie context (' + anonymous.status + ')');
  check((await req('/api/locations/state', 'a', 'POST', { placeId: place, entityId: place, mode: 'world', worldState: 'inaccessible', expectedRevision: entry.revision, reason: 'player' })).s === 403, 'REGIE-ORT players cannot switch the state from the Regie');

  const closed = await req('/api/locations/state', 'gm', 'POST', { placeId: place, entityId: place, mode: 'world', worldState: 'inaccessible', expectedRevision: entry.revision, reason: 'In der Regie umgeschaltet' });
  check(closed.s === 200, 'REGIE-ORT SL closes the place from the Regie (' + closed.s + ')');
  const after = (await context('gm')).d.locations.find(item => item.id === place);
  check(after?.worldState === 'inaccessible' && after.revision === entry.revision + 1, 'REGIE-ORT the Regie context shows the new state and revision');
  check((await req('/api/locations/state', 'gm', 'POST', { placeId: place, entityId: place, mode: 'world', worldState: 'active', expectedRevision: entry.revision, reason: 'stale' })).s === 409, 'REGIE-ORT a stale Regie click gets a conflict instead of an overwrite');

  const reopened = await req('/api/locations/state', 'gm', 'POST', { placeId: place, entityId: place, mode: 'world', worldState: 'active', expectedRevision: after.revision, reason: 'In der Regie wieder geöffnet' });
  check(reopened.s === 200, 'REGIE-ORT SL opens the place again (restores the fixture state)');
  check((await context('gm')).d.locations.find(item => item.id === place)?.worldState === 'active', 'REGIE-ORT the fixture place is open again');
}
