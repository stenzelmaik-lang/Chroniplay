import { z } from 'zod';
import { W10_ABILITY_KEYS, W10_ATTRIBUTE_KEYS } from './trait-ids.ts';
import { evaluateV20 } from './w10-core.ts';

/** Szene 2.0, Etappe 5: rule profile register. ChroniPlay stays rule-independent: a scene check stores only a profile id
 * and a profile-specific spec; whoever runs the check asks the profile (traits, difficulty, outcomes, dice adapter)
 * and never needs to know V20 terms. Pure: no randomness, no writes.
 *
 * The V20 profile wraps the existing engine (`evaluateV20`, the same function behind evaluateNormalV20 and the live
 * check path), so results cannot drift. The live roll path itself (GE-02: requestCheck → deriveW10Preview) is not
 * changed here; it stays the one server path and remains bound to the modifier register. */

export type RuleTrait = Readonly<{ id: string; label: string }>;
export type RuleTraitGroup = Readonly<{ id: string; label: string; role: 'attribute' | 'ability'; traits: readonly RuleTrait[] }>;
export type RuleOutcome = Readonly<{ id: string; label: string }>;
export type RuleDifficulty = Readonly<{ label: string; min: number; max: number; default: number; names?: Readonly<Record<number, string>> }>;
/** A character sheet by profile (for NPCs later): values per trait id, resources, conditions, notes. Entry comes with
 * the NPC management; here only the shape. */
export const ruleSheetSchema = z.object({
  profileId: z.string().min(1).max(60),
  values: z.record(z.string().max(60), z.union([z.number().int().min(0).max(100), z.string().max(200)])).default({}),
  resources: z.record(z.string().max(60), z.object({ value: z.number().int().min(0).max(1000), max: z.number().int().min(0).max(1000) }).strict()).default({}),
  conditions: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  notes: z.string().max(3000).default(''),
}).strict();
export type RuleSheet = z.infer<typeof ruleSheetSchema>;

export type RuleProfile = Readonly<{
  id: string;
  name: string;
  /** short line for the SL: how checks work in this profile */
  summary: string;
  dice: boolean;
  traitGroups: readonly RuleTraitGroup[];
  difficulty: RuleDifficulty;
  outcomes: readonly RuleOutcome[];
  /** profile-specific part of a prepared check */
  checkSpec: z.ZodType<Record<string, unknown>>;
  emptySpec: () => Record<string, unknown>;
  describe: (spec: Record<string, unknown>, difficulty: number) => string;
  /** dice adapter (only for dice profiles): pool from a sheet, outcome from rolled faces */
  pool?: (sheet: RuleSheet, spec: Record<string, unknown>) => number | null;
  evaluate?: (faces: readonly number[], spec: Record<string, unknown>, difficulty: number) => { outcome: string; successes: number };
}>;

// --- V20 (W10) with the house rules of the existing engine -------------------------------------------------------
const ids = <T extends Record<string, string>>(keys: T, labels: readonly string[]): RuleTrait[] =>
  labels.map(label => { const id = Object.keys(keys).find(k => keys[k] === label); if (!id) throw new Error('V20-Profil: unbekannte Eigenschaft ' + label); return { id, label }; });
const v20Groups: RuleTraitGroup[] = [
  { id: 'physical', label: 'Körperlich', role: 'attribute', traits: ids(W10_ATTRIBUTE_KEYS, ['Körperkraft', 'Geschick', 'Widerstandsfähigkeit']) },
  { id: 'social', label: 'Gesellschaftlich', role: 'attribute', traits: ids(W10_ATTRIBUTE_KEYS, ['Charisma', 'Manipulation', 'Erscheinungsbild']) },
  { id: 'mental', label: 'Geistig', role: 'attribute', traits: ids(W10_ATTRIBUTE_KEYS, ['Wahrnehmung', 'Intelligenz', 'Geistesschärfe']) },
  { id: 'talents', label: 'Talente', role: 'ability', traits: ids(W10_ABILITY_KEYS, ['Aufmerksamkeit', 'Ausdruck', 'Ausflüchte', 'Einschüchtern', 'Empathie', 'Führungsqualitäten', 'Handgemenge', 'Magiegespür', 'Sportlichkeit', 'Szenekenntnis']) },
  { id: 'skills', label: 'Fertigkeiten', role: 'ability', traits: ids(W10_ABILITY_KEYS, ['Diebstahl', 'Etikette', 'Fahren', 'Handwerk', 'Heimlichkeit', 'Nahkampf', 'Schusswaffen', 'Tierkunde', 'Überleben', 'Vortrag']) },
  { id: 'knowledges', label: 'Kenntnisse', role: 'ability', traits: ids(W10_ABILITY_KEYS, ['Akademisches Wissen', 'Computer', 'Finanzen', 'Gesetzeskenntnis', 'Medizin', 'Nachforschungen', 'Naturwissenschaften', 'Okkultismus', 'Politik', 'Technologie']) },
];
const v20Trait = (keys: Readonly<Record<string, string>>) => z.string().max(40).default('').refine(v => !v || Object.hasOwn(keys, v), 'Unbekannte Eigenschaft.');
const v20Spec = z.object({ attributeId: v20Trait(W10_ATTRIBUTE_KEYS), abilityId: v20Trait(W10_ABILITY_KEYS) }).strict();
const traitLabel = (keys: Readonly<Record<string, string>>, id: unknown) => typeof id === 'string' && Object.hasOwn(keys, id) ? keys[id] : '';
const v20Names: Record<number, string> = { 3: 'Leicht', 4: 'Routine', 5: 'Unkompliziert', 6: 'Normal', 7: 'Herausfordernd', 8: 'Schwierig', 9: 'Extrem schwierig' };

