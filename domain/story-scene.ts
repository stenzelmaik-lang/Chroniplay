import { authoringTextMax, authoringSourceMax } from './authoring-limits.ts';
import { z } from 'zod';
import { isRichTextWithinLimit, sanitizeRichTextInput } from './location-rich-text.ts';
import { sceneMaterialSchema, materialElementKind } from './material-system.ts';
import { W10_ATTRIBUTE_KEYS, W10_ABILITY_KEYS } from './trait-ids.ts';
import { visionDirectionSchema } from './vision-direction.ts';
import { sceneBoardSchema, type SceneBoard } from './storyboard-blocks.ts';
import { stageEffects } from './live-stage.ts';
import { ruleProfile } from './rule-profiles.ts';

const id = z.string().min(1).max(100);
const optionalId = z.string().max(100).default('');
// The importer names the exceeded bound (rows, sections, formatting); that reason reaches the SL instead of a generic one.
const text = z.string().max(authoringSourceMax,'Dieser Text ist zu lang (höchstens '+authoringSourceMax.toLocaleString('de-DE')+' Zeichen Quelltext).').transform((v,ctx)=>{try{return sanitizeRichTextInput(v);}catch(e){ctx.addIssue({code:'custom',message:e instanceof Error&&e.message?e.message:'Ungültiges oder zu komplexes HTML.'});return '';}}).refine(v => isRichTextWithinLimit(v, authoringTextMax), 'Dieser Text ist zu lang (höchstens '+authoringTextMax.toLocaleString('de-DE')+' sichtbare Zeichen) oder ungültig formatiert.');
/** The scene rich-text field (sanitised, limited); reused by the material library (Szene 2.0, Etappe 3). */
export const sceneRichText = text;
const sceneFieldLabels:Record<string,string>={title:'Titel',narration:'Erzählung',atmosphere:'Atmosphäre',gmNotes:'SL-Notizen',dialogueNotes:'Dialoge',interactions:'Interaktion',secrets:'Geheimnisse',visions:'Visionen',possibleConsequences:'Konsequenzen',board:'Storyboard',context:'Überblick',passages:'Abschnitt',moods:'Stimmung',cast:'Beteiligte',places:'Schauplatz',materialUses:'Material',insights:'Erkenntnis',interactionCards:'Interaktionskarte',events:'Ereignis',checks:'Probe',possibilities:'Möglichkeiten',elements:'Baustein',whispers:'Botschaft'};
/** "Erzählung: …" or "Baustein 3: …", so a rejected save names the affected field. */
export function sceneIssueMessage(issue:{path:(string|number)[];message:string}):string{
  const path=issue.path[0]==='document'?issue.path.slice(1):issue.path,key=String(path[0]??''),label=sceneFieldLabels[key];
  if(!label)return issue.message;
  return (typeof path[1]==='number'&&['elements','whispers','possibilities','passages','moods','cast','places','materialUses','insights','interactionCards','events','checks'].includes(key)?label+' '+(path[1]+1):label)+': '+issue.message;
}
const ids = z.array(id).max(30).refine(v => new Set(v).size === v.length, 'Eine Akte darf nur einmal verknüpft werden.');
export const sceneTabs = { narration: 'Erzählung', persons: 'Personen', interaction: 'Interaktion', secrets: 'Geheimnisse', consequences: 'Konsequenzen' } as const;
export const sceneStatusNames = { prepared: 'Vorbereitet', active: 'Läuft', paused: 'Pausiert', completed: 'Abgeschlossen' } as const;

export const sceneElementKinds=['text','sl-note','description','object','clue','check','dialogue','encounter','place','person','image','audio','video','handout','puzzle','pager'] as const;
/** Prepared pager message (ULTIO pager). The element id becomes the message id when the GM plays it, so it is sent once.
 * Limits match the live pager contract; an empty recipient list means the whole round. Optional, so older scenes stay valid. */
