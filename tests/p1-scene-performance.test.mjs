// P1 2026-11-22: regression tests for the proven load and robustness defects of the scene views.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyScene, sceneDocumentSchema } from '../domain/story-scene.ts';
import { summarizeSceneRow } from '../domain/scene-list.ts';
import { api, apiIfChanged, ApiError, API_TRANSPORT_ERROR } from '../app/spielbereich/modules/api-client.ts';

const html = v => 'cvk-html-v1:' + v;
const table = rows => '<table><tbody><tr><th>Sprecher</th><th>Dialog</th></tr>' + Array.from({ length: rows }, (_, i) => `<tr><td><strong>SC</strong></td><td>Zeile ${i + 1} im Keller.</td></tr>`).join('') + '</tbody></table>';
const scene = fields => ({ ...emptyScene(''), title: 'Szene 05 – Der Junge im Keller', ...fields });
const row = (document, extra = {}) => ({ id: 'scene-a', version: 3, updated_at: '2026-11-22T10:00:00.000Z', title: document.title, gm_body: JSON.stringify(document), content: JSON.stringify({ documentKind: 'story_scene', runs: [], publications: [] }), ...extra });

test('the scene list carries visible text as search index, not the stored rich-text JSON', () => {
  const document = sceneDocumentSchema.parse(scene({ narration: html('<p><strong>Lukas</strong> wartet im Keller.</p>' + table(20)) }));
  const summary = summarizeSceneRow(row(document));
  assert.match(summary.searchText, /Lukas wartet im Keller/);
  assert.doesNotMatch(summary.searchText, /cvk-rich-v1|"bold"|"children"|"text"/);
  assert.ok(summary.searchText.length < document.narration.length * 0.8, 'smaller than the raw document');
  assert.equal(summarizeSceneRow(row(document), { search: false }).searchText, '');
  assert.equal(summary.preparation.narrationExcerpt.startsWith('Lukas wartet im Keller'), true);
});

test('one unreadable scene no longer fails the whole list; it stays visible and is not rewritten', () => {
  const good = sceneDocumentSchema.parse(scene({}));
  const rows = [row(good), row({}, { id: 'scene-broken', title: 'Alte Szene', gm_body: '{"title":"Alte Szene","narration":42}' }), row(good, { id: 'scene-c' })];
  const list = rows.map(r => summarizeSceneRow(r));
  assert.deepEqual(list.map(s => s.id), ['scene-a', 'scene-broken', 'scene-c']);
  assert.equal(list[1].unsupported, true);
  assert.equal(list[1].title, 'Alte Szene');
  assert.equal(list[0].unsupported, undefined);
  assert.match(readFileSync('server/story-scenes.ts', 'utf8'), /\.map\(row => summarizeSceneRow\(row, options\)\)/);
});

test('player scene projection reads only id and release state, never the SL document', () => {
  const source = readFileSync('server/story-scenes.ts', 'utf8');
  assert.match(source, /export async function playerScenes[\s\S]*?sceneRows<\{ id: string; content: string \}>\(db, a\.campaignId, 'id,content'\)/);
  assert.doesNotMatch(source, /SELECT \* FROM entities WHERE campaign_id=\? AND \$\{predicate\} ORDER BY/);
});

test('an interrupted or unreadable answer is an error, not a silently empty view', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{"scenes":[{"id":"a"', { status: 200, headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(api('/api/command-center'), e => e instanceof ApiError && e.status === API_TRANSPORT_ERROR && /unvollständig/.test(e.message));
    globalThis.fetch = async () => { throw new DOMException('timeout', 'TimeoutError'); };
    await assert.rejects(api('/api/command-center'), e => e instanceof ApiError && e.status === API_TRANSPORT_ERROR);
    globalThis.fetch = async () => new Response('nicht json', { status: 500 });
    await assert.rejects(api('/api/command-center'), e => e instanceof ApiError && e.status === 500 && /nicht gelesen/.test(e.message));
  } finally { globalThis.fetch = original; }
});

test('a polled view answers null on 304 and keeps the last ETag', async () => {
  const original = globalThis.fetch, seen = [];
  try {
    globalThis.fetch = async (_url, init) => { seen.push(init.headers['If-None-Match'] || ''); return seen.length === 1 ? new Response('{"ok":1}', { status: 200, headers: { ETag: '"v1"' } }) : new Response(null, { status: 304, headers: { ETag: '"v1"' } }); };
    const tag = { current: '' };
    assert.deepEqual(await apiIfChanged('/api/command-center', tag), { ok: 1 });
    assert.equal(tag.current, '"v1"');
    assert.equal(await apiIfChanged('/api/command-center', tag), null);
    assert.deepEqual(seen, ['', '"v1"']);
  } finally { globalThis.fetch = original; }
});

test('the Command Center poll uses the conditional read and the route answers with an ETag', () => {
  assert.match(readFileSync('app/spielbereich/modules/command-workspace.tsx', 'utf8'), /apiIfChanged<Snapshot>\('\/api\/command-center', snapshotTag\)/);
  const route = readFileSync('app/api/command-center/route.ts', 'utf8');
  assert.equal((route.match(/jsonIfChanged\(req,/g) || []).length, 2);
  assert.match(readFileSync('server/access.ts', 'utf8'), /status: 304/);
});

test('scene images in the reader load lazily', () => {
  assert.match(readFileSync('app/spielbereich/modules/rich-text.tsx', 'utf8'), /<img key=\{index\} loading="lazy" decoding="async"/);
});
