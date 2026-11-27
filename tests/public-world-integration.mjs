import { randomUUID } from 'node:crypto';
import { encodeRichText } from '../domain/location-rich-text.ts';

// Öffentliche Welt: guests read only entries that the SL explicitly marked for the website AND the group already sees.
// Every new route is checked for guest, player and SL; marker strings must never reach the public API or page HTML.
export async function publicWorldIntegration({ req, check, base, ids }) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Public world QA requires an isolated local worker.');
  const tag = randomUUID().slice(0, 8);
  const secret = 'PUBLIC_WORLD_SECRET_' + tag;
  const raw = async (path, who, method = 'GET', body) => {
    const response = await fetch(base + path, { method, redirect: 'manual', headers: { ...(who ? ids[who] : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { s: response.status, text: await response.text(), headers: response.headers };
  };
  const world = async who => { const r = await raw('/api/public-world', who); return { ...r, d: r.s === 200 ? JSON.parse(r.text) : null }; };
  const page = async who => raw('/kampagne/welt', who);

  // 1. The anonymous read needs no login and is empty until the SL marks something.
  const start = await world();
  check(start.s === 200 && Array.isArray(start.d.places) && Array.isArray(start.d.people) && Array.isArray(start.d.chronicle), 'PUBLIC-WORLD guests read the public world without a login');
  check(start.d.places.length === 0 && start.d.people.length === 0 && start.d.chronicle.length === 0, 'PUBLIC-WORLD nothing is public before the SL marks it (group releases never become public automatically)');
  check(!start.headers.get('set-cookie') && /no-store/.test(start.headers.get('cache-control') || ''), 'PUBLIC-WORLD the public read sets no cookie and is not cached');
  const emptyPage = await page();
  check(emptyPage.s === 200 && emptyPage.text.includes('Noch ist nichts veröffentlicht'), 'PUBLIC-WORLD the guest page shows a friendly empty state');
  const campaign = await raw('/kampagne');
  check(campaign.s === 200 && campaign.text.includes('href="/kampagne/welt"') && campaign.text.includes('Die Welt'), 'PUBLIC-WORLD /kampagne offers guests the tile "Die Welt"');

  // 2. The public route has no write method, for nobody.
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
    for (const who of [undefined, 'a', 'gm']) {
      const r = await raw('/api/public-world', who, method, { places: [{ id: 'x' }] });
      check(r.s === 405, `PUBLIC-WORLD ${method} on the public route is refused for ${who ?? 'guests'} (${r.s})`);
    }

  // 3. CMS fixtures: one released place, one unreleased place, one place that gets archived, plus SL-only children.
  const create = async (level, title, parentId) => {
    const r = await req('/api/cms/locations', 'gm', 'POST', { level, title, ...(parentId ? { parentId } : {}) });
    check(r.s === 201, 'PUBLIC-WORLD synthetic ' + level + ' created in the isolated database'); return r.d;
  };
  const publish = async (node, payload) => {
    const saved = await req('/api/cms/drafts', 'gm', 'PATCH', { revisionId: node.revisionId, expectedVersion: 1, payload });
    const review = await req('/api/cms/transitions', 'gm', 'POST', { action: 'submit', revisionId: node.revisionId, expectedVersion: saved.d.version });
    const approved = await req('/api/cms/transitions', 'gm', 'POST', { action: 'approve', revisionId: node.revisionId, expectedVersion: review.d.version });
    const released = await req('/api/cms/releases', 'gm', 'POST', { action: 'publish', entityId: node.id, scope: 'group', revisionId: node.revisionId, expectedReleaseVersion: 0, discoveryState: 'known', reason: 'Isolated public world acceptance' });
    check([saved, review, approved, released].every(r => r.s === 200), 'PUBLIC-WORLD synthetic baseline published to the group (isolated database only)');
  };
  const released = await create('location', 'Öffentlicher Hafen ' + tag);
  await publish(released, { title: released.title, subtitle: 'Am Wasser', district: 'Unterstadt', summary: 'Nebel über dem Kai.', address: 'Hafenstraße 1 ' + secret + '_ADDRESS' });
  const releasedArea = await create('area', secret + '_AREA', released.id);
  await publish(releasedArea, { title: releasedArea.title, playerHint: secret + '_AREA_HINT' });
  await create('information', secret + '_INFO', released.id);
  const unreleased = await create('location', secret + '_UNRELEASED_PLACE');
  const archived = await create('location', 'Archivierter Ort ' + tag);
  await publish(archived, { title: archived.title, summary: 'Bald im Archiv.' });

  const node = async (id, placeId = id) => (await req('/api/cms/locations?place=' + encodeURIComponent(placeId), 'gm')).d.nodes?.find(item => item.id === id);
  const mark = (who, entityId, expectedRevision, show = true) => req('/api/cms/location-website', who, 'POST', { entityId, expectedRevision, show });

  // 4. Only the SL may set the place flag; stale and non-root writes are refused.
  let root = await node(released.id);
  check(root?.showOnWebsite === false, 'PUBLIC-WORLD the SL node list reports the website flag of a main place');
  const guestMark = await raw('/api/cms/location-website', undefined, 'POST', { entityId: released.id, expectedRevision: root.revision, show: true });
  check(guestMark.s === 401, 'PUBLIC-WORLD guests cannot mark a place for the website (' + guestMark.s + ')');
  check((await mark('a', released.id, root.revision)).s === 403, 'PUBLIC-WORLD players cannot mark a place for the website');
  check((await mark('gm', released.id, root.revision + 5)).s === 409, 'PUBLIC-WORLD a stale SL click gets a conflict instead of an overwrite');
  check((await mark('gm', releasedArea.id, (await node(releasedArea.id, released.id))?.revision ?? 1)).s === 400, 'PUBLIC-WORLD only main places carry a website flag');
  const marked = await mark('gm', released.id, root.revision);
  check(marked.s === 200 && marked.d.showOnWebsite === true && marked.d.revision === root.revision + 1, 'PUBLIC-WORLD the SL marks the released place (revision advances)');
  root = await node(released.id);
  check(root.showOnWebsite === true, 'PUBLIC-WORLD the SL node list shows the stored flag');
  check((await mark('gm', unreleased.id, (await node(unreleased.id)).revision)).s === 200, 'PUBLIC-WORLD the SL marks a place the group does not know');
  check((await mark('gm', 'place.ungranted-secret', (await node('place.ungranted-secret')).revision)).s === 200, 'PUBLIC-WORLD the SL marks the ungranted fixture place');
  const archivedMark = await mark('gm', archived.id, (await node(archived.id)).revision);
  check(archivedMark.s === 200, 'PUBLIC-WORLD the SL marks a released place that will be archived');
  const night = await node('place.synthetic-night-market');
  check((await mark('gm', 'place.synthetic-night-market', night.revision)).s === 200, 'PUBLIC-WORLD the SL marks the group-known fixture place');

  let pub = await world();
  const firstIds = pub.d.places.map(place => place.id);
  check(firstIds.includes(released.id), 'PUBLIC-WORLD a marked, group-released place appears for guests');
  const groupNight = await req('/api/locations?place=place.synthetic-night-market&view=player&target=group', 'gm');
  const nightKnown = groupNight.s === 200 && ['known', 'visited', 'investigated'].includes(groupNight.d.projection.location.discovery);
  check(firstIds.includes('place.synthetic-night-market') === nightKnown, 'PUBLIC-WORLD a marked legacy place appears exactly when the group knows it');
  check(!firstIds.includes(unreleased.id) && !firstIds.includes('place.ungranted-secret'), 'PUBLIC-WORLD a marked place the group does not know stays off the website');
  const harbour = pub.d.places.find(place => place.id === released.id);
  check(harbour.title === released.title && harbour.subtitle === 'Am Wasser' && harbour.district === 'Unterstadt' && harbour.summary.includes('Nebel über dem Kai.'), 'PUBLIC-WORLD the place carries its released name, subtitle, district and description');
  check(Object.keys(harbour).sort().join() === 'atmosphere,district,id,image,subtitle,summary,title,worldState', 'PUBLIC-WORLD the place carries only allowlisted fields');
  check(firstIds.includes(archived.id), 'PUBLIC-WORLD the archive fixture is public before archiving');
  const archivedNode = await node(archived.id);
  check((await req('/api/cms/location-structure', 'gm', 'POST', { entityId: archived.id, expectedRevision: archivedNode.revision, action: 'archive', reason: 'Isolated public world archive check' })).s === 200, 'PUBLIC-WORLD the SL archives the marked place');

  // 5. Persönlichkeiten: released + name released + marked → public; every other combination stays private.
  const npc = (title, extra = {}) => ({ title, canonStatus: 'draft', playState: 'unplayed', defaultVisibility: 'player_visible', profile: { field_visibility: { name: 'player_visible' } }, blocks: [], retainedRelationships: [], addedRelationships: [], ...extra });
  const visiblePerson = npc('Öffentliche Persönlichkeit ' + tag, {
    profile: { alias: 'Die Füchsin', role: 'Informantin', clan: secret + '_CLAN', summary: 'Kennt die Gassen.', location_note: secret + '_WHEREABOUTS', show_on_website: true,
      field_visibility: { name: 'player_visible', alias: 'player_visible', role: 'player_visible', summary: 'player_visible' } },
    blocks: [{ kind: 'sl_secrets', content: secret + '_SL_BLOCK', visibility: 'sl_secret', position: 0 }, { kind: 'bio', content: secret + '_PLAYER_BLOCK', visibility: 'player_visible', position: 1 }],
  });
  check([401, 403].includes((await req('/api/entities/npc', 'a', 'POST', visiblePerson)).s), 'PUBLIC-WORLD players cannot author a marked NPC');
  const person = await req('/api/entities/npc', 'gm', 'POST', visiblePerson);
  const locked = await req('/api/entities/npc', 'gm', 'POST', npc(secret + '_LOCKED', { defaultVisibility: 'sl_secret', profile: { show_on_website: true, field_visibility: { name: 'player_visible' } } }));
  const anonymous = await req('/api/entities/npc', 'gm', 'POST', npc(secret + '_ANONYMOUS', { profile: { summary: 'Ohne Namen.', show_on_website: true, field_visibility: { summary: 'player_visible' } } }));
  const unmarked = await req('/api/entities/npc', 'gm', 'POST', npc(secret + '_UNMARKED'));
  check([person, locked, anonymous, unmarked].every(r => r.s === 200), 'PUBLIC-WORLD synthetic NPCs created by the SL');
  const groupEntities = JSON.stringify((await req('/api/entities', 'a')).d);
  check(groupEntities.includes(secret + '_UNMARKED'), 'PUBLIC-WORLD the unmarked NPC is visible to the group (control)');

  // 6. Chronik: group + marked → public; drafts, unmarked and player entries never.
  const chronicleText = encodeRichText({ version: 1, blocks: [
    { type: 'paragraph', children: [{ text: 'Der Prinz rief zur Versammlung. ' }, { text: 'Zum Dossier', href: '/spielbereich?bereich=schauplaetze&ort=' + secret }] },
    { type: 'image', fileId: secret + '_FILE', alt: 'Plan' },
  ] });
  const chronicle = async (who, title, visibility, body, extra = {}) => req('/api/records', who, 'POST', { kind: 'chronik', title, visibility, body, ...extra });
  const shownEntry = await chronicle('gm', 'Die Versammlung ' + tag, 'group', { type: 'ereignis', date: '2026-03-12', text: chronicleText, showOnWebsite: true, sessionId: secret + '_SESSION' }, { gmBody: secret + '_GM_BODY' });
  const draftEntry = await chronicle('gm', secret + '_DRAFT', 'sl', { type: 'ereignis', date: '2026-03-13', text: 'Entwurf', showOnWebsite: true });
  const unmarkedEntry = await chronicle('gm', secret + '_UNMARKED_ENTRY', 'group', { type: 'ereignis', date: '2026-03-14', text: 'Nur für die Runde' });
  // An old entry with plain HTML (no rich-text prefix): image and internal link must not survive as text either.
  const legacyEntry = await chronicle('gm', 'Alte Nachricht ' + tag, 'group', { date: '2025-12-01', text: '<p>Ein Brief aus alter Zeit.</p><img src="/api/files?id=' + secret + '_LEGACY_FILE"><p><a href="/spielbereich?bereich=chronik">Zum Archiv</a> /api/files?id=' + secret + '_PASTED</p>', showOnWebsite: true });
  check([shownEntry, draftEntry, unmarkedEntry, legacyEntry].every(r => r.s === 200), 'PUBLIC-WORLD synthetic chronicle entries created by the SL');
  check((await chronicle('a', secret + '_PLAYER_ENTRY', 'group', { text: 'x', showOnWebsite: true })).s === 403, 'PUBLIC-WORLD players cannot write a marked chronicle entry');
  const playerNote = await req('/api/records', 'a', 'POST', { kind: 'notizen', title: secret + '_PLAYER_NOTE', visibility: 'group', body: { text: 'x', showOnWebsite: true } });
  check(playerNote.s === 200, 'PUBLIC-WORLD a player may still write a personal note carrying the flag key');

  // 7. Everyone gets the identical public answer; nothing secret leaks into the API or the page HTML.
  const [guestWorld, playerWorld, slWorld] = [await world(), await world('a'), await world('gm')];
  check(guestWorld.s === 200 && playerWorld.s === 200 && slWorld.s === 200 && guestWorld.text === playerWorld.text && guestWorld.text === slWorld.text, 'PUBLIC-WORLD guest, player and SL receive the identical public projection');
  pub = guestWorld;
  const placeIds = pub.d.places.map(place => place.id);
  check(!placeIds.includes(archived.id), 'PUBLIC-WORLD an archived place leaves the website although it stays marked');
  const people = pub.d.people;
  const fox = people.find(item => item.id === person.d.id);
  check(people.length === 1 && !!fox, 'PUBLIC-WORLD only the released, named and marked NPC is public');
  check(fox.name === visiblePerson.title && fox.alias === 'Die Füchsin' && fox.role === 'Informantin' && fox.clan === '' && fox.summary.includes('Kennt die Gassen.'), 'PUBLIC-WORLD the NPC shows only released fields (unreleased clan stays empty)');
  const entries = pub.d.chronicle;
  const assembly = entries.find(item => item.id === shownEntry.d.id);
  const legacy = entries.find(item => item.id === legacyEntry.d.id);
  check(!!legacy && legacy.text.includes('Ein Brief aus alter Zeit.') && legacy.text.includes('Zum Archiv'), 'PUBLIC-WORLD an old HTML entry keeps its readable text');
  check(entries.length === 2 && !!assembly && assembly.date === '2026-03-12' && assembly.kind === 'ereignis' && assembly.text.includes('Der Prinz rief zur Versammlung.'), 'PUBLIC-WORLD only group-released, marked chronicle entries are public');
  check(Object.keys(assembly).sort().join() === 'date,id,kind,text,title', 'PUBLIC-WORLD the chronicle entry carries only allowlisted fields');
  const forbidden = [secret, '/api/files', '/api/cms/media', '/api/locations/media', '/spielbereich', 'SYNTHETIC_UNGRANTED_PLACE', 'SYNTHETIC_SECRET_ROOM', 'Isolated QA action', 'sprint1-'];
  for (const value of forbidden) check(!pub.text.includes(value), 'PUBLIC-WORLD the public API never contains ' + value);
  const guestPage = await page();
  check(guestPage.s === 200 && guestPage.text.includes(released.title) && guestPage.text.includes(visiblePerson.title) && guestPage.text.includes('Die Versammlung ' + tag), 'PUBLIC-WORLD the guest page shows the public place, person and chronicle entry');
  for (const value of forbidden) check(!guestPage.text.includes(value), 'PUBLIC-WORLD the guest page HTML never contains ' + value);
  check(!/<form[\s>]/i.test(guestPage.text) && !guestPage.text.includes('Notiz'), 'PUBLIC-WORLD the guest page offers no form and no notes');
  const playerPage = await page('a');
  check(playerPage.s === 200 && !playerPage.text.includes(secret), 'PUBLIC-WORLD a signed-in player sees the same safe public page');

  // 8. A normal NPC editor save keeps the flag; unmarking removes the entry again.
  const personDraft = (await req('/api/entities/npc?id=' + person.d.id, 'gm')).d;
  const resave = { ...visiblePerson, id: person.d.id, revision: personDraft.revision, profile: { summary: 'Kennt jede Gasse.' }, blocks: personDraft.blocks.map(block => ({ id: block.id, kind: block.kind, content: block.content, visibility: block.visibility, position: block.position })), retainedRelationships: [] };
  check((await req('/api/entities/npc', 'gm', 'POST', resave)).s === 200, 'PUBLIC-WORLD the SL edits the NPC without touching the flag');
  check((await world()).d.people.some(item => item.id === person.d.id && item.summary.includes('Kennt jede Gasse.')), 'PUBLIC-WORLD an unrelated NPC save keeps the website flag');
  const unmark = await mark('gm', released.id, root.revision, false);
  check(unmark.s === 200 && !(await world()).d.places.some(place => place.id === released.id), 'PUBLIC-WORLD unmarking removes the place from the website');

  // Restore: remove the flags of the shared fixture places and the synthetic chronicle entries.
  for (const id of ['place.synthetic-night-market', 'place.ungranted-secret', unreleased.id]) {
    const current = await node(id);
    if (current?.showOnWebsite) check((await mark('gm', id, current.revision, false)).s === 200, 'PUBLIC-WORLD fixture flag removed again: ' + id);
  }
  for (const entry of [shownEntry, draftEntry, unmarkedEntry, legacyEntry]) await req('/api/records', 'gm', 'DELETE', { id: entry.d.id, version: entry.d.version });
  await req('/api/records', 'a', 'DELETE', { id: playerNote.d.id, version: playerNote.d.version });
}