export const scenePagerMax={sender:80,title:80,text:280,recipients:30} as const;
export const scenePagerSchema=z.object({sender:z.string().trim().max(scenePagerMax.sender).default(''),text:z.string().trim().max(scenePagerMax.text).default(''),priority:z.enum(['normal','hoch']).default('normal'),recipientIds:z.array(id).max(scenePagerMax.recipients).default([]).refine(v=>new Set(v).size===v.length,'Empfänger dürfen nicht doppelt sein.')}).strict();
export type ScenePager=z.infer<typeof scenePagerSchema>;
export const emptyScenePager=():ScenePager=>({sender:'',text:'',priority:'normal',recipientIds:[]});
/** Prepared character check (GE-02): traits, SG, intended figures and private consequences. The Regie issues it through the
 * same requestCheck as a spontaneous check; nothing is evaluated here. Optional, so older scenes stay valid. */
export const sceneCheckMax={consequence:1000,targets:30} as const;
const traitId=(keys:Readonly<Record<string,string>>)=>z.string().max(40).default('').refine(v=>!v||Object.hasOwn(keys,v),'Unbekannte Eigenschaft.');
export const sceneCheckSchema=z.object({attributeId:traitId(W10_ATTRIBUTE_KEYS),abilityId:traitId(W10_ABILITY_KEYS),difficulty:z.number().int().min(2).max(10).default(6),
  targetCharacterIds:z.array(id).max(sceneCheckMax.targets).default([]).refine(v=>new Set(v).size===v.length,'Eine Figur darf nur einmal vorgesehen sein.'),
  consequences:z.object({success:z.string().trim().max(sceneCheckMax.consequence).default(''),failure:z.string().trim().max(sceneCheckMax.consequence).default(''),botch:z.string().trim().max(sceneCheckMax.consequence).default('')}).strict().default({success:'',failure:'',botch:''})}).strict();
export type SceneCheck=z.infer<typeof sceneCheckSchema>;
export const emptySceneCheck=():SceneCheck=>({attributeId:'',abilityId:'',difficulty:6,targetCharacterIds:[],consequences:{success:'',failure:'',botch:''}});
export const sceneElementSchema=z.object({id:z.string().uuid(),kind:z.enum(sceneElementKinds),title:z.string().trim().min(1).max(200),text,referenceId:optionalId,fileId:optionalId,pager:scenePagerSchema.optional(),check:sceneCheckSchema.optional(),
  // Spielmaterial 3.0: optional material block (type, ordered files, display asset, effect). Older scenes stay valid.
  material:sceneMaterialSchema.optional()}).strict()
  .refine(e=>e.kind==='pager'?e.title.length<=scenePagerMax.title&&!e.referenceId&&!e.fileId:!e.pager,'Pager-Bausteine haben einen Titel bis 80 Zeichen und keine Datei; andere Bausteine tragen keine Pager-Daten.')
  .refine(e=>!e.check||e.kind==='check','Nur Probenbausteine tragen Probendaten.')
  .refine(e=>!e.material||materialElementKind[e.material.type]===e.kind&&(e.material.type!=='pager'||!e.material.files.length),'Die Materialart passt nicht zum Baustein.');
