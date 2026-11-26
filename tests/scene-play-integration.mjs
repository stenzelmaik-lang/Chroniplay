// Storyboard 2.0, Phase 4 against a running isolated instance (demo:storyboard, port 8866): starting scenes on the live
// table records scene runs of the evening; moments record decisions and skipped scenes; players see none of it.
// Synthetic accounts only. Run: CVK_TEST_URL=http://127.0.0.1:8866 node --experimental-strip-types tests/scene-play-integration.mjs
import assert from 'node:assert/strict';

const base = process.env.CVK_TEST_URL || 'http://127.0.0.1:8866';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/, 'Only local isolated instances are allowed.');
async function login(id) { const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: id + '@example.invalid', password: 'ChroniPlay-Demo-2036!' }) }); assert.equal(r.status, 200, 'login ' + id); return r.headers.getSetCookie().map(c => c.split(';')[0]).join('; '); }
const client = cookie => ({
  get: async path => { const r = await fetch(base + path, { headers: { Cookie: cookie } }); return { status: r.status, json: await r.json().catch(() => ({})) }; },
  post: async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => ({})) }; },
});
const gm = client(await login('command-gm')), a = client(await login('command-a'));
let ok = 0; const pass = msg => { ok++; console.log('PASS ' + msg); };

// The evening with prepared scenes (storyboard fixture: the one with four scenes), started on the live table.
const sessions = (await gm.get('/api/command-center/preparation')).json.sessions;
const evening = sessions.find(s => s.document.sceneIds.length >= 3);
assert.ok(evening, 'fixture evening with scenes');
let active = (await gm.get('/api/live-table?view=active')).json.room;
if (!active?.started || active.sessionId !== evening.id) {
  const started = await gm.post('/api/live-table', { action: 'start', sessionId: evening.id, title: 'SYNTHETISCH – Phase 4' });
  assert.equal(started.status, 200, 'evening start ' + JSON.stringify(started.json));
  active = (await gm.get('/api/live-table?view=active')).json.room;
}
const sessionId = active.sessionId, runId = active.runId, q = '/api/live-stage?sessionId=' + encodeURIComponent(sessionId);
async function stage(command) { const s = (await gm.get(q)).json; const r = await gm.post('/api/live-stage', { sessionId, runId, expectedVersion: s.version, command }); assert.equal(r.status, 200, command.action + ' ' + JSON.stringify(r.json)); }
const [first, second, third] = evening.document.sceneIds;
const runsOf = async id => (await gm.get('/api/command-center/scenes?id=' + encodeURIComponent(id))).json.scene.state.runs.filter(r => r.sessionId === sessionId);

await stage({ action: 'activateScene', sceneId: first });
let r1 = await runsOf(first);
assert.equal(r1.filter(r => r.status === 'active').length, 1); pass('starting a scene on the table records an active run for this evening');
await stage({ action: 'activateScene', sceneId: second });
r1 = await runsOf(first); const r2 = await runsOf(second);
assert.ok(r1.every(r => r.status === 'completed') && r2.some(r => r.status === 'active')); pass('switching completes the previous run and starts the next');
await stage({ action: 'activateScene', sceneId: first });
r1 = await runsOf(first);
assert.ok(r1.length === 2 && r1.at(-1).previousRunId === r1[0].id && r1.at(-1).status === 'active'); pass('returning to a scene reopens it (history kept)');
await stage({ action: 'activateScene', sceneId: first });
assert.equal((await runsOf(first)).length, 2); pass('starting the running scene again records nothing twice');

const story = (await gm.get('/api/command-center/scenes?id=' + encodeURIComponent(third))).json.scene.document.storyId;
const skipped = await gm.post('/api/command-center/moments', { clientRequestId: crypto.randomUUID(), kind: 'skipped', text: 'Übersprungen', sessionId, storyId: story, sceneId: third, runId: '', references: [] });
assert.ok([200, 201].includes(skipped.status), JSON.stringify(skipped.json)); pass('a skipped scene is recorded without a run');
const firstDoc = (await gm.get('/api/command-center/scenes?id=' + encodeURIComponent(first))).json.scene;
const runningRun = firstDoc.state.runs.findLast(r => r.sessionId === sessionId && r.status !== 'completed');
const decision = await gm.post('/api/command-center/moments', { clientRequestId: crypto.randomUUID(), kind: 'decision', text: 'Sie verschonen den Wachmann.', sessionId, storyId: firstDoc.document.storyId, sceneId: first, runId: runningRun.id, references: [] });
assert.ok([200, 201].includes(decision.status) && decision.json.moments.some(m => m.kind === 'decision')); pass('a decision is recorded for the running scene');
const bad = await gm.post('/api/command-center/moments', { clientRequestId: crypto.randomUUID(), kind: 'decision', text: 'x', sessionId, storyId: story, sceneId: third, runId: '', references: [] });
assert.equal(bad.status, 400); pass('a decision about a scene still needs a real run of this evening');

// Szene 2.0, Etappe 4: event log – what happened with a prepared event (never automatic)
const eventId = crypto.randomUUID(), current = (await gm.get('/api/command-center/scenes?id=' + encodeURIComponent(first))).json.scene;
const withEvent = await gm.post('/api/command-center/scenes', { action: 'save', id: first, version: current.version, document: { ...current.document, events: [{ id: eventId, title: 'Das Tier erwacht', trigger: '', effect: '', followUps: '', scope: 'evening', timerMinutes: 0, timerVisible: false, manualOnly: true }] } });
assert.equal(withEvent.status, 200, JSON.stringify(withEvent.json));
const logged = await gm.post('/api/command-center/moments', { clientRequestId: crypto.randomUUID(), kind: 'event', eventId, eventState: 'postponed', text: 'Das Tier erwacht – verschoben', sessionId, storyId: firstDoc.document.storyId, sceneId: first, runId: runningRun.id, references: [] });
assert.ok([200, 201].includes(logged.status) && logged.json.moments.some(m => m.kind === 'event' && m.eventId === eventId && m.eventState === 'postponed'), JSON.stringify(logged.json)); pass('an event of the scene is logged with its state');
const unknownEvent = await gm.post('/api/command-center/moments', { clientRequestId: crypto.randomUUID(), kind: 'event', eventId: crypto.randomUUID(), eventState: 'triggered', text: 'x', sessionId, storyId: firstDoc.document.storyId, sceneId: first, runId: runningRun.id, references: [] });
assert.equal(unknownEvent.status, 400); pass('only events prepared in the scene can be logged');

for (const path of ['/api/command-center/moments?sessionId=' + encodeURIComponent(sessionId), '/api/command-center/scenes?id=' + encodeURIComponent(first)]) assert.ok([401, 403].includes((await a.get(path)).status));
pass('players read neither moments nor scene runs');
const regie = (await gm.get(q + '&regie=' + encodeURIComponent(first))).json;
assert.ok(Array.isArray(regie.scene.links) && Array.isArray(regie.scene.pending)); pass('Regie context carries connections and prepared strands');
console.log(ok + ' scene-play checks passed (local isolated instance).');
