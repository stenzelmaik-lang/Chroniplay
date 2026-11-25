/**
 * Erinnerungsecho „Der Hunger folgt dir“ mit den fünf Originalbildern.
 * Die Bilder liegen nur lokal in local-assets/ (nicht im Repository, siehe prepare-assets.ps1).
 * Die Texte sind Platzhalter für den Prototyp und im Ersteller frei änderbar.
 * Brennpunkte und Kernbereiche wurden an den Motiven ausgerichtet (Gesicht, Hände, Passantin, unberührtes Essen).
 */
export function defaultVision() {
  return {
    format: 'chroniplay-vision-direction', version: 1,
    id: 'der-hunger-folgt-dir',
    title: 'Der Hunger folgt dir',
    type: 'echo', tempo: 'normal', intensity: 'normal', filter: null,
    audio: {bed: 'local-assets/hunger-atmosphaere.wav', heart: 'local-assets/hunger-herzschlag.wav'},
    // Eigener Bildbestand dieser Vision. Momente wählen nur hieraus; Bilder anderer Visionen bleiben in der Galerie.
    images: [
      {file: 'local-assets/hunger-1.jpg', label: 'Auf dem Heimweg'},
      {file: 'local-assets/hunger-2.jpg', label: 'Die Passantin'},
      {file: 'local-assets/hunger-3.jpg', label: 'Unter der Brücke'},
      {file: 'local-assets/hunger-4.jpg', label: 'Brot und Wasser'},
      {file: 'local-assets/hunger-5.jpg', label: 'Die Hände'},
    ],
    intro: {text: 'Regen. Seit Stunden nur Regen.'},
    moments: [
      {id: 'm1', image: 'local-assets/hunger-1.jpg', label: 'Auf dem Heimweg', focus: {x: 0.6, y: 0.42}, core: 0.38, size: 'mittel', place: 'rechts',
        text: 'Du läufst schneller, ohne zu wissen, wovor.', echo: 'wovor', holdMs: 0},
      {id: 'm2', image: 'local-assets/hunger-2.jpg', label: 'Die Passantin', focus: {x: 0.52, y: 0.36}, core: 0.4, size: 'mittel', place: 'mitte',
        text: 'Sie geht an dir vorbei. Du hörst ihr Herz, lauter als den Regen.', echo: 'ihr Herz', holdMs: 0},
      {id: 'm3', image: 'local-assets/hunger-3.jpg', label: 'Unter der Brücke', focus: {x: 0.6, y: 0.5}, core: 0.4, size: 'nah', place: 'links',
        text: 'Du willst schreien. Heraus kommt nur dieses Ziehen, tief unter den Rippen.', echo: 'Ziehen', holdMs: 0},
      {id: 'm4', image: 'local-assets/hunger-4.jpg', label: 'Brot und Wasser', focus: {x: 0.62, y: 0.5}, core: 0.4, size: 'mittel', place: 'rechts',
        text: 'Brot. Wasser. Gestern hätte es gereicht.', echo: 'Gestern', holdMs: 0},
      {id: 'm5', image: 'local-assets/hunger-5.jpg', label: 'Die Hände', focus: {x: 0.5, y: 0.34}, core: 0.38, size: 'nah', place: 'mitte',
        text: 'Du weißt nicht mehr, wessen Blut das ist.', echo: '', holdMs: 0},
    ],
    finale: {text: 'Der Hunger folgt dir.'},
  };
}

/** Abbildung auf das bestehende Szenenformat (sceneWhisperSchema) plus optionale, versionierte Regiespur. */
export function toSceneWhisper(v) {
  const moments = v.moments.filter(m => m && m.image);
  const fragments = [v.intro?.text, ...moments.map(m => m.text), v.finale?.text].map(s => (s || '').trim()).filter(Boolean).slice(0, 20).map(s => s.slice(0, 600));
  return {
    kind: 'vision', title: v.title, preset: v.type, tempo: v.tempo,
    fileIds: moments.map(m => `<Galerie-ID für ${m.image.split('/').pop()}>`),
    fragments,
    audioFileId: v.audio?.bed ? `<Galerie-ID für ${v.audio.bed.split('/').pop()}>` : undefined,
    direction: {
      v: 1, intensity: v.intensity, filter: v.filter, intro: v.intro?.text || '', finale: v.finale?.text || '',
      heartFileId: v.audio?.heart ? `<Galerie-ID für ${v.audio.heart.split('/').pop()}>` : undefined,
      moments: moments.map((m, i) => ({fileIndex: i, focus: m.focus, core: m.core, size: m.size, place: m.place, echo: m.echo || '', holdMs: m.holdMs || 0})),
    },
  };
}