export type SceneElement=z.infer<typeof sceneElementSchema>;
/** Prepared YouTube music of a scene: only a title and the video id, no file. Optional, so older scenes stay valid. */
export const sceneYoutubeMax=30;
export const sceneYoutubeSchema=z.object({id:z.string().uuid(),title:z.string().trim().max(200),videoId:z.string().regex(/^[A-Za-z0-9_-]{11}$/,'Kein gültiger YouTube-Link.')}).strict();
export type SceneYoutube=z.infer<typeof sceneYoutubeSchema>;
/** Independently prepared private deliveries; drafts may still have no recipients/content. */
export const sceneWhisperSchema=z.object({id:z.string().uuid(),kind:z.enum(['vision','letter']),title:z.string().trim().min(1).max(160),text,
  recipientIds:z.array(id).max(20).refine(v=>new Set(v).size===v.length,'Empfänger dürfen nicht doppelt sein.'),
  fileIds:z.array(id).max(20).refine(v=>new Set(v).size===v.length,'Bilder dürfen nicht doppelt sein.'),
  // Alpha 2.0 (all optional, old entries stay valid): vision look, text sections, sound, letter layout and sender, internal note.
  preset:z.enum(['classic','dream','dark','threat','drama','echo']).optional(),
  fragments:z.array(z.string().max(600)).max(20).optional(),
  audioFileId:id.optional(),
  layout:z.enum(['fax','letter']).optional(),
  sender:z.string().max(120).optional(),
  note:z.string().max(2000).optional(),
  // reading tempo of a vision; arrival sound of a message (built-in fax/letter sound unless switched off or replaced)
  tempo:z.enum(['calm','normal','brisk']).optional(),
  sound:z.enum(['builtin','none']).optional(),
  // Vision Engine: optionale, versionierte Regiespur (Brennpunkt, Kern, Platz, Größe, Texte je Bild, Eintauchen, Schlusssatz)
  direction:visionDirectionSchema.optional(),
}).strict();
export type SceneWhisper=z.infer<typeof sceneWhisperSchema>;
/** Szene 2.0, Etappe 1 (all optional; older scenes stay valid). Context of the scene, narration passages in their
 * likely order (read aloud by the SL, never played out), and named moods (picture, sound, effects).
 * The old fields `narration`, `backdropFileId` and `youtube` stay as mirrors for older readers (see scene-workshop.ts). */
export const sceneWorkshopLimits = { passages: 40, moods: 12, entries: 10, short: 2000, direction: 5000, title: 200, moodName: 80, effects: stageEffects.length } as const;
export const sceneContextSchema = z.object({
  situation: z.string().max(sceneWorkshopLimits.short).default(''),
  purpose: z.string().max(sceneWorkshopLimits.short).default(''),
  prerequisites: z.string().max(sceneWorkshopLimits.short).default(''),
  entries: z.array(z.string().trim().min(1).max(300)).max(sceneWorkshopLimits.entries).default([]),
  tone: z.string().max(200).default(''),
  ending: z.enum(['open', 'fixed']).default('open'),
}).strict();
export type SceneContext = z.infer<typeof sceneContextSchema>;
export const scenePassageSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(sceneWorkshopLimits.title).default(''),
  text: text.default(''),
  /** Stage direction for the SL only (plain text); never part of the narration mirror. */
  direction: z.string().max(sceneWorkshopLimits.direction).default(''),
  /** Mood that starts when this passage is called; empty = the mood stays as it is. */
  moodId: z.union([z.string().uuid(), z.literal('')]).default(''),
}).strict();
export type ScenePassage = z.infer<typeof scenePassageSchema>;
export const sceneMoodSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(sceneWorkshopLimits.moodName),
  backdropFileId: optionalId,
  youtube: z.array(sceneYoutubeSchema).max(sceneYoutubeMax).default([]).refine(v => new Set(v.map(t => t.id)).size === v.length, 'Titel dürfen nicht doppelt sein.'),
  effects: z.array(z.enum(stageEffects)).max(sceneWorkshopLimits.effects).default([]).refine(v => new Set(v).size === v.length, 'Effekte dürfen nicht doppelt sein.'),
  isDefault: z.boolean().default(false),
}).strict();
export type SceneMood = z.infer<typeof sceneMoodSchema>;
/** Szene 2.0, Etappe 2 (all optional). Cast: an NPC from the world (reference, never a copy) plus the SL's role for this
 * scene and an addition for the player card in this scene. Places: nodes of the place tree (location, area, room) with
 * a scene note and whether they can be unlocked here. The old fields `npcIds` and `placeId` stay as mirrors. */
