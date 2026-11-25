/**
 * Regiespur einer Vision (Vision Engine, optional und versioniert).
 * Ohne Regiespur verteilt die Engine Bilder und Texte automatisch wie bisher (`visionMoments`).
 * Mit Regiespur legt die SL je Bild Brennpunkt, geschützten Kernbereich, Größe, Platz, Text, Nachhall und Haltezeit fest,
 * dazu Eintauchen, Schlusssatz, Intensität und Farbfilter. Bildeinstellungen hängen an der Datei-ID, nicht an der Position,
 * damit Umsortieren oder Entfernen eines Bildes nichts verschiebt.
 * Leaf-Modul: nur zod und die bestehende Momentverteilung.
 */
import {z} from 'zod';
import {visionMoments} from './vision-moments.ts';

export const VISION_INTENSITIES = ['soft', 'normal', 'strong'] as const;
export const VISION_SIZES = ['nah', 'mittel', 'weit'] as const;
export const VISION_PLACES = ['links', 'mitte', 'rechts'] as const;
export type VisionSize = typeof VISION_SIZES[number];
export type VisionPlace = typeof VISION_PLACES[number];

const unit = z.number().min(0).max(1);
export const visionShotSchema = z.object({
  fileId: z.string().min(1).max(100),
  focus: z.object({x: unit, y: unit}).strict().optional(),
  core: z.number().min(0.15).max(0.6).optional(),
  size: z.enum(VISION_SIZES).optional(),
  place: z.enum(VISION_PLACES).optional(),
  text: z.string().max(600).optional(),
  echo: z.string().max(60).optional(),
  holdMs: z.number().int().min(0).max(12000).optional(),
}).strict();
export const visionDirectionSchema = z.object({
  v: z.literal(1),
  intensity: z.enum(VISION_INTENSITIES).optional(),
  filter: z.number().min(0).max(1).optional(),
  intro: z.string().max(600).optional(),
  finale: z.string().max(600).optional(),
  shots: z.array(visionShotSchema).max(20).refine(v => new Set(v.map(s => s.fileId)).size === v.length, 'Jedes Bild darf nur einmal eingestellt sein.').optional(),
}).strict();
export type VisionShot = z.infer<typeof visionShotSchema>;
export type VisionDirection = z.infer<typeof visionDirectionSchema>;

export const SHOT_DEFAULTS = {focus: {x: 0.5, y: 0.45}, core: 0.36, size: 'mittel' as VisionSize, holdMs: 0};
/** Ohne Vorgabe wechseln die Bilder zwischen rechts, links und Mitte, damit keine Diashow-Gleichförmigkeit entsteht. */
export const AUTO_PLACES: readonly VisionPlace[] = ['rechts', 'links', 'mitte'];

export const shotOf = (d: VisionDirection | undefined, fileId: string): VisionShot | undefined => d?.shots?.find(s => s.fileId === fileId);

/** Texte für Volltext und ältere Ansichten: Eintauchen, Bildtexte in Bildreihenfolge, Schlusssatz (höchstens 20 × 600 Zeichen). */
export function directionFragments(d: VisionDirection, fileIds: readonly string[]): string[] {
  const texts = [d.intro, ...fileIds.map(id => shotOf(d, id)?.text), d.finale].map(s => (s || '').trim()).filter(Boolean);
  return texts.slice(0, 20).map(s => s.slice(0, 600));
}

/** Hat die Regiespur eigene Texte? Sonst bleiben die vorhandenen Textabschnitte maßgeblich. */
export const directionHasText = (d: VisionDirection | undefined) => !!d && !!((d.intro || '').trim() || (d.finale || '').trim() || d.shots?.some(s => (s.text || '').trim()));

export type VisionPlanMoment = {image?: string; text: string; echo: string; focus: {x: number; y: number}; core: number; size: VisionSize; place: VisionPlace; holdMs: number};
export type VisionPlan = {type: string; tempo: string; intensity: string; filter: number | null; intro: string; finale: string; moments: VisionPlanMoment[]; audioFileId: string | null};
export type VisionPlanInput = {preset: string; tempo: string; images: readonly string[]; fragments: readonly string[]; audioFileId: string | null; direction?: VisionDirection};

/**
 * Ablauf der Vision Engine aus einer Zustellung. Mit Regiespur exakt nach Vorgabe (Bildreihenfolge der Zustellung),
 * ohne Regiespur oder ohne eigene Texte automatisch: Bilder und Textabschnitte werden wie bisher auf eine gemeinsame Zeitleiste verteilt.
 * Kein Bild und kein Text geht verloren oder erscheint doppelt.
 */
export function visionPlan(input: VisionPlanInput): VisionPlan {
  const d = input.direction;
  const base = {type: input.preset, tempo: input.tempo, intensity: d?.intensity || 'normal', filter: d?.filter ?? null, audioFileId: input.audioFileId};
  const shotMoment = (fileId: string, i: number, text = ''): VisionPlanMoment => {
    const s = shotOf(d, fileId);
    return {
      image: fileId, text: (s?.text ?? text).trim(), echo: (s?.echo || '').trim(),
      focus: s?.focus || SHOT_DEFAULTS.focus, core: s?.core ?? SHOT_DEFAULTS.core, size: s?.size || SHOT_DEFAULTS.size,
      place: s?.place || AUTO_PLACES[i % AUTO_PLACES.length], holdMs: s?.holdMs || 0,
    };
  };
  if (d && directionHasText(d)) {
    return {...base, intro: (d.intro || '').trim(), finale: (d.finale || '').trim(), moments: input.images.map((id, i) => shotMoment(id, i))};
  }
  let imageNo = 0;
  const moments = visionMoments(input.images, input.fragments).map(m => {
    if (m.imageId) return shotMoment(m.imageId, imageNo++, m.text || '');
    return {text: (m.text || '').trim(), echo: '', focus: SHOT_DEFAULTS.focus, core: SHOT_DEFAULTS.core, size: SHOT_DEFAULTS.size, place: 'mitte' as VisionPlace, holdMs: 0};
  }).filter(m => m.image || m.text);
  return {...base, intro: '', finale: '', moments};
}
