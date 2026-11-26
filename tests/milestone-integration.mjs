// Orte, Etappe 2 and 3: an Erkenntnis is bound to a milestone, the SL reaches it, the group learns it once,
// and the text an SL released for it reaches players. Also: late bindings, access for every role, and the SL-only pending list.
export async function milestoneIntegration({ req, check, base }) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Milestone QA requires an isolated local worker.');
  const place = 'place.electric-taberna';
  const stamp = Date.now().toString(36);
  const label = 'SYNTHETIC Rundgang ' + stamp;
  const textLabel = 'SYNTHETIC Text-Meilenstein ' + stamp;
  const reason = 'SYNTHETIC-Begründung-nur-SL';
  const playerView = async () => JSON.stringify((await req('/api/locations?place=' + encodeURIComponent(place) + '&view=player&target=group', 'a')).d);
  const nodes = async () => (await req('/api/cms/locations?place=' + encodeURIComponent(place), 'gm')).d.nodes;

  // Erkenntnis 1: bound, not yet reached
  const created = await req('/api/cms/locations', 'gm', 'POST', { level: 'information', title: 'SYNTHETIC Meilenstein-Erkenntnis ' + stamp, parentId: place });
  check(created.s === 201, 'MILESTONE synthetic Erkenntnis created under the existing place (' + created.s + ')');
  const id = created.d?.id;
  const rev = (await nodes()).find(node => node.id === id)?.revision;

  check((await req('/api/locations/milestone')).s === 401, 'MILESTONE anonymous visitors cannot read milestones');
  check((await req('/api/cms/location-unlock', undefined, 'POST', { entityId: id, expectedRevision: rev, milestone: label, reason })).s === 401, 'MILESTONE anonymous visitors cannot bind an Erkenntnis');
  check((await req('/api/locations/milestone', undefined, 'POST', { label, reason })).s === 401, 'MILESTONE anonymous visitors cannot reach a milestone');
  check((await req('/api/cms/location-unlock', 'a', 'POST', { entityId: id, expectedRevision: rev, milestone: label, reason })).s === 403, 'MILESTONE players cannot bind an Erkenntnis to a milestone');
  check((await req('/api/locations/milestone', 'a', 'POST', { label, reason })).s === 403, 'MILESTONE players cannot reach a milestone');
  const foreign = await req('/api/locations/milestone', 'otherCampaign');
  check(foreign.s >= 400 || !JSON.stringify(foreign.d).includes(label), 'MILESTONE a member of another campaign sees no milestone of this campaign (' + foreign.s + ')');

  const bound = await req('/api/cms/location-unlock', 'gm', 'POST', { entityId: id, expectedRevision: rev, milestone: label, reason });
  check(bound.s === 200 && bound.d.milestone === label && bound.d.revision === rev + 1, 'MILESTONE SL binds the Erkenntnis to the milestone');
  check((await req('/api/cms/location-unlock', 'gm', 'POST', { entityId: id, expectedRevision: rev, milestone: 'Anderer', reason })).s === 409, 'MILESTONE a stale binding gets a conflict instead of an overwrite');
  check((await nodes()).find(node => node.id === id)?.unlockMilestone === label, 'MILESTONE the tree carries the bound milestone name');

  const pendingSl = (await req('/api/locations/milestone', 'gm')).d;
  check(pendingSl.pending?.some(item => item.label === label && item.count >= 1), 'MILESTONE the SL sees the bound, not yet reached name with its count');
  check(!JSON.stringify((await req('/api/locations/milestone', 'a')).d).includes('"pending"'), 'MILESTONE players never see the pending list');

  check(!(await playerView()).includes('SYNTHETIC Meilenstein-Erkenntnis ' + stamp), 'MILESTONE players do not know the Erkenntnis before the milestone is reached');
  const fired = await req('/api/locations/milestone', 'gm', 'POST', { label, reason });
  check(fired.s === 200 && fired.d.already === false && fired.d.granted >= 1, 'MILESTONE SL reaches the milestone and the bound Erkenntnis is granted (' + JSON.stringify(fired.d) + ')');
  check((await playerView()).includes('SYNTHETIC Meilenstein-Erkenntnis ' + stamp), 'MILESTONE players see the Erkenntnis after the milestone');
  const again = await req('/api/locations/milestone', 'gm', 'POST', { label, reason });
  check(again.s === 200 && again.d.already === true && again.d.granted === 0, 'MILESTONE reaching the same milestone again grants nothing new');

  // Erkenntnis 2: bound after the milestone was already reached; the next reach must still grant it
  const late = await req('/api/cms/locations', 'gm', 'POST', { level: 'information', title: 'SYNTHETIC Nachtrags-Erkenntnis ' + stamp, parentId: place });
  const lateRev = (await nodes()).find(node => node.id === late.d?.id)?.revision;
  check((await req('/api/cms/location-unlock', 'gm', 'POST', { entityId: late.d?.id, expectedRevision: lateRev, milestone: label, reason })).s === 200, 'MILESTONE a later Erkenntnis is bound to the already reached name');
  const relabel = await req('/api/locations/milestone', 'gm', 'POST', { label, reason });
  check(relabel.s === 200 && relabel.d.granted === 1 && (await playerView()).includes('SYNTHETIC Nachtrags-Erkenntnis ' + stamp), 'MILESTONE a late binding is granted by the next reach of the same name');

  // Erkenntnis 3: the text the SL released for it reaches the players, not only the title
  const text = await req('/api/cms/locations', 'gm', 'POST', { level: 'information', title: 'SYNTHETIC Text-Erkenntnis ' + stamp, parentId: place });
  const textNode = text.d;
  const draft = await req('/api/cms/drafts', 'gm', 'PATCH', { revisionId: textNode.revisionId, expectedVersion: 1, payload: { title: textNode.title, text: 'SYNTHETIC Text nach dem Meilenstein ' + stamp } });
  const review = await req('/api/cms/transitions', 'gm', 'POST', { action: 'submit', revisionId: textNode.revisionId, expectedVersion: draft.d.version });
  const approved = await req('/api/cms/transitions', 'gm', 'POST', { action: 'approve', revisionId: textNode.revisionId, expectedVersion: review.d.version });
  const released = await req('/api/cms/releases', 'gm', 'POST', { action: 'publish', entityId: textNode.id, scope: 'group', revisionId: textNode.revisionId, expectedReleaseVersion: 0, grantDiscovery: false, reason: 'Text für Meilenstein freigegeben' });
  check([draft, review, approved, released].every(r => r.s === 200), 'MILESTONE the text is released without discovery (' + [draft, review, approved, released].map(r => r.s).join('/') + ')');
  const textRev = (await nodes()).find(node => node.id === textNode.id)?.revision;
  check((await req('/api/cms/location-unlock', 'gm', 'POST', { entityId: textNode.id, expectedRevision: textRev, milestone: textLabel, reason })).s === 200, 'MILESTONE the text Erkenntnis is bound to its own milestone');
  check(!(await playerView()).includes('SYNTHETIC Text nach dem Meilenstein ' + stamp), 'MILESTONE the released text stays hidden before the milestone');
  check((await req('/api/locations/milestone', 'gm', 'POST', { label: textLabel, reason })).d.granted === 1, 'MILESTONE the milestone grants the Erkenntnis');
  check((await playerView()).includes('SYNTHETIC Text nach dem Meilenstein ' + stamp), 'MILESTONE players read the released text after the milestone, not only the title');

  const list = await req('/api/locations/milestone', 'a');
  const entry = list.d?.milestones?.find(item => item.label === label);
  check(list.s === 200 && !!entry && !JSON.stringify(list.d).includes(reason) && !JSON.stringify(list.d).includes('pending'), 'MILESTONE players see reached names and times, never the SL reason or the pending list');
  check(entry && Object.keys(entry).sort().join(',') === 'granted,label,reachedAt', 'MILESTONE the player entry carries only name, time and count');
}