export const sceneCastLimits = { cast: 30, places: 20, field: 1000, dialogue: 3000, cardNote: 1000, placeNote: 2000 } as const;
const castField = (max: number) => z.string().max(max).default('');
export const sceneCastRoleKeys = ['why', 'wants', 'knows', 'hides', 'reacts', 'intervenes', 'leaves'] as const;
const roleField = castField(sceneCastLimits.field);
export const sceneCastRoleSchema = z.object({ why: roleField, wants: roleField, knows: roleField, hides: roleField, reacts: roleField, intervenes: roleField, leaves: roleField }).strict();
export type SceneCastRole = z.infer<typeof sceneCastRoleSchema>;
export const emptyCastRole = (): SceneCastRole => ({ why: '', wants: '', knows: '', hides: '', reacts: '', intervenes: '', leaves: '' });
export const sceneCastSchema = z.object({
  id: z.string().uuid(),
  npcId: id,
  /** present from the start, joins later, or only maybe */
  presence: z.enum(['start', 'later', 'maybe']).default('start'),
  role: sceneCastRoleSchema.default(emptyCastRole()),
  dialogue: castField(sceneCastLimits.dialogue),
  /** Addition to the NPC card that players see in this scene (separate from the wiki card). Not shown to players yet. */
  cardNote: castField(sceneCastLimits.cardNote),
}).strict();
export type SceneCast = z.infer<typeof sceneCastSchema>;
export const scenePlaceSchema = z.object({
  id: z.string().uuid(),
  placeId: id,
  /** the main place of the scene; mirrored to `placeId` */
  main: z.boolean().default(false),
  note: castField(sceneCastLimits.placeNote),
  /** the SL may unlock this place for the players during this scene (unlocking itself happens at the table) */
  unlockable: z.boolean().default(false),
}).strict();
export type ScenePlace = z.infer<typeof scenePlaceSchema>;
/** Szene 2.0, Etappe 3 (optional): use of a library material in this scene. The material itself lives once in the
 * library (unique, no copy is edited here); the scene only says how it comes into play. The server mirrors each use
 * into a classic element with the same id, so the current Regie can play it out. */
export const sceneMaterialUseLimits = { uses: 50, condition: 1000, audience: 300 } as const;
export const sceneMaterialHows = ['open', 'search', 'handover', 'other'] as const;
export const sceneMaterialUseSchema = z.object({
  id: z.string().uuid(),
  materialId: id,
  how: z.enum(sceneMaterialHows).default('open'),
  /** NPC who hands it over (with how = handover) */
  byNpcId: optionalId,
  condition: castField(sceneMaterialUseLimits.condition),
  audience: castField(sceneMaterialUseLimits.audience),
  /** players may pocket it once it is played out */
  takeable: z.boolean().default(true),
}).strict();
export type SceneMaterialUse = z.infer<typeof sceneMaterialUseSchema>;
/** Szene 2.0, Etappe 4 (all optional). Insights (what can be learned: known, discoverable or SL only; discovery itself
 * is recorded only in `knowledge`), interaction cards ("if the players … then …", no order) and events (may happen,
 * with trigger, effect and an optional timer). The old free texts `secrets`, `interactions` and
 * `possibleConsequences` stay as free notes; the current Regie shows the new cards in addition (read side). */
