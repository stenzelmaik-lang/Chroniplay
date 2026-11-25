# ChroniPlay Vision Engine · isolierter Prototyp

Erinnerungsecho „Der Hunger folgt dir“ mit den fünf Originalbildern, dazu der neue Ersteller („Regie-Werkbank“).
Unabhängig von der produktiven Architektur: keine Datenbank, keine API, keine Anmeldung, keine neue Abhängigkeit.

## Start

Einmalig die Originalbilder und Töne lokal vorbereiten (sie kommen nicht ins Repository):

```powershell
powershell -ExecutionPolicy Bypass -File prototypes/vision-engine/prepare-assets.ps1
```

Standardquelle ist `Desktop\ChroniPlay Projekt\Emil`. Eine andere Quelle geht mit `-Source 'D:\Pfad'`.
Das Skript schreibt nach `prototypes/vision-engine/local-assets/` (in `.gitignore`).

Dann den lokalen Server starten:

```powershell
node prototypes/vision-engine/server.mjs
```

- Ersteller: http://127.0.0.1:5197/
- Spieleransicht im ganzen Fenster: http://127.0.0.1:5197/?play
- Prüfparameter: `&vision=default` (Originalfassung statt Entwurf), `&type=dark`, `&tempo=calm`, `&intensity=strong`, `&reduced=1`, `&quality=niedrig`, `&hud=1` (Leistungsanzeige), `&bench=1` (startet sofort und stumm)

Nur 127.0.0.1, keine externen Aufrufe. Die Schriften kommen aus `public/fonts`.

## Aufbau

| Datei | Aufgabe |
| --- | --- |
| `src/presets.js` | Die sechs Visionstypen als Daten: Nebel, Licht, Entstehung, Auflösung, Partikel, Typografie, Klang |
| `src/timeline.js` | Zeitliche Regie als reine Funktion der Zeit: Eintauchen, Erinnerungsblitz, Nachhall, Abschluss, Lichtimpuls-Grenze |
| `src/layout.js` | Platzierung je Moment und Format; der geschützte Kernbereich bleibt immer sichtbar |
| `src/shaders.js` | GLSL: Nebel (halbe Auflösung), Komposition mit Wolkenkontur, GPU-Partikel |
| `src/engine.js` | WebGL2-Renderer, Qualitätsstufen, GPU-Zeitmessung, Kontextverlust |
| `src/fallback.js` | Einfache Canvas-2D-Darstellung ohne WebGL2 |
| `src/typography.js` | Frei stehende, wortweise animierte Schrift ohne Container, Nachhall-Worte |
| `src/audio.js` | Web Audio: zwei Klangebenen mit nahtloser Schleife, erzeugte Effektklänge, Planung auf der Audio-Uhr |
| `src/player.js` | Verbindet alles; Spieleransicht und eingebettete Vorschau |
| `src/perf.js` | Bildrate, CPU- und GPU-Zeit, automatische Qualitätsstufe |
| `src/creator.js` | Ersteller |
| `timeline.test.mjs` | Regie- und Layouttests ohne Browser: `node --test prototypes/vision-engine/timeline.test.mjs` |

## Grundsätze der Darstellung

- Das Standbild bewegt sich nie. Bewegung entsteht nur durch Nebel, Licht, Partikel, Kontur und Übergänge.
- Keine sichtbare Bildkante: Die Maske misst vom Brennpunkt zur eigenen Bildkante in jeder Richtung. Das Bild läuft wie eine Wolke aus, bevor seine Kante erreicht ist. Jeder Effekt (Leuchten, Auflösung, Doppelkontur) bleibt innerhalb dieser Kontur.
- Geschützter Kernbereich je Bild: Er bleibt klar, ohne Vordergrundnebel und ohne Fehlstellen. Verzerrung, Farbversatz und Doppelkontur wirken nur im Außenbereich und nur während Entstehung und Auflösung.
- Lichtimpulse nur bei „Bedrohlich“ und „Dramatisch“, höchstens einer je 2,5 Sekunden, mit mindestens 140 ms Anstieg und begrenzter Helligkeit. Pulsieren unter 0,3 Hz. Im Ruhemodus keine Impulse und keine Verzerrung.
- Bilder sind je Vision getrennt: Jede Vision hat ihren eigenen Bildbestand (`images`). Momente wählen nur daraus. Bilder anderer Visionen stehen höchstens in der eingeklappten Galerie und erscheinen erst nach ausdrücklichem „In diese Vision übernehmen“. Der Player lädt nur Bilder, die im Ablauf stehen.
- Lesbarkeit: mehrlagiger Textschatten und ein unsichtbarer, weicher Abdunkelungsschleier hinter den Worten. Der Ersteller misst den Kontrast gegen das tatsächlich gerenderte Bild.