export const v20Profile: RuleProfile = Object.freeze({
  id: 'v20-kleve',
  name: 'V20 (W10) mit Hausregeln',
  summary: 'Attribut + Fähigkeit ergeben den Würfelpool aus W10; jede Zahl ab der Schwierigkeit ist ein Erfolg, Einsen heben Erfolge auf.',
  dice: true,
  traitGroups: v20Groups,
  difficulty: { label: 'Schwierigkeit', min: 2, max: 10, default: 6, names: v20Names },
  outcomes: [{ id: 'success', label: 'Erfolg' }, { id: 'failure', label: 'Fehlschlag' }, { id: 'botch', label: 'Patzer' }],
  checkSpec: v20Spec as unknown as z.ZodType<Record<string, unknown>>,
  emptySpec: () => ({ attributeId: '', abilityId: '' }),
  describe: (spec, difficulty) => [traitLabel(W10_ATTRIBUTE_KEYS, spec.attributeId) || 'Attribut frei', traitLabel(W10_ABILITY_KEYS, spec.abilityId) || 'Fähigkeit frei'].join(' + ') + ' · SG ' + difficulty,
  pool: (sheet, spec) => {
    const attribute = traitLabel(W10_ATTRIBUTE_KEYS, spec.attributeId), ability = traitLabel(W10_ABILITY_KEYS, spec.abilityId);
    const value = (id: unknown, label: string) => { const v = typeof id === 'string' ? sheet.values[id] ?? sheet.values[label] : undefined; return typeof v === 'number' ? v : 0; };
    if (!attribute) return null;
    return value(spec.attributeId, attribute) + (ability ? value(spec.abilityId, ability) : 0);
  },
  evaluate: (faces, _spec, difficulty) => { const r = evaluateV20(faces, { difficulty }); return { outcome: r.outcome, successes: r.totalSuccesses }; },
});

// --- Narrative (no dice): proves the core is rule-independent -----------------------------------------------------
const narrativeSpec = z.object({ approach: z.string().trim().max(300).default('') }).strict();
const narrativeNames: Record<number, string> = { 1: 'Leicht', 2: 'Normal', 3: 'Schwer', 4: 'Fast unmöglich' };
export const narrativeProfile: RuleProfile = Object.freeze({
  id: 'narrative',
  name: 'Erzählerisch (ohne Würfel)',
  summary: 'Keine Würfel: Du entscheidest nach Ansatz und Schwierigkeit, ob es gelingt, teilweise gelingt oder misslingt.',
  dice: false,
  traitGroups: [],
  difficulty: { label: 'Schwierigkeit', min: 1, max: 4, default: 2, names: narrativeNames },
  outcomes: [{ id: 'success', label: 'Gelingt' }, { id: 'partial', label: 'Gelingt mit Preis' }, { id: 'failure', label: 'Misslingt' }],
  checkSpec: narrativeSpec as unknown as z.ZodType<Record<string, unknown>>,
  emptySpec: () => ({ approach: '' }),
  describe: (spec, difficulty) => (typeof spec.approach === 'string' && spec.approach.trim() ? spec.approach.trim() : 'Ansatz frei') + ' · ' + (narrativeNames[difficulty] || 'Schwierigkeit ' + difficulty),
});

export const ruleProfiles: readonly RuleProfile[] = Object.freeze([v20Profile, narrativeProfile]);
export const defaultRuleProfileId = v20Profile.id;
export function ruleProfile(id: string): RuleProfile | undefined { return ruleProfiles.find(p => p.id === id); }
export function difficultyName(profile: RuleProfile, value: number): string { return profile.difficulty.names?.[value] || profile.difficulty.label + ' ' + value; }