export const scenePossibilityLimits = { insights: 50, cards: 40, events: 30, title: 200, short: 500, long: 2000, refs: 20, timerMinutes: 600 } as const;
const uuidList = z.array(z.string().uuid()).max(scenePossibilityLimits.refs).default([]).refine(v => new Set(v).size === v.length, 'Verknüpfungen dürfen nicht doppelt sein.');
export const sceneInsightAvailability = ['known', 'discoverable', 'gm'] as const;
export const sceneInsightSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(scenePossibilityLimits.title).default(''),
  text: text.default(''),
  availability: z.enum(sceneInsightAvailability).default('discoverable'),
  /** how the players can find it */
  howFound: castField(scenePossibilityLimits.long),
  /** optional clue or handout dossier of the world */
  clueId: optionalId,
}).strict();
export type SceneInsight = z.infer<typeof sceneInsightSchema>;
export const sceneInteractionCardSchema = z.object({
  id: z.string().uuid(),
  when: castField(scenePossibilityLimits.short),
  then: castField(scenePossibilityLimits.long),
  materialUseIds: uuidList, insightIds: uuidList, checkIds: uuidList, eventIds: uuidList,
}).strict();
export type SceneInteractionCard = z.infer<typeof sceneInteractionCardSchema>;
export const sceneEventScopes = ['scene', 'evening', 'campaign'] as const;
export const sceneEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(scenePossibilityLimits.title),
  trigger: castField(scenePossibilityLimits.long),
  effect: castField(scenePossibilityLimits.long),
  followUps: castField(scenePossibilityLimits.long),
  /** how long it can run: only this scene, the evening, or across evenings */
  scope: z.enum(sceneEventScopes).default('scene'),
  /** optional countdown in minutes (0 = none); whether players may see it */
  timerMinutes: z.number().int().min(0).max(scenePossibilityLimits.timerMinutes).default(0),
  timerVisible: z.boolean().default(false),
  /** only the SL triggers it (never automatically) */
  manualOnly: z.boolean().default(true),
}).strict();
export type SceneEvent = z.infer<typeof sceneEventSchema>;
/** Szene 2.0, Etappe 5 (optional): checks by rule profile. A check stores the profile id and a profile-specific spec;
 * V20 checks are mirrored 1:1 into the classic check elements (same id), so the GE-02 check desk issues them on the one
 * existing path. Checks of other profiles have no element (the current Regie shows them as text). */
