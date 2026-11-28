import { randomUUID } from 'node:crypto';
import { encodeRichText } from '../domain/location-rich-text.ts';
import { defaultWorldIntro } from '../app/kampagne/welt/content.ts';

// Öffentliche Welt, curated glimpse: entry-addressed images, the SL-maintained intro and the fixed caps. Every new
// route is checked for guest, player and SL. Images are served only for what /api/public-world shows right now.
export async function publicWorldShowcaseIntegration({ req, check, base, ids }) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Public world QA requires an isolated local worker.');
  const tag = randomUUID().slice(0, 8);
  const raw = async (path, who, method = 'GET', body) => {
    const response = await fetch(base + path, { method, redirect: 'manual', headers: { ...(who ? ids[who] : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { s: response.status, bytes: Buffer.from(await response.arrayBuffer()), headers: response.headers };
  };
  const world = async who => { const r = await raw('/api/public-world', who); return { s: r.s, text: r.bytes.toString('utf8'), d: r.s === 200 ? JSON.parse(r.bytes.toString('utf8')) : null }; };
  const page = async who => { const r = await raw('/kampagne/welt', who); return { s: r.s, text: r.bytes.toString('utf8') }; };
  const image = (kind, id, who, method = 'GET') => raw('/api/public-world/image?kind=' + encodeURIComponent(kind) + '&id=' + encodeURIComponent(id), who, method);
  // Distinct valid PNGs: bytes after IEND are ignored by decoders, so each upload is recognisable by its content.
  const png = label => Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=', 'base64'), Buffer.from('cvk-' + label + '-' + tag)]);
  const upload = async (path, bytes, extra = {}) => {
    const form = new FormData();
    form.set('file', new Blob([bytes], { type: 'image/png' }), 'public-world-' + tag + '.png');
    for (const [key, value] of Object.entries(extra)) form.set(key, value);
    const r = await req(path, 'gm', 'POST', form);
    check([200, 201].includes(r.s) && !!r.d.id, 'SHOWCASE synthetic image uploaded into private storage via ' + path);
    return r.d.id;
  };
  const create = async title => {
    const r = await req('/api/cms/locations', 'gm', 'POST', { level: 'location', title });
    check(r.s === 201, 'SHOWCASE synthetic main place created'); return r.d;
  };
  const publish = async (node, payload, heroFileId) => {
    const saved = await req('/api/cms/drafts', 'gm', 'PATCH', { revisionId: node.revisionId, expectedVersion: 1, payload, ...(heroFileId ? { heroFileId } : {}) });
    const review = await req('/api/cms/transitions', 'gm', 'POST', { action: 'submit', revisionId: node.revisionId, expectedVersion: saved.d.version });
    const approved = await req('/api/cms/transitions', 'gm', 'POST', { action: 'approve', revisionId: node.revisionId, expectedVersion: review.d.version });
    const released = await req('/api/cms/releases', 'gm', 'POST', { action: 'publish', entityId: node.id, scope: 'group', revisionId: node.revisionId, expectedReleaseVersion: 0, discoveryState: 'known', reason: 'Isolated showcase acceptance' });
    check([saved, review, approved, released].every(r => r.s === 200), 'SHOWCASE synthetic place published to the group (isolated database only)');
  };
  const node = async id => (await req('/api/cms/locations?place=' + encodeURIComponent(id), 'gm')).d.nodes?.find(item => item.id === id);
  const mark = async (id, show = true) => { const current = await node(id); return req('/api/cms/location-website', 'gm', 'POST', { entityId: id, expectedRevision: current.revision, show }); };
  const npc = (title, profile, extra = {}) => req('/api/entities/npc', 'gm', 'POST', { title, canonStatus: 'draft', playState: 'unplayed', defaultVisibility: 'player_visible', profile, blocks: [], retainedRelationships: [], addedRelationships: [], ...extra });

  // 1. Website intro: SL only, version protected; guests read it sanitized, or the default sentence when empty.
  for (const [who, expected] of [[undefined, 401], ['a', 403]]) {
    check((await raw('/api/cms/public-world', who)).s === expected, 'SHOWCASE ' + (who ?? 'guests') + ' cannot read the SL website overview (' + expected + ')');
    check((await raw('/api/cms/public-world', who, 'POST', { text: 'x', expectedVersion: 0 })).s === expected, 'SHOWCASE ' + (who ?? 'guests') + ' cannot change the website intro (' + expected + ')');
  }
  const overview0 = await req('/api/cms/public-world', 'gm');
  check(overview0.s === 200 && typeof overview0.d.intro.version === 'number' && overview0.d.places.limit === 4 && overview0.d.people.limit === 7 && overview0.d.chronicle.limit === 3, 'SHOWCASE the SL overview reports intro version and the fixed caps 4/7/3');
  const before = await world();
  check(before.s === 200 && before.d.intro === '', 'SHOWCASE the public intro is empty before the SL writes one');
  check((await page()).text.includes(defaultWorldIntro.slice(0, 40)), 'SHOWCASE the guest page shows the calm default sentence for an empty intro');
  const introText = encodeRichText({ version: 1, blocks: [
    { type: 'paragraph', children: [{ text: 'Kleve schläft nie ganz. ' + tag + ' ' }, { text: 'Zum Dossier', href: '/spielbereich?bereich=chronik&eintrag=INTRO_SECRET_' + tag }] },
    { type: 'image', fileId: 'INTRO_FILE_' + tag, alt: 'Karte' },
  ] });
  const savedIntro = await req('/api/cms/public-world', 'gm', 'POST', { text: introText, expectedVersion: overview0.d.intro.version });
  check(savedIntro.s === 200 && savedIntro.d.version === overview0.d.intro.version + 1, 'SHOWCASE the SL saves the website intro (version advances)');
  check((await req('/api/cms/public-world', 'gm', 'POST', { text: 'veraltet', expectedVersion: overview0.d.intro.version })).s === 409, 'SHOWCASE a stale intro save gets a conflict instead of an overwrite');
  check((await req('/api/cms/public-world', 'gm', 'POST', { text: 'x'.repeat(2001), expectedVersion: savedIntro.d.version })).s === 413, 'SHOWCASE an over-long intro is refused');
  const withIntro = await world();
  check(withIntro.d.intro.includes('Kleve schläft nie ganz.') && !withIntro.text.includes('INTRO_SECRET_') && !withIntro.text.includes('INTRO_FILE_') && !withIntro.text.includes('/spielbereich'), 'SHOWCASE guests read the intro without its image and internal link');
  const introPage = await page();
  check(introPage.text.includes('Kleve schläft nie ganz.') && !introPage.text.includes(defaultWorldIntro.slice(0, 40)), 'SHOWCASE the guest page shows the SL intro instead of the default');

  // 2. Images through the entry, from all three upload sources.
  const bytesR = png('revision'), bytesM = png('medium'), bytesP = png('portrait'), bytesQ = png('hidden'), bytesZ = png('cut'), bytesC = png('cut-place'), bytesU = png('unmarked'), bytesK = png('unknown');
  const fileR = await upload('/api/cms/media', bytesR);
  const placeR = await create('Schaufenster Revision ' + tag);
  await publish(placeR, { title: placeR.title, subtitle: 'Mit Ortsbild', summary: 'Ein Ort mit veröffentlichtem Titelbild.' }, fileR);
  const placeM = await create('Schaufenster Medium ' + tag);
  await publish(placeM, { title: placeM.title, summary: 'Ein Ort mit freigegebenem Ortsmedium.' });
  const fileM = await upload('/api/cms/location-files', bytesM);
  const medium = await req('/api/cms/location-content', 'gm', 'POST', { entityId: placeM.id, kind: 'media', position: 0, expectedVersion: 0, data: { title: 'Außenansicht', description: '', fileId: fileM, mediaType: 'exterior', hero: true, playerReleased: true, state: 'active' } });
  check(medium.s === 201, 'SHOWCASE a released hero medium is attached to the main place');
  const fileU = await upload('/api/cms/media', bytesU);
  const placeU = await create('Unmarkierter Ort ' + tag);
  await publish(placeU, { title: placeU.title, summary: 'Nicht markiert.' }, fileU);
  const fileK = await upload('/api/cms/media', bytesK);
  const placeK = await create('Unbekannter Ort ' + tag);
  const draftK = await req('/api/cms/drafts', 'gm', 'PATCH', { revisionId: placeK.revisionId, expectedVersion: 1, payload: { title: placeK.title }, heroFileId: fileK });
  check(draftK.s === 200, 'SHOWCASE an unreleased place carries a hero only in its draft');
  for (const id of [placeR.id, placeM.id, placeK.id]) check((await mark(id)).s === 200, 'SHOWCASE the SL marks a showcase candidate');
  const fileP = await upload('/api/files', bytesP, { visibility: 'sl' });
  const fileQ = await upload('/api/files', bytesQ, { visibility: 'sl' });
  const personP = await npc('Anna Porträt ' + tag, { summary: 'Mit freigegebenem Porträt.', image_primary: '/api/files?id=' + fileP, show_on_website: true, field_visibility: { name: 'player_visible', summary: 'player_visible', image_primary: 'player_visible' } });
  const personQ = await npc('Bruno Ohne Bild ' + tag, { image_primary: '/api/files?id=' + fileQ, show_on_website: true, field_visibility: { name: 'player_visible' } });
  check(personP.s === 200 && personQ.s === 200, 'SHOWCASE synthetic people with released and unreleased portraits');

  const pub = await world();
  const place = id => pub.d.places.find(item => item.id === id), person = id => pub.d.people.find(item => item.id === id);
  check(place(placeR.id)?.image === '/api/public-world/image?kind=place&id=' + encodeURIComponent(placeR.id), 'SHOWCASE a revision hero is addressed by the place, not the file');
  check(place(placeM.id)?.image === '/api/public-world/image?kind=place&id=' + encodeURIComponent(placeM.id), 'SHOWCASE a hero medium is addressed by the place, not the file');
  check(person(personP.d.id)?.image === '/api/public-world/image?kind=person&id=' + encodeURIComponent(personP.d.id), 'SHOWCASE a released portrait is addressed by the person, not the file');
  check(person(personQ.d.id)?.image === '', 'SHOWCASE an unreleased portrait leaves the person without an image');
  check(!place(placeU.id) && !place(placeK.id), 'SHOWCASE unmarked and unknown places stay off the website');
  for (const secretId of [fileR, fileM, fileP, fileQ, fileU, fileK, medium.d.item.id]) check(!pub.text.includes(secretId), 'SHOWCASE the public JSON never contains an upload or medium ID');

  for (const [kind, id, bytes, label] of [['place', placeR.id, bytesR, 'revision hero'], ['place', placeM.id, bytesM, 'hero medium'], ['person', personP.d.id, bytesP, 'portrait']]) {
    const shots = [await image(kind, id), await image(kind, id, 'a'), await image(kind, id, 'gm')];
    check(shots.every(shot => shot.s === 200 && shot.bytes.equals(bytes)), 'SHOWCASE guest, player and SL receive the same ' + label + ' bytes');
    const headers = shots[0].headers;
    check(headers.get('content-type') === 'image/png' && headers.get('x-content-type-options') === 'nosniff' && /max-age=300/.test(headers.get('cache-control') || '') && !headers.get('set-cookie'), 'SHOWCASE the ' + label + ' has image type, nosniff, a five-minute cache and no cookie');
  }
  const notFound = [
    ['person', personQ.d.id, 'an unreleased portrait'], ['place', placeU.id, 'an unmarked place'], ['place', placeK.id, 'a place the group does not know'],
    ['person', placeR.id, 'a place ID asked as a person'], ['place', personP.d.id, 'a person ID asked as a place'], ['place', 'place.does-not-exist-' + tag, 'an unknown ID'],
    ['bild', placeR.id, 'an invalid kind'], ['place', '', 'a missing ID'],
  ];
  for (const [kind, id, label] of notFound) for (const who of [undefined, 'a', 'gm']) {
    const r = await image(kind, id, who);
    check(r.s === 404 && !r.headers.get('content-type')?.startsWith('image/'), 'SHOWCASE 404 for ' + label + ' (' + (who ?? 'guest') + ')');
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) check((await image('place', placeR.id, undefined, method)).s === 405, 'SHOWCASE ' + method + ' on the image route is refused (405)');
  const imagePage = await page();
  check(imagePage.text.includes('/api/public-world/image?kind=place') && imagePage.text.includes('Porträt von Anna Porträt ' + tag) && [fileR, fileM, fileP, fileQ].every(id => !imagePage.text.includes(id)), 'SHOWCASE the guest page shows images through the entry route with alt text, never a file ID');

  // 3. Fixed caps with a followable order; the SL overview shows the same selection.
  const extraPlaces = [];
  for (let index = 1; index <= 3; index++) {
    const extra = await create('Schaufenster Reihe ' + index + ' ' + tag);
    await publish(extra, { title: extra.title, summary: 'Reihe ' + index + '.' }, index === 3 ? await upload('/api/cms/media', bytesC) : undefined);
    check((await mark(extra.id)).s === 200, 'SHOWCASE the SL marks an additional place');
    extraPlaces.push(extra);
  }
  const cutPlace = extraPlaces[2];
  const baselinePeople = (await world()).d.people.length;
  const fileZ = await upload('/api/files', bytesZ, { visibility: 'sl' });
  for (let index = 1; index <= Math.max(0, 7 - baselinePeople); index++) check((await npc('Yara Füllfigur ' + index + ' ' + tag, { show_on_website: true, field_visibility: { name: 'player_visible' } })).s === 200, 'SHOWCASE synthetic filler person marked');
  const cutPerson = await npc('Zzz Letzte Figur ' + tag, { image_primary: '/api/files?id=' + fileZ, show_on_website: true, field_visibility: { name: 'player_visible', image_primary: 'player_visible' } });
  check(cutPerson.s === 200, 'SHOWCASE the alphabetically last person has a released portrait');
  const chronicle = [];
  for (const day of ['01', '02', '03', '04']) {
    const entry = await req('/api/records', 'gm', 'POST', { kind: 'chronik', title: 'Auszug ' + day + ' ' + tag, visibility: 'group', body: { type: 'ereignis', date: '2026-01-' + day, text: 'Ereignis vom ' + day + '. Januar.', showOnWebsite: true } });
    check(entry.s === 200, 'SHOWCASE synthetic marked chronicle entry'); chronicle.push(entry.d);
  }
  const capped = await world();
  check(capped.d.places.length === 4 && capped.d.people.length === 7 && capped.d.chronicle.length === 3, 'SHOWCASE the public world is capped at 4 places, 7 people and 3 chronicle excerpts');
  check(!capped.d.places.some(item => item.id === cutPlace.id) && capped.d.places.some(item => item.id === placeR.id), 'SHOWCASE beyond the place cap, the Orte-Werkstatt order decides (the newest place is cut)');
  check(!capped.d.people.some(item => item.id === cutPerson.d.id), 'SHOWCASE beyond the person cap, alphabetical order decides (the last name is cut)');
  check(capped.d.chronicle.map(item => item.date).join() === '2026-01-04,2026-01-03,2026-01-02', 'SHOWCASE the three newest chronicle entries are shown, newest first');
  check((await image('place', cutPlace.id)).s === 404 && (await image('person', cutPerson.d.id)).s === 404, 'SHOWCASE entries cut by the cap get no image either');
  const overview = (await req('/api/cms/public-world', 'gm')).d;
  const shownIds = section => overview[section].items.filter(item => item.shown).map(item => item.id).join();
  check(shownIds('places') === capped.d.places.map(item => item.id).join() && shownIds('people') === capped.d.people.map(item => item.id).join() && shownIds('chronicle') === capped.d.chronicle.map(item => item.id).join(), 'SHOWCASE the SL overview marks exactly the entries the public world shows');
  check(overview.places.items.some(item => item.id === cutPlace.id && item.shown === false) && overview.people.items.some(item => item.id === cutPerson.d.id && item.shown === false), 'SHOWCASE the SL overview names the entries the cap cuts');
  check(overview.places.marked > overview.places.items.length, 'SHOWCASE the SL overview counts marked places the group does not know yet');
  const [guestJson, playerJson, slJson] = [await world(), await world('a'), await world('gm')];
  check(guestJson.text === playerJson.text && guestJson.text === slJson.text, 'SHOWCASE guest, player and SL receive the identical capped projection');
  const cappedPage = await page();
  check(cappedPage.s === 200 && cappedPage.text.includes('Werde Teil der Chronik') && cappedPage.text.includes('href="/anmelden"') && !cappedPage.text.includes(cutPerson.d.id) && !/<form[\s>]/i.test(cappedPage.text), 'SHOWCASE the guest page ends with the alpha call to action and shows no cut entry and no form');

  // 4. Archiving removes a showcase place and its image.
  const archiveTarget = await node(placeM.id);
  check((await req('/api/cms/location-structure', 'gm', 'POST', { entityId: placeM.id, expectedRevision: archiveTarget.revision, action: 'archive', reason: 'Isolated showcase archive check' })).s === 200, 'SHOWCASE the SL archives a marked showcase place');
  check((await image('place', placeM.id)).s === 404 && !(await world()).d.places.some(item => item.id === placeM.id), 'SHOWCASE an archived place loses its public entry and image');

  // Restore shared state: remove flags of the synthetic places, the chronicle entries and the intro.
  for (const id of [placeR.id, placeK.id, ...extraPlaces.map(item => item.id)]) await mark(id, false);
  for (const entry of chronicle) await req('/api/records', 'gm', 'DELETE', { id: entry.id, version: entry.version });
  const finalIntro = (await req('/api/cms/public-world', 'gm')).d.intro;
  check((await req('/api/cms/public-world', 'gm', 'POST', { text: '', expectedVersion: finalIntro.version })).s === 200, 'SHOWCASE the intro is cleared again (default sentence)');
}
