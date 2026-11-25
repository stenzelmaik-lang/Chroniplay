/**
 * Regiespur aus einer bestehenden Vision ohne Regiespur (nur auf ausdrücklichen Wunsch der SL, nie automatisch).
 * Bilder und Textabschnitte werden wie bisher verteilt und dann fest den Bildern zugeordnet:
 * Texte vor dem ersten Bild werden zum Eintauchen, Texte zwischen Bildern hängen am vorherigen Bild,
 * Texte nach dem letzten Bild werden zum Schlusssatz. Kein Text geht verloren.
 */
import type {SceneWhisper} from './story-scene.ts';
import {visionFragments, presetById, tempoById} from './personal-delivery.ts';
import {richTextToPlainText} from './location-rich-text.ts';
import {visionPlan, type VisionDirection, type VisionShot} from './vision-direction.ts';

const joinText = (a: string, b: string) => [a, b].map(s => s.trim()).filter(Boolean).join(' ');

export function directionFromEntry(w: SceneWhisper): VisionDirection {
  const fragments = visionFragments(w.fragments, richTextToPlainText(w.text));
  const plan = visionPlan({preset: presetById(w.preset).id, tempo: tempoById(w.tempo).id, images: w.fileIds, fragments, audioFileId: null});
  const shots: VisionShot[] = [];
  let intro = '', finale = '';
  plan.moments.forEach((m, i) => {
    if (m.image) { shots.push({fileId: m.image, ...(m.text ? {text: m.text} : {})}); return; }
    const laterImage = plan.moments.slice(i + 1).some(x => x.image);
    if (!shots.length) intro = joinText(intro, m.text);
    else if (laterImage) { const last = shots[shots.length - 1]; last.text = joinText(last.text || '', m.text).slice(0, 600); }
    else finale = joinText(finale, m.text);
  });
  return {v: 1, ...(intro ? {intro: intro.slice(0, 600)} : {}), ...(finale ? {finale: finale.slice(0, 600)} : {}), shots};
}