export const sceneRuleCheckLimits = { checks: 50, title: 200, outcome: 1000 } as const;
export const sceneRuleCheckSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(sceneRuleCheckLimits.title),
  profileId: z.string().min(1).max(60),
  spec: z.record(z.string().max(60), z.unknown()).default({}),
  difficulty: z.number().int(),
  outcomes: z.record(z.string().max(40), z.string().trim().max(sceneRuleCheckLimits.outcome)).default({}),
  /** hint for the SL (rich text; the classic element text) */
  note: text.default(''),
  targetCharacterIds: z.array(id).max(sceneCheckMax.targets).default([]).refine(v => new Set(v).size === v.length, 'Eine Figur darf nur einmal vorgesehen sein.'),
}).strict().superRefine((c, ctx) => {
  const profile = ruleProfile(c.profileId);
  if (!profile) { ctx.addIssue({ code: 'custom', path: ['profileId'], message: 'Unbekanntes Regelprofil.' }); return; }
  const spec = profile.checkSpec.safeParse(c.spec);
  if (!spec.success) ctx.addIssue({ code: 'custom', path: ['spec'], message: spec.error.issues[0]?.message || 'Ungültige Probe.' });
  if (c.difficulty < profile.difficulty.min || c.difficulty > profile.difficulty.max) ctx.addIssue({ code: 'custom', path: ['difficulty'], message: profile.difficulty.label + ' liegt zwischen ' + profile.difficulty.min + ' und ' + profile.difficulty.max + '.' });
  if (Object.keys(c.outcomes).some(k => !profile.outcomes.some(o => o.id === k))) ctx.addIssue({ code: 'custom', path: ['outcomes'], message: 'Dieses Ergebnis kennt das Regelprofil nicht.' });
});
export type SceneRuleCheck = z.infer<typeof sceneRuleCheckSchema>;
// Preparation has no execution flags. Only an explicit SL command creates a run.
export const sceneDocumentSchema = z.object({
  archived: z.boolean().default(false),
  title: z.string().trim().min(1).max(200), storyId: optionalId, placeId: optionalId,
  parentId: optionalId, sessionIds: ids.default([]), backdropFileId: optionalId, favorite:z.boolean().default(false),pinned:z.boolean().default(false), elements:z.array(sceneElementSchema).max(100).default([]).refine(v=>new Set(v.map(e=>e.id)).size===v.length,'Elemente benötigen eindeutige Identitäten.'),
  narration: text, atmosphere: text, gmNotes: text, dialogueNotes: text,
  interactions: text, secrets: text, visions: text.default(''), possibleConsequences: text,
  visionRecipientIds:z.array(id).max(20).default([]).refine(v=>new Set(v).size===v.length,'Empfänger dürfen nicht doppelt sein.'),
  visionFileIds:z.array(id).max(20).default([]).refine(v=>new Set(v).size===v.length,'Dateien dürfen nicht doppelt sein.'),
  whispers:z.array(sceneWhisperSchema).max(100).default([]).refine(v=>new Set(v.map(w=>w.id)).size===v.length,'Botschaften benötigen eindeutige IDs.'),
  youtube: z.array(sceneYoutubeSchema).max(sceneYoutubeMax).refine(v=>new Set(v.map(t=>t.id)).size===v.length,'Titel dürfen nicht doppelt sein.').optional(),
  npcIds: ids, clueIds: ids,
  standardFigures: z.array(z.object({ id: z.string().uuid(), typeId: z.string().min(1).max(60), tierId: z.enum(['easy','standard','hard','very_hard','extreme']), count: z.number().int().min(1).max(10), imageFileId: z.string().max(160).optional(), templateId:z.string().uuid().optional() }).strict()).max(30).default([]),
  possibilities: z.array(z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200), text: z.string().max(3000) }).strict()).max(50)
    .refine(v => new Set(v.map(p => p.id)).size === v.length, 'Möglichkeiten dürfen nicht doppelt sein.'),
  // Storyboard 2.0 (optional): block type, preparation status and properties. Older scenes stay valid.
  board: sceneBoardSchema.optional(),
  // Szene 2.0, Etappe 1 (optional).
  context: sceneContextSchema.optional(),
  passages: z.array(scenePassageSchema).max(sceneWorkshopLimits.passages).refine(v => new Set(v.map(p => p.id)).size === v.length, 'Abschnitte benötigen eindeutige IDs.').optional(),
  moods: z.array(sceneMoodSchema).max(sceneWorkshopLimits.moods)
    .refine(v => new Set(v.map(m => m.id)).size === v.length, 'Stimmungen benötigen eindeutige IDs.')
    .refine(v => v.filter(m => m.isDefault).length <= 1, 'Nur eine Stimmung kann der Szenenstandard sein.').optional(),
  // Szene 2.0, Etappe 2 (optional).
  cast: z.array(sceneCastSchema).max(sceneCastLimits.cast)
    .refine(v => new Set(v.map(c => c.id)).size === v.length, 'Beteiligte benötigen eindeutige IDs.')
    .refine(v => new Set(v.map(c => c.npcId)).size === v.length, 'Ein NSC kann nur einmal beteiligt sein.').optional(),
  places: z.array(scenePlaceSchema).max(sceneCastLimits.places)
    .refine(v => new Set(v.map(p => p.id)).size === v.length, 'Schauplätze benötigen eindeutige IDs.')
    .refine(v => new Set(v.map(p => p.placeId)).size === v.length, 'Ein Ort kann nur einmal Schauplatz sein.')
    .refine(v => v.filter(p => p.main).length <= 1, 'Nur ein Ort kann der Hauptschauplatz sein.').optional(),
  /** the place is decided during play */
  placesOpen: z.boolean().optional(),
  // Szene 2.0, Etappe 3 (optional).
  materialUses: z.array(sceneMaterialUseSchema).max(sceneMaterialUseLimits.uses)
    .refine(v => new Set(v.map(u => u.id)).size === v.length, 'Verwendungen benötigen eindeutige IDs.')
    .refine(v => new Set(v.map(u => u.materialId)).size === v.length, 'Jedes Material gibt es in einer Szene nur einmal.').optional(),
  // Szene 2.0, Etappe 4 (optional).
  insights: z.array(sceneInsightSchema).max(scenePossibilityLimits.insights).refine(v => new Set(v.map(x => x.id)).size === v.length, 'Erkenntnisse benötigen eindeutige IDs.').optional(),
  interactionCards: z.array(sceneInteractionCardSchema).max(scenePossibilityLimits.cards).refine(v => new Set(v.map(x => x.id)).size === v.length, 'Interaktionen benötigen eindeutige IDs.').optional(),
  events: z.array(sceneEventSchema).max(scenePossibilityLimits.events).refine(v => new Set(v.map(x => x.id)).size === v.length, 'Ereignisse benötigen eindeutige IDs.').optional(),
  // Szene 2.0, Etappe 5 (optional).
  checks: z.array(sceneRuleCheckSchema).max(sceneRuleCheckLimits.checks).refine(v => new Set(v.map(x => x.id)).size === v.length, 'Proben benötigen eindeutige IDs.').optional(),
}).strict();
export type SceneDocument = z.infer<typeof sceneDocumentSchema>;
export const emptyScene = (storyId = ''): SceneDocument => ({ archived:false,title: 'Neue Szene', storyId, placeId: '',parentId:'',sessionIds:[],backdropFileId:'',favorite:false,pinned:false,elements:[], narration: '', atmosphere: '', gmNotes: '', dialogueNotes: '', interactions: '', secrets: '', visions: '', whispers:[], visionRecipientIds:[],visionFileIds:[],possibleConsequences: '', npcIds: [], clueIds: [], standardFigures: [], possibilities: [] });
export const sceneTargetSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('group') }).strict(),
  z.object({ scope: z.literal('character'), characterId: id }).strict(),
]);
export type SceneTarget = z.infer<typeof sceneTargetSchema>;
export const sceneParticipantsSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('group') }).strict(),
  z.object({ scope: z.literal('characters'), characterIds: ids.refine(v => v.length > 0, 'Wähle mindestens einen Charakter für diese Teilgruppe.') }).strict(),
]);
export type SceneParticipants = z.infer<typeof sceneParticipantsSchema>;
export const sceneRunSchema = z.object({
  id: z.string().uuid(), sessionId: id, label: z.string().trim().min(1).max(120),
  participants: sceneParticipantsSchema, status: z.enum(['active', 'paused', 'completed']),
  startedAt: z.string().datetime(), updatedAt: z.string().datetime(), completedAt: z.string().datetime().nullable(),
  previousRunId: z.string().uuid().nullable(),
}).strict();
export type SceneRun = z.infer<typeof sceneRunSchema>;
export const scenePublicationSchema = z.object({
  target: sceneTargetSchema, title: z.string().min(1).max(200), narration: text,
  placeId: optionalId, npcIds: ids, clueIds: ids, publishedAt: z.string().datetime(), sourceVersion: z.number().int().min(1),
}).strict();
export type ScenePublication = z.infer<typeof scenePublicationSchema>;
export const sceneStateSchema = z.object({
  documentKind: z.literal('story_scene'), runs: z.array(sceneRunSchema).max(500), publications: z.array(scenePublicationSchema).max(101),
}).strict().superRefine((s, ctx) => {
  if (new Set(s.runs.map(r => r.id)).size !== s.runs.length || new Set(s.publications.map(p => targetKey(p.target))).size !== s.publications.length)
    ctx.addIssue({ code: 'custom', message: 'Dieser Szenenstand enthält doppelte Identitäten.' });
});
export type SceneState = z.infer<typeof sceneStateSchema>;
export type SceneView = { id: string; version: number; updatedAt: string; document: SceneDocument; state: SceneState };
export type SceneSummary = Pick<SceneView, 'id' | 'version' | 'updatedAt'> & { title: string; archived?:boolean; storyId: string; placeId: string; parentId:string; sessionIds:string[]; favorite:boolean;pinned:boolean;searchText:string;unsupported?:true;board?:SceneBoard;elements:Pick<SceneElement,'id'|'title'|'kind'>[]; preparation?: ReturnType<typeof import('./session-overview.ts').scenePreparation>; runs: SceneRun[] };
export type SceneHistory = { id: string; version: number; action: string; createdAt: string; document: SceneDocument; state: SceneState };
export type PlayerScene = { id: string; title: string; narration: string; publishedAt: string; place: { id: string; title: string } | null; persons: { id: string; title: string }[]; clues: { id: string; title: string; text: string; state: string }[]; runs: { id: string; sessionId: string; label: string; status: SceneRun['status'] }[] };
export function targetKey(t: SceneTarget) { return t.scope === 'group' ? '@group' : t.characterId; }
export function participantMatches(p: SceneParticipants, characterId?: string) { return p.scope === 'group' || !!characterId && p.characterIds.includes(characterId); }
export function targetMatches(t: SceneTarget, characterId?: string) { return t.scope === 'group' || !!characterId && t.characterId === characterId; }

