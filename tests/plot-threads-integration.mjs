import { randomUUID } from 'node:crypto';
import { emptyScene } from '../domain/story-scene.ts';
import { emptyStory } from '../domain/command-workspace.ts';
import { emptyThread, newStrand } from '../domain/plot-threads.ts';

/** Storyboard 2.0: plot threads (Phase 3) and scene connections (Phase 2) through the real HTTP routes.
 * Covers roles, CAS, idempotent create, reference checks and that nothing reaches player routes. Synthetic data only. */
export async function plotThreadsIntegration({ req, check }) {
  const path = '/api/command-center/threads';
  for (const who of [undefined, 'a', 'b', 'editor', 'blockedGm', 'pendingGm', 'otherCampaign', 'platformOnly']) {
    check([401, 403].includes((await req(path, who)).s), 'THREAD list denied to ' + (who || 'anonymous'));
    check([401, 403].includes((await req(path, who, 'POST', {})).s), 'THREAD write denied to ' + (who || 'anonymous'));
  }
  const story = await req('/api/command-center/story', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyStory(), title: 'THREAD_SYNTHETIC_BOOK' } });
  const clue = await req('/api/entities', 'gm', 'POST', { type: 'CLUE', title: 'THREAD_SYNTHETIC_CLUE', text: 'THREAD_CLUE_TEXT' });
  const sceneA = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyScene(story.d.story.id), title: 'THREAD_SCENE_A' } });
  const sceneB = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyScene(story.d.story.id), title: 'THREAD_SCENE_B' } });
  check(story.s === 201 && clue.s === 201 && sceneA.s === 201 && sceneB.s === 201, 'THREAD synthetic book, clue and scenes created');
  const a = sceneA.d.scene, b = sceneB.d.scene;

  // Phase 2: connections are checked on the server
  const link = to => ({ id: randomUUID(), to, kind: 'next', label: '', condition: '' });
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: a.id, version: a.version, document: { ...a.document, board: { links: [link(a.id)] } } })).s === 400, 'LINK self connection rejected');
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: a.id, version: a.version, document: { ...a.document, board: { links: [link('scene-missing')] } } })).s === 400, 'LINK unknown target rejected');
  const linked = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: a.id, version: a.version, document: { ...a.document, board: { links: [link(b.id)] } } });
  check(linked.s === 200 && linked.d.scene.document.board.links[0].to === b.id, 'LINK valid connection stored');

  // Phase 3: threads
  const strand = { ...newStrand('consequence', 'THREAD_PRIVATE_CONSEQUENCE', b.id), text: 'THREAD_NEVER_PLAYER' };
  const clueStrand = { ...newStrand('clue', 'THREAD_CLUE_STRAND'), refIds: [clue.d.entity?.id || clue.d.id] };
  const doc = { ...emptyThread(story.d.story.id), title: 'THREAD_SYNTHETIC', strands: [strand, clueStrand] };
  const requestId = randomUUID(), created = await req(path, 'gm', 'POST', { action: 'create', clientRequestId: requestId, document: doc });
  check(created.s === 201 && created.d.thread.version === 1, 'THREAD created by the SL');
  const id = created.d.thread.id;
  check((await req(path, 'gm', 'POST', { action: 'create', clientRequestId: requestId, document: doc })).d.thread?.version === 1, 'THREAD create retry is idempotent');
  check((await req(path, 'gm', 'POST', { action: 'create', clientRequestId: requestId, document: { ...doc, title: 'Other' } })).s === 409, 'THREAD duplicate identity with other content rejected');
  check((await req(path + '?id=' + encodeURIComponent(id), 'a')).s === 403, 'THREAD player cannot read a thread directly');
  const saves = await Promise.all(['Win A', 'Win B'].map(title => req(path, 'gm', 'POST', { action: 'save', id, version: 1, document: { ...doc, title } })));
  check(saves.map(r => r.s).sort().join(',') === '200,409', 'THREAD concurrent saves have exactly one winner');
  const history = await req(path + '?id=' + encodeURIComponent(id) + '&history=1', 'gm');
  check(history.d.thread.version === 2 && history.d.history.length === 2, 'THREAD rejected CAS appends no history');
  check(typeof history.d.knowledge === 'object', 'THREAD returns clue discovery read-only');
  check((await req(path, 'gm', 'POST', { action: 'save', id, version: 2, document: { ...doc, bookIds: ['plot-missing'] } })).s === 404, 'THREAD unknown book rejected');
  check((await req(path, 'gm', 'POST', { action: 'save', id, version: 2, document: { ...doc, strands: [{ ...strand, sceneId: 'scene-missing' }] } })).s === 400, 'THREAD unknown scene rejected');
  check((await req(path, 'gm', 'POST', { action: 'save', id, version: 2, document: { ...doc, strands: [{ ...strand, refIds: [story.d.story.id] }] } })).s === 400, 'THREAD unfit dossier type rejected');
  check((await req(path, 'gm', 'POST', { action: 'save', id, version: 2, document: { ...doc, strands: [{ ...strand, state: 'revealed' }] } })).s === 400, 'THREAD state must fit the strand kind');
  check((await req(path, 'gm', 'POST', { action: 'save', id, version: 2, document: doc }, { Origin: 'https://evil.invalid' })).s === 403, 'THREAD cross-site save denied');

  // Scenes join threads; unknown threads are rejected
  const current = (await req('/api/command-center/scenes?id=' + encodeURIComponent(b.id), 'gm')).d.scene;
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: b.id, version: current.version, document: { ...current.document, board: { threads: ['thread-missing'] } } })).s === 400, 'THREAD scene cannot join an unknown thread');
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: b.id, version: current.version, document: { ...current.document, board: { threads: [id] } } })).s === 200, 'THREAD scene joins an existing thread');

  // Szene 2.0, Etappe 1: passages and moods; mirrors for the current Regie; directions never in the narration
  const moodId = randomUUID(), p1 = randomUUID(), p2 = randomUUID();
  const ws = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyScene(story.d.story.id), title: 'WORKSHOP_SCENE',
    context: { situation: 'WORKSHOP_SITUATION', entries: ['Treppe'] },
    passages: [{ id: p1, title: '01 Treppe', text: 'WORKSHOP_READ_ONE', direction: 'WORKSHOP_DIRECTION_SECRET', moodId }, { id: p2, title: '02 Gang', text: 'WORKSHOP_READ_TWO', direction: '', moodId: '' }],
    moods: [{ id: moodId, name: 'Kellergang', backdropFileId: '', youtube: [{ id: randomUUID(), title: 'Lüftung', videoId: 'abcdefghijk' }], effects: ['fog'], isDefault: true }] } });
  check(ws.s === 201, 'WORKSHOP scene with context, passages and moods created');
  const wsDoc = ws.d.scene.document;
  check(JSON.stringify(wsDoc.narration).includes('WORKSHOP_READ_ONE') && JSON.stringify(wsDoc.narration).includes('WORKSHOP_READ_TWO'), 'WORKSHOP narration mirror holds the passage texts');
  check(!JSON.stringify(wsDoc.narration).includes('WORKSHOP_DIRECTION_SECRET'), 'WORKSHOP SL directions never enter the narration mirror');
  check(wsDoc.youtube?.[0]?.videoId === 'abcdefghijk', 'WORKSHOP default mood feeds the scene music for the current Regie');
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: ws.d.scene.id, version: ws.d.scene.version, document: { ...wsDoc, passages: [{ ...wsDoc.passages[0], moodId: randomUUID() }] } })).s === 400, 'WORKSHOP passage cannot point to a mood of another scene');
  const legacy = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: ws.d.scene.id, version: ws.d.scene.version, document: { ...wsDoc, narration: 'WORKSHOP_CLASSIC_EDIT' } });
  check(legacy.s === 200 && legacy.d.scene.document.passages.length === 1 && legacy.d.scene.document.passages[0].text === 'WORKSHOP_CLASSIC_EDIT' && legacy.d.scene.document.passages[0].direction === 'WORKSHOP_DIRECTION_SECRET', 'WORKSHOP a classic narration edit wins and keeps the directions');
  for (const who of ['a', 'b']) check([401, 403].includes((await req('/api/command-center/scenes?id=' + encodeURIComponent(ws.d.scene.id), who)).s), 'WORKSHOP players cannot read the prepared scene: ' + who);

  // Szene 2.0, Etappe 2: cast (role per NPC) and scene places; mirrors npcIds and placeId; references are checked
  const npc = (await req('/api/entities', 'gm', 'POST', { type: 'NPC', title: 'CAST_SYNTHETIC_NPC', text: 'CAST_NPC' })).d;
  const placeA = (await req('/api/entities', 'gm', 'POST', { type: 'PLACE', title: 'CAST_SYNTHETIC_PLACE_A', text: 'A' })).d;
  const placeB = (await req('/api/entities', 'gm', 'POST', { type: 'PLACE', title: 'CAST_SYNTHETIC_PLACE_B', text: 'B' })).d;
  const npcId = npc.entity?.id || npc.id, placeAId = placeA.entity?.id || placeA.id, placeBId = placeB.entity?.id || placeB.id;
  const castEntry = { id: randomUUID(), npcId, presence: 'later', role: { why: 'CAST_ROLE_SECRET', wants: '', knows: '', hides: '', reacts: '', intervenes: 'CAST_INTERVENES', leaves: '' }, dialogue: '', cardNote: 'CAST_CARD_NOTE' };
  const castScene = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyScene(story.d.story.id), title: 'CAST_SCENE',
    cast: [castEntry], places: [{ id: randomUUID(), placeId: placeAId, main: false, note: '', unlockable: true }, { id: randomUUID(), placeId: placeBId, main: true, note: 'CAST_PLACE_NOTE', unlockable: false }] } });
  check(castScene.s === 201, 'CAST scene with cast and places created');
  const castDoc = castScene.d.scene?.document || {};
  check(JSON.stringify(castDoc.npcIds) === JSON.stringify([npcId]) && castDoc.placeId === placeBId, 'CAST npcIds and placeId mirror cast and main place for the current Regie');
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: castScene.d.scene.id, version: castScene.d.scene.version, document: { ...castDoc, places: [...castDoc.places, { id: randomUUID(), placeId: npcId, main: false, note: '', unlockable: false }] } })).s === 400, 'CAST a scene place must be a place');
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: castScene.d.scene.id, version: castScene.d.scene.version, document: { ...castDoc, cast: [{ ...castEntry, npcId: placeAId }] } })).s === 400, 'CAST a cast member must be an NPC');
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: castScene.d.scene.id, version: castScene.d.scene.version, document: { ...castDoc, places: [{ ...castDoc.places[0], placeId: 'place-missing' }] } })).s === 404, 'CAST unknown place rejected');
  const classic = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: castScene.d.scene.id, version: castScene.d.scene.version, document: { ...castDoc, placeId: placeAId } });
  check(classic.s === 200 && classic.d.scene.document.places.find(p => p.main)?.placeId === placeAId && classic.d.scene.document.places.some(p => p.note === 'CAST_PLACE_NOTE'), 'CAST a classic place edit wins and keeps the place notes');
  for (const who of ['a', 'b']) {
    check([401, 403].includes((await req('/api/command-center/scenes?id=' + encodeURIComponent(castScene.d.scene.id), who)).s), 'CAST players cannot read the cast: ' + who);
    const seen = JSON.stringify((await req('/api/session-scenes', who)).d || {});
    check(!seen.includes('CAST_ROLE_SECRET') && !seen.includes('CAST_CARD_NOTE') && !seen.includes('CAST_PLACE_NOTE'), 'CAST roles, card notes and place notes never reach players: ' + who);
  }

  // Szene 2.0, Etappe 3: material library and uses; copies for the current Regie; library saves refresh the scenes
  const mpath = '/api/command-center/materials';
  for (const who of [undefined, 'a', 'b', 'editor']) {
    check([401, 403].includes((await req(mpath, who)).s), 'MATERIAL library denied to ' + (who || 'anonymous'));
    check([401, 403].includes((await req(mpath, who, 'POST', {})).s), 'MATERIAL write denied to ' + (who || 'anonymous'));
  }
  const letter = { title: 'MATERIAL_LETTER', text: 'MATERIAL_SECRET_CONTENT', material: { type: 'letter', files: [], assetId: '', display: 'single', effect: { open: 'fade', close: 'fade', speed: 'normal', soundFileId: '', afterClose: 'closed' }, note: '' }, tags: ['Keller'], archived: false };
  const mreq = randomUUID(), made = await req(mpath, 'gm', 'POST', { action: 'create', clientRequestId: mreq, document: letter });
  check(made.s === 201 && made.d.material.version === 1, 'MATERIAL library entry created');
  check((await req(mpath, 'gm', 'POST', { action: 'create', clientRequestId: mreq, document: letter })).d.material?.version === 1, 'MATERIAL create retry is idempotent');
  check((await req(mpath, 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...letter, material: { ...letter.material, type: 'pager' } } })).s === 400, 'MATERIAL pager is not a library type');
  const materialId = made.d.material.id, useId = randomUUID();
  const mUse = { id: useId, materialId, how: 'handover', byNpcId: npcId, condition: 'MATERIAL_CONDITION', audience: '', takeable: false };
  const mScene = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyScene(story.d.story.id), title: 'MATERIAL_SCENE', materialUses: [mUse] } });
  const copy = mScene.d.scene?.document.elements.find(e => e.id === useId);
  check(mScene.s === 201 && copy?.kind === 'handout' && copy.title === 'MATERIAL_LETTER' && copy.material?.takeable === false, 'MATERIAL a use becomes a classic element with the same id for the current Regie');
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyScene(story.d.story.id), title: 'MATERIAL_BAD', materialUses: [{ ...mUse, materialId: 'material-missing' }] } })).s === 400, 'MATERIAL unknown library entry rejected');
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyScene(story.d.story.id), title: 'MATERIAL_BAD', materialUses: [{ ...mUse, byNpcId: placeAId }] } })).s === 400, 'MATERIAL only an NPC hands material over');
  const renamed = await req(mpath, 'gm', 'POST', { action: 'save', id: materialId, version: 1, document: { ...letter, title: 'MATERIAL_LETTER_V2' } });
  check(renamed.s === 200 && renamed.d.scenes.refreshed.includes(mScene.d.scene.id), 'MATERIAL a library save refreshes the scenes that use it');
  const refreshed = (await req('/api/command-center/scenes?id=' + encodeURIComponent(mScene.d.scene.id), 'gm')).d.scene;
  check(refreshed.version === 2 && refreshed.document.elements.find(e => e.id === useId)?.title === 'MATERIAL_LETTER_V2', 'MATERIAL the copy in the scene follows the library');
  check((await req(mpath, 'gm', 'POST', { action: 'save', id: materialId, version: 1, document: letter })).s === 409, 'MATERIAL stale library save rejected');
  const handEdited = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: refreshed.id, version: refreshed.version, document: { ...refreshed.document, elements: refreshed.document.elements.map(e => e.id === useId ? { ...e, title: 'MATERIAL_HAND_EDIT' } : e) } });
  check(handEdited.s === 200 && !handEdited.d.scene.document.materialUses.length && handEdited.d.scene.document.elements.some(e => e.title === 'MATERIAL_HAND_EDIT'), 'MATERIAL a classic edit of the copy wins and keeps the element');
  for (const who of ['a', 'b']) {
    check((await req(mpath + '?id=' + encodeURIComponent(materialId), who)).s === 403 || (await req(mpath + '?id=' + encodeURIComponent(materialId), who)).s === 401, 'MATERIAL player cannot read a library entry: ' + who);
    const seen = JSON.stringify((await req('/api/session-scenes', who)).d || {});
    check(!seen.includes('MATERIAL_SECRET_CONTENT') && !seen.includes('MATERIAL_CONDITION'), 'MATERIAL content and use details never reach player scenes: ' + who);
  }

  // Szene 2.0, Etappe 4: insights, interaction cards, events; references inside the scene; event log
  const insightId = randomUUID(), eventId = randomUUID();
  const possibilities = { insights: [{ id: insightId, title: 'POSS_INSIGHT', text: 'POSS_INSIGHT_SECRET', availability: 'gm', howFound: 'POSS_HOW', clueId: clue.d.entity?.id || clue.d.id }],
    events: [{ id: eventId, title: 'POSS_EVENT', trigger: 'POSS_TRIGGER', effect: '', followUps: '', scope: 'evening', timerMinutes: 5, timerVisible: false, manualOnly: true }],
    interactionCards: [{ id: randomUUID(), when: 'POSS_WHEN', then: 'POSS_THEN', materialUseIds: [], insightIds: [insightId], checkIds: [], eventIds: [eventId] }] };
  const pScene = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyScene(story.d.story.id), title: 'POSS_SCENE', ...possibilities } });
  check(pScene.s === 201 && pScene.d.scene.document.insights.length === 1 && pScene.d.scene.document.events[0].scope === 'evening', 'POSS scene with insights, cards and events created');
  check(!JSON.stringify(pScene.d.scene.document.clueIds).includes(clue.d.entity?.id || clue.d.id), 'POSS an insight never adds its clue to the publishable clue list');
  const pDoc = pScene.d.scene.document, save = doc => req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: pScene.d.scene.id, version: pScene.d.scene.version, document: doc });
  check((await save({ ...pDoc, interactionCards: [{ ...pDoc.interactionCards[0], insightIds: [randomUUID()] }] })).s === 400, 'POSS a card cannot point to an insight of another scene');
  check((await save({ ...pDoc, interactionCards: [{ ...pDoc.interactionCards[0], eventIds: [randomUUID()] }] })).s === 400, 'POSS a card cannot point to an event of another scene');
  check((await save({ ...pDoc, insights: [{ ...pDoc.insights[0], clueId: npcId }] })).s === 400, 'POSS an insight can only name a clue or handout dossier');
  for (const who of ['a', 'b']) {
    const seen = JSON.stringify((await req('/api/session-scenes', who)).d || {});
    check(!seen.includes('POSS_INSIGHT_SECRET') && !seen.includes('POSS_TRIGGER') && !seen.includes('POSS_THEN'), 'POSS insights, events and cards never reach player scenes: ' + who);
  }

  // Szene 2.0, Etappe 5: checks by rule profile; V20 checks reach the GE-02 desk as the same classic element
  const v20Id = randomUUID(), storyCheckId = randomUUID();
  const v20Check = { id: v20Id, title: 'CHECK_V20', profileId: 'v20-kleve', spec: { attributeId: 'perception', abilityId: 'medicine' }, difficulty: 7, outcomes: { success: 'CHECK_SUCCESS_SECRET' }, note: '', targetCharacterIds: [] };
  const storyCheck = { id: storyCheckId, title: 'CHECK_STORY', profileId: 'narrative', spec: { approach: 'CHECK_APPROACH' }, difficulty: 3, outcomes: { partial: 'CHECK_PARTIAL' }, note: '', targetCharacterIds: [] };
  const cScene = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyScene(story.d.story.id), title: 'CHECK_SCENE', checks: [v20Check, storyCheck] } });
  const cEl = cScene.d.scene?.document.elements.find(e => e.id === v20Id);
  check(cScene.s === 201 && cEl?.kind === 'check' && cEl.check?.attributeId === 'perception' && cEl.check.difficulty === 7 && cEl.check.consequences.success === 'CHECK_SUCCESS_SECRET', 'CHECK a V20 check becomes the classic check element (same id) for the check desk');
  check(!cScene.d.scene.document.elements.some(e => e.id === storyCheckId), 'CHECK a dice-free check has no classic element');
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyScene(story.d.story.id), title: 'CHECK_BAD', checks: [{ ...v20Check, profileId: 'unknown' }] } })).s === 400, 'CHECK unknown rule profile rejected');
  check((await req('/api/command-center/scenes', 'gm', 'POST', { action: 'create', clientRequestId: randomUUID(), document: { ...emptyScene(story.d.story.id), title: 'CHECK_BAD', checks: [{ ...v20Check, spec: { attributeId: 'luck', abilityId: '' } }] } })).s === 400, 'CHECK unknown trait rejected');
  const cDoc = cScene.d.scene.document;
  const cEdit = await req('/api/command-center/scenes', 'gm', 'POST', { action: 'save', id: cScene.d.scene.id, version: cScene.d.scene.version, document: { ...cDoc, elements: cDoc.elements.map(e => e.id === v20Id ? { ...e, check: { ...e.check, difficulty: 9 } } : e) } });
  check(cEdit.s === 200 && cEdit.d.scene.document.checks.find(c => c.id === v20Id)?.difficulty === 9, 'CHECK a classic edit of the check element wins and the check follows');
  for (const who of ['a', 'b']) {
    const seen = JSON.stringify((await req('/api/session-scenes', who)).d || {});
    check(!seen.includes('CHECK_SUCCESS_SECRET') && !seen.includes('CHECK_APPROACH') && !seen.includes('CHECK_PARTIAL'), 'CHECK prepared checks never reach player scenes: ' + who);
  }

  // Szene 2.0, Etappe 6: SL notebook – own notebook pages with references; SL only
  const npath = '/api/command-center/notes';
  for (const who of [undefined, 'a', 'b', 'editor']) {
    check([401, 403].includes((await req(npath, who)).s), 'NOTES list denied to ' + (who || 'anonymous'));
    check([401, 403].includes((await req(npath, who, 'POST', {})).s), 'NOTES write denied to ' + (who || 'anonymous'));
  }
  const refs = { sceneIds: [cScene.d.scene.id], npcIds: [npcId], placeIds: [placeAId], sessionIds: [] };
  const note = await req(npath, 'gm', 'POST', { action: 'save', title: '', text: 'NOTES_SECRET_DOOR', date: '2026-11-26', tags: ['Keller'], kind: 'question', refs });
  check(note.s === 201 && note.d.note.kind === 'question' && note.d.note.refs.npcIds[0] === npcId, 'NOTES SL note with kind and references created');
  const byScene = await req(npath + '?sceneId=' + encodeURIComponent(cScene.d.scene.id), 'gm');
  check(byScene.s === 200 && byScene.d.notes.some(n => n.id === note.d.note.id) && !(await req(npath + '?sceneId=' + encodeURIComponent(ws.d.scene.id), 'gm')).d.notes.some(n => n.id === note.d.note.id), 'NOTES filtered by scene');
  check((await req(npath, 'gm', 'POST', { action: 'save', text: 'x', date: '2026-11-26', refs: { ...refs, npcIds: [placeAId] } })).s === 400, 'NOTES an NPC reference must be an NPC');
  check((await req(npath, 'gm', 'POST', { action: 'save', text: 'x', date: '2026-11-26', refs: { ...refs, sceneIds: ['scene-missing'] } })).s === 400, 'NOTES unknown scene rejected');
  check(JSON.stringify((await req('/api/notebook', 'gm')).d.pages || []).includes('NOTES_SECRET_DOOR'), 'NOTES the SL note is a page of the SL notebook');
  for (const who of ['a', 'b']) check(!JSON.stringify((await req('/api/notebook', who)).d || {}).includes('NOTES_SECRET_DOOR'), 'NOTES players never see SL notes in their notebook: ' + who);
  const edited = await req(npath, 'gm', 'POST', { action: 'save', id: note.d.note.id, version: 1, title: 'Tür', text: 'NOTES_SECRET_DOOR', date: '2026-11-26', tags: [], kind: 'promise', refs: { ...refs, placeIds: [] } });
  check(edited.s === 200 && edited.d.note.version === 2 && edited.d.note.kind === 'promise' && !edited.d.note.refs.placeIds.length, 'NOTES edit keeps CAS and changes kind and references');
  check((await req(npath, 'gm', 'POST', { action: 'save', id: note.d.note.id, version: 1, text: 'alt', date: '2026-11-26' })).s === 409, 'NOTES stale save rejected');
  check((await req(npath, 'gm', 'POST', { action: 'delete', id: note.d.note.id, version: 2 })).s === 200 && !(await req(npath, 'gm')).d.notes.some(n => n.id === note.d.note.id), 'NOTES delete');

  // Nothing of it reaches players
  for (const who of ['a', 'b']) {
    const seen = JSON.stringify((await req('/api/session-scenes', who)).d || {});
    check(!seen.includes('THREAD_NEVER_PLAYER') && !seen.includes('THREAD_PRIVATE_CONSEQUENCE') && !seen.includes(id), 'THREAD content never in player scenes for ' + who);
  }
}
