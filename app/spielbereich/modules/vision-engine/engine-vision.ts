import type {VisionPlan} from '@/domain/vision-direction';

/** Übersetzt den Ablauf (Datei-IDs) in das Visionsformat der Engine (geprüfte Medien-URLs). */
export function engineVision(plan: VisionPlan, url: (fileId: string) => string) {
  return {
    format: 'chroniplay-vision-direction', version: 1,
    type: plan.type, tempo: plan.tempo, intensity: plan.intensity, filter: plan.filter,
    audio: {bed: plan.audioFileId ? url(plan.audioFileId) : '', heart: ''},
    intro: {text: plan.intro}, finale: {text: plan.finale},
    moments: plan.moments.map((m, i) => ({
      id: 'm' + i, image: m.image ? url(m.image) : undefined, text: m.text, echo: m.echo,
      focus: m.focus, core: m.core, size: m.size, place: m.place, holdMs: m.holdMs,
    })),
  };
}