const revision = z.number().int().min(1), base = { id, version: revision };
export const sceneCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), clientRequestId: z.string().uuid(), document: sceneDocumentSchema }).strict(),
  z.object({ action: z.literal('save'), ...base, document: sceneDocumentSchema }).strict(),
  z.object({action:z.literal('restore'),...base,historyId:z.string().uuid()}).strict(),
  z.object({ action: z.literal('activate'), ...base, runId: z.string().uuid(), sessionId: id, label: z.string().trim().min(1).max(120), participants: sceneParticipantsSchema }).strict(),
  z.object({ action: z.literal('pause'), ...base, runId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('resume'), ...base, runId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('complete'), ...base, runId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('reopen'), ...base, runId: z.string().uuid(), newRunId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('publish'), ...base, target: sceneTargetSchema }).strict(),
  z.object({ action: z.literal('withdraw'), ...base, target: sceneTargetSchema }).strict(),
]);
export type SceneCommand = z.infer<typeof sceneCommandSchema>;

/** Rollback aid (GE-02 release): turns structured checks back into the free text an older build understands.
 * Nothing is lost: traits, SG, intended figure ids and consequences are appended to the element text. Pure and idempotent. */
export function sceneWithoutStructuredChecks(document:Record<string,unknown>):{document:Record<string,unknown>;changed:number}{
  const elements=Array.isArray(document.elements)?document.elements as Record<string,unknown>[]:[];let changed=0;
  const esc=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const next=elements.map(e=>{
    if(!e||typeof e!=='object'||(e as {check?:unknown}).check==null)return e;
    const {check,...rest}=e as Record<string,unknown>&{check?:Partial<SceneCheck>};changed++;
    const c=check||{},parts=[c.attributeId&&'Attribut '+esc(W10_ATTRIBUTE_KEYS[c.attributeId as keyof typeof W10_ATTRIBUTE_KEYS]||c.attributeId),c.abilityId&&'Fähigkeit '+esc(W10_ABILITY_KEYS[c.abilityId as keyof typeof W10_ABILITY_KEYS]||c.abilityId),c.difficulty&&'SG '+esc(c.difficulty),c.targetCharacterIds?.length&&'Figuren '+esc(c.targetCharacterIds.join(', '))].filter(Boolean);
    const follow=(['success','failure','botch'] as const).flatMap(k=>c.consequences?.[k]?[{success:'Erfolg',failure:'Fehlschlag',botch:'Patzer'}[k]+': '+esc(c.consequences[k])]:[]);
    const note='<p>Probe (strukturiert, zurückgeführt): '+(parts.join(' · ')||'ohne Werte')+'</p>'+(follow.length?'<p>Folgen: '+follow.join(' · ')+'</p>':'');
    return {...rest,text:String(rest.text||'')+note};
  });
  return {document:changed?{...document,elements:next}:document,changed};
}
