import { defaultRuleProfileId, ruleProfile, v20Profile } from './rule-profiles.ts';
import type { SceneDocument, SceneElement, SceneRuleCheck } from './story-scene.ts';

/** Szene 2.0, Etappe 5: checks by rule profile and their mirror for the current Regie. Pure.
 * V20 checks ⇄ classic check elements with a structured block (same id, every field 1:1), so the GE-02 check desk
 * keeps issuing exactly what it issued before. Older check elements without a block are read by the Regie from their
 * free text; they stay classic until the SL takes them over on purpose. */

const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const str = (v: unknown) => typeof v === 'string' ? v : '';

export function newCheck(profileId: string = defaultRuleProfileId, id: string = crypto.randomUUID()): SceneRuleCheck {
  const profile = ruleProfile(profileId) || v20Profile;
  return { id, title: 'Neue Probe', profileId: profile.id, spec: profile.emptySpec(), difficulty: profile.difficulty.default, outcomes: {}, note: '', targetCharacterIds: [] };
}

/** The classic element for a V20 check (null for other profiles). */
export function checkToElement(c: SceneRuleCheck): SceneElement | null {
  if (c.profileId !== v20Profile.id) return null;
  return { id: c.id, kind: 'check', title: c.title, text: c.note, referenceId: '', fileId: '',
    check: { attributeId: str(c.spec.attributeId), abilityId: str(c.spec.abilityId), difficulty: c.difficulty, targetCharacterIds: [...c.targetCharacterIds],
      consequences: { success: c.outcomes.success || '', failure: c.outcomes.failure || '', botch: c.outcomes.botch || '' } } };
}
/** A V20 check from a classic check element with a structured block (null otherwise). */
export function elementToCheck(e: SceneElement): SceneRuleCheck | null {
  if (e.kind !== 'check' || !e.check) return null;
  const k = e.check.consequences;
  return { id: e.id, title: e.title, profileId: v20Profile.id, spec: { attributeId: e.check.attributeId, abilityId: e.check.abilityId }, difficulty: e.check.difficulty,
    outcomes: Object.fromEntries(Object.entries({ success: k.success, failure: k.failure, botch: k.botch }).filter(([, v]) => v)), note: e.text, targetCharacterIds: [...e.check.targetCharacterIds] };
}

/** Applies the check mirror. With `before`, a classic edit of a mirrored element (element changed, check unchanged)
 * wins and the check follows; a classic deletion removes the check. A structured check element that has no check
 * entry yet (created in the classic window) is adopted. */
export function withCheckMirrors(next: SceneDocument, before?: SceneDocument | null): SceneDocument {
  if (!next.checks) return next;
  let checks = next.checks;
  const beforeChecks = new Map((before?.checks || []).map(c => [c.id, c]));
  const beforeEls = new Map((before?.elements || []).map(e => [e.id, e]));
  const incoming = new Map(next.elements.map(e => [e.id, e]));
  if (before) {
    checks = checks.flatMap(c => {
      const prior = beforeEls.get(c.id), now = incoming.get(c.id), unchanged = equal(beforeChecks.get(c.id), c);
      if (!unchanged || c.profileId !== v20Profile.id || !prior) return [c];
      if (!now) return [];
      if (!equal(prior, now)) return [elementToCheck(now) || c];
      return [c];
    });
  }
  const known = new Set(checks.map(c => c.id));
  const adopted = next.elements.flatMap(e => !known.has(e.id) ? [elementToCheck(e)].filter((x): x is SceneRuleCheck => !!x) : []);
  checks = [...checks, ...adopted];
  const mirrored = new Map(checks.map(c => [c.id, checkToElement(c)] as const));
  const elements = next.elements.flatMap(e => mirrored.has(e.id) ? (mirrored.get(e.id) ? [mirrored.get(e.id)!] : []) : [e]);
  for (const [id, element] of mirrored) if (element && !incoming.has(id)) elements.push(element);
  return { ...next, checks, elements };
}

/** Opens older scenes: structured check elements become checks (lossless, same id). Blockless ones stay classic. */
export function checksFromElements(doc: SceneDocument): SceneDocument {
  if (doc.checks?.length) return doc;
  const checks = doc.elements.flatMap(e => [elementToCheck(e)].filter((x): x is SceneRuleCheck => !!x));
  return checks.length ? { ...doc, checks } : doc;
}
/** Classic check elements without a structured block (free text only). */
export function freeTextChecks(doc: SceneDocument): SceneElement[] {
  const ids = new Set((doc.checks || []).map(c => c.id));
  return doc.elements.filter(e => e.kind === 'check' && !e.check && !ids.has(e.id));
}

/** Rollback aid: older builds reject `checks`; V20 checks already live as elements, others go into the notes. */
export function sceneWithoutChecks(document: Record<string, unknown>): { document: Record<string, unknown>; changed: boolean } {
  if (!('checks' in document)) return { document, changed: false };
  const { checks, ...rest } = document as Record<string, unknown> & { checks?: SceneRuleCheck[] };
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const others = (Array.isArray(checks) ? checks : []).filter(c => c.profileId !== v20Profile.id);
  const lines = others.map(c => { const p = ruleProfile(c.profileId); return '<p>Probe „' + esc(c.title) + '“ (' + esc(p?.name || c.profileId) + '): ' + esc(p ? p.describe(c.spec, c.difficulty) : '') + Object.entries(c.outcomes || {}).map(([k, v]) => ' · ' + esc(p?.outcomes.find(o => o.id === k)?.label || k) + ': ' + esc(v)).join('') + '</p>'; });
  return { document: lines.length ? { ...rest, gmNotes: String(rest.gmNotes || '') + '<p>Proben nach Regelprofil (zurückgeführt):</p>' + lines.join('') } : rest, changed: true };
}
