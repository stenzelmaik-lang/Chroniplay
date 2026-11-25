/**
 * Einstieg. Ohne Parameter: Ersteller. Mit ?play: reine Spieleransicht im ganzen Fenster.
 * Prüfparameter für ?play: type, tempo, intensity, reduced=1, quality=hoch|mittel|niedrig, hud=1, bench=1 (startet sofort, stumm).
 */
import {Creator} from './creator.js';
import {VisionPlayer} from '/engine/player.js';
import {defaultVision} from './vision-default.js';

const params = new URLSearchParams(location.search);
const root = document.getElementById('app');

async function manifest() {
  try { const r = await fetch('local-assets/manifest.json', {cache: 'no-store'}); if (r.ok) return await r.json(); } catch { /* Bilder fehlen */ }
  return {images: [], audio: []};
}
function draft() {
  try { const v = JSON.parse(localStorage.getItem('chroniplay-vision-prototype-v1') || 'null'); if (v?.format === 'chroniplay-vision-direction') return v; } catch { /* Entwurf nur Komfort */ }
  return defaultVision();
}

if (params.has('play')) {
  document.body.classList.add('is-play');
  const vision = params.get('vision') === 'default' ? defaultVision() : draft();
  for (const k of ['type', 'tempo', 'intensity']) if (params.get(k)) vision[k] = params.get(k);
  root.innerHTML = '<div class="p-stage" id="p-stage"></div><div class="p-start" id="p-start"><button type="button" class="v-btn v-btn--primary">Vision beginnen</button><p>Mit Ton erleben: Kopfhörer empfohlen.</p></div>';
  const player = new VisionPlayer(document.getElementById('p-stage'), {mode: 'play', onEnd: () => { document.getElementById('p-start').hidden = false; document.querySelector('#p-start button').textContent = 'Noch einmal ansehen'; }});
  window.__visionPlayer = player;
  if (params.get('reduced') === '1') player.ownReduced = true;
  if (params.get('quality')) player.setQuality(params.get('quality'));
  if (params.get('hud') === '1') player.setHud(true);
  const info = await player.load(vision);
  window.__visionLoad = info;
  const start = () => { document.getElementById('p-start').hidden = true; player.exitAt = 0; player.replay(); };
  document.querySelector('#p-start button').addEventListener('click', start);
  if (params.get('bench') === '1') {
    document.getElementById('p-start').hidden = true;
    player.setMuted(true);
    player.startBenchmark();
    player.play();
  }
} else {
  const m = await manifest();
  window.__creator = new Creator(root, {manifest: m});
  window.__visionPlayer = window.__creator.player;
}
