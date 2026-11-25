# Vision Engine · isolierter Prototyp „Der Hunger folgt dir“

- **Branch:** `claude/vision-engine-prototyp` (Worktree `.claude/worktrees/vision-engine`)
- **Basis:** `origin/main` `d43de73` (Release-Nachweis 2.5.3)
- **Datum:** 25.11.2026
- **Stand:** lokal gebaut und im Browser geprüft. Nicht gepusht, nicht veröffentlicht, keine Änderung an der produktiven Architektur. Wartet auf die visuelle Abnahme.

## Auftrag

Ein isolierter visueller Prototyp für das Erinnerungsecho „Der Hunger folgt dir“ mit den fünf Originalbildern. Ziel: keine Diashow, sondern Bilder, die organisch aus dem Nebel treten und sich wieder auflösen, frei stehende Typografie, Licht, Partikel, synchroner Ton und eine eigene Effektsprache für alle sechs Visionstypen. Dazu der Ersteller für Visionen, überarbeitet und verbessert. Ergänzt im Verlauf: **keine sichtbaren Bildkanten** („wie eine Wolke“) und **Bilder je Vision getrennt** (nur eigene Bilder in der Vision, fremde höchstens in der Galerie).

Das im Auftrag genannte Designreferenzbild lag nicht als Datei vor (nur Bildtitel im Text). Die Gestaltung folgt der schriftlichen Beschreibung.

## Technikwahl

| Weg | Ergebnis |
| --- | --- |
| HTML/CSS/SVG-Masken | Für weiche Ränder ausreichend, für wolkige Auflösung, Lichtbrechung, Nebel vor und hinter dem Bild zu starr. Bleibt für Text und Bedienung. |
| Canvas 2D | Als Ersatzdarstellung ohne WebGL2 eingebaut (`fallback.js`). Für Shader-Effekte zu langsam. |
| **WebGL2 mit GLSL** | Gewählt. Nebel, Wolkenkontur, Auflösung, Licht, Farbfilter, Körnung und Partikel in drei Durchgängen pro Bild. |
| three.js (0.186.1, bereits im Projekt) | Geprüft und nicht verwendet: Die Wirkung ist reine 2D-Bildkomposition; three.js brächte keinen Gewinn, nur Ladegewicht. Keine neue Abhängigkeit. |

## Umgesetzt

Alles liegt in `prototypes/vision-engine/` (Details in der dortigen `README.md`).

- **Ablauf nach Auftrag:** 01 Eintauchen (Dunkelheit, aufziehender Nebel, erste Worte) → je Bild Erinnerungsblitz, Halten, Auflösen, Nachhall-Wort → Abschluss (letztes Bild zerfällt, Schlusssatz bleibt bis „Ich habe alles gesehen“).
- **Standbilder unbewegt.** Bewegung nur durch Nebel, Licht, Partikel, Kontur und Übergänge.
- **Keine Bildkante.** Die Maske misst vom Brennpunkt zur eigenen Bildkante in jeder Richtung. Das Bild läuft wolkig aus, bevor seine Kante kommt. Leuchten, Auflösung und Doppelkontur bleiben innerhalb dieser Kontur.
- **Geschützter Kernbereich** je Bild (im Ersteller per Klick gesetzt): ohne Vordergrundnebel und ohne Fehlstellen, auf jedem Format vollständig im Bild.
- **Sechs Effektsprachen:**

| Typ | Entstehung | Auflösung | Nebel, Licht, Partikel |
| --- | --- | --- | --- |
| Klassisch | öffnet sich weich aus der Mitte | silberner Dunst | Silberlicht von oben, Schwebeteilchen |
| Traum | fließt seitlich herein, Lichtbrechung am Rand | strömt seitlich davon | bläuliche Schleier, unscharfe Lichtpunkte |
| Dunkel | helle Bildteile treten zuerst aus der Finsternis | schwarzer Rauch frisst das Bild | Dunst zwischen schwarzen Schwaden, Schatten vom Rand, Asche |
| Bedrohlich | kurzer, begrenzter Erinnerungsblitz mit Farbversatz | schnelles Verglühen in roter Glut | rotes Pulsieren von unten unter 0,3 Hz, kriechende Schatten, Glut |
| Dramatisch | hinter einer goldenen Lichtfront | Verglühen im Licht | Lichtschweife, Steigerung von Moment zu Moment |
| Erinnerungsecho | aus dem Nebel mit Doppelkontur | zerfällt zu goldenem Staub | Sepia, Filmkorn, Staub im Lichtstrahl, Fehlstellen, Worte bleiben als Nachhall |

- **Typografie** frei stehend, wortweise aus der Dunkelheit, ohne Kästen. Beim Echo verblassen die Worte in zufälliger Reihenfolge, das Nachhall-Wort bleibt stehen. Lesbarkeit durch Textschatten und einen unsichtbaren Abdunkelungsschleier im Shader.
- **Ton** mit Web Audio: zwei Klangebenen mit nahtloser Schleife (die beiden WAV-Dateien aus dem Ordner „Emil“), dazu erzeugte Effektklänge je Typ. Anschwellen, Lichtschlag, Flirren und Knistern kommen aus demselben Zeitplan wie Bild und Text.
- **Sicherheit für die Augen:** Lichtimpulse nur bei Bedrohlich und Dramatisch, höchstens einer je 2,5 s, mindestens 140 ms Anstieg, begrenzte Helligkeit. Ruhemodus (Systemeinstellung oder Schalter): keine Impulse, keine Verzerrung, ruhigerer Nebel, längere Lesezeit.
- **Leistung:** Nebel in halber Auflösung, Partikelbahnen vollständig auf der GPU, drei Qualitätsstufen mit automatischer Wahl anhand der gemessenen GPU-Zeit, Kontextverlust wird abgefangen.

### Ersteller (gegenüber dem bestehenden Editor in Schritt 6 und dem Regie-Komponisten)

1. Live-Bühne direkt im Editor statt Vorschaufenster, mit Zeitleiste, Sprungmarken und Lichtimpuls-Markierung.
2. Storyboard: Bild und Text als Paar je Moment, statt zweier getrennter Listen mit automatischer Verteilung.
3. Reihenfolge per Ziehen oder Pfeilknöpfen (bisher keine Umsortierung der Bilder).
4. Brennpunkt und geschützter Kernbereich je Bild.
5. Platz (links, Mitte, rechts) und Größe (nah, mittel, weit) je Moment, Mindesthaltezeit.
6. Eintauchen-Text, Nachhall-Wort je Moment, Schlusssatz.
7. Intensität (sanft, normal, intensiv) und Farbfilterstärke zusätzlich zu Typ und Tempo.
8. Formatvorschau Desktop, Tablet, Handy in echter Größe, verkleinert dargestellt.
9. Prüfhinweise: Dauer, Textlänge, Nachhall, Lichtimpulse, Bildbestand und **gemessene Lesbarkeit** gegen das gerenderte Bild.
10. **Bilder je Vision getrennt:** eigener Bildbestand je Vision; Momente wählen nur daraus. Bilder anderer Visionen stehen in der eingeklappten Galerie und kommen nur per „In diese Vision übernehmen“ hinein. Der Player lädt nur Bilder, die im Ablauf stehen.
11. Export und Import als JSON mit Abbildung auf das bestehende Szenenformat.

### Abbildung auf das bestehende Datenmodell

`toSceneWhisper()` (`src/vision-default.js`) erzeugt die vorhandenen Felder von `sceneWhisperSchema` (`kind`, `title`, `preset`, `tempo`, `fileIds`, `fragments`, `audioFileId`) und zusätzlich einen optionalen, versionierten Block `direction` (v1) mit Intensität, Farbfilter, Eintauchen, Schlusssatz, zweiter Klangebene und je Moment Brennpunkt, Kern, Größe, Platz, Nachhall, Haltezeit. Für eine Integration müsste `direction` als optionales Feld ins Schema; alte Einträge blieben gültig. Der Bildbestand je Vision entspräche einer Zuordnung innerhalb des Galerieabschnitts „Visionen“ (heute nur ein gemeinsamer Abschnitt); das ist vor der Integration zu entscheiden.

## Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `node --test prototypes/vision-engine/timeline.test.mjs` | 9 von 9 bestanden: alle fünf Bilder genau einmal und in Reihenfolge (alle sechs Typen), Halte- und Lesezeiten bei drei Tempi, Ablaufreihenfolge, Lichtimpuls-Abstand und Ruhemodus ohne Impulse, gültige Wertebereiche, „Weiter“ nur vorwärts, Nachhall-Erkennung, Kernbereich auf sechs Formaten sichtbar, Szenenformat-Grenzen |
| Syntaxprüfung aller Module (`node --check`) | ohne Fehler |
| Browser (Chromium im Desktop-App-Bereich, WebGL2 über ANGLE/D3D11, RTX 4060 Ti) | Engine startet mit WebGL2, keine Konsolenfehler im Ablauf |
| Sichtprüfung 800×450 | alle sechs Typen in Entstehung, Halten und Auflösung angesehen; nach Korrekturen keine sichtbare Bildkante mehr |
| Sichtprüfung Handy 390×844 | Bild oben, Text darunter; Gesicht und Passantin in Moment 2 erkennbar |
| Gesamtablauf | 1:14 min; „Weiter“ spult zu den Haltepunkten (Ende Eintauchen → Bild voll → Auflösen → nächstes Bild); Ende zeigt Schlusssatz und „Ich habe alles gesehen“ / „Noch einmal“; Bestätigen blendet aus und bietet Wiederholung |
| Lesbarkeit (Kontrast der Worte gegen die hellsten 5 % des gerenderten Hintergrunds, Typ Erinnerungsecho) | Desktop mindestens 10,5:1, Tablet mindestens 9,4:1, Handy mindestens 12,9:1. Ziel WCAG AA 4,5:1 |
| GPU-Zeit pro Bild (Timer-Abfrage, RTX 4060 Ti) | Stufe „Hoch“ 1600×900: etwa 1,5–1,9 ms; Stufe „Niedrig“ 1200×675: etwa 0,55 ms. Kleine Stichprobe, einzelne Ausreißer nach unten |
| CPU-Zeit pro Bild (JavaScript) | 0,1–0,6 ms |
| Laden | Shader 12 ms; Bilder als JPEG 300–390 KB statt 2,5 MB PNG; Dekodierung 14–46 ms je Bild außerhalb des Bildaufbaus; Texturen 3–13 ms je Bild |
| Bildtrennung je Vision | Fremdes Testbild erschien nur in der Galerie, nicht im Bildbestand, nicht in der Bildauswahl, nicht im Player; nach „Übernehmen“ wählbar, nach „Entfernen“ wieder nur in der Galerie |
| `node --experimental-strip-types --test tests/*.test.mjs` (120 Dateien) | 796 von 796 bestanden. Erwartbar, da kein produktiver Code geändert wurde |

### Während der Prüfung gefundene und behobene Fehler

- Beim Auflösen erschien das Bild kurz als hartes Rechteck: Das Leuchten der Auflösungsfront ignorierte die Maske. Jetzt bleibt jeder Effekt innerhalb der Wolkenkontur.
- Die Bildgrenze bestimmte den Umriss (Rechteck mit ausgefransten Kanten). Neue Maske relativ zur eigenen Bildkante.
- Nebel wirkte krümelig, dann marmoriert. Jetzt eine zentrierte Verwirbelungsebene mit weichen Übergängen (dabei 6 Texturzugriffe pro Pixel weniger).
- Sternenkranz an der Lichtquelle, Bedienknöpfe über dem Text, Gesicht in Moment 2 knapp außerhalb des Kerns, zu frühe Schlusszeile über dem letzten Bild, unsichtbarer Rauch der dunklen Vision.
- Automatische Qualität sank fälschlich, weil die pausierte Vorschau absichtlich mit halber Bildrate läuft. Jetzt entscheidet die GPU-Zeit und nur echte Wiedergabe zählt.
- Lokaler Server lehnte alle Dateien ab (Pfadvergleich mit abschließendem Trenner).

## Prüfgrenzen

Zielplattform ist laut Besitzer (25.11.2026) hauptsächlich der PC. Handy, Tablet, Safari und Firefox sind nachrangig; das Handy-Layout bleibt als Rückfall erhalten.

- **Bildrate nicht belastbar gemessen:** Der Browserbereich war während der Messungen verborgen; der Browser drosselt dann auf etwa 10 Bilder pro Sekunde. Eine einzelne Ablesung bei sichtbarem Bereich zeigte 60 fps. GPU- und CPU-Zeiten sind unabhängig davon gemessen.
- Nur ein Rechner mit starker Grafikkarte. Keine Messung auf integrierter Grafik, Tablet oder echtem Handy. Formate nur emuliert, nur Chromium (kein Safari, kein Firefox).
- **Ton nicht geprüft:** Die Prüfläufe starteten ohne Nutzergeste und deshalb stumm. Klang, Lautstärke und Schleifenübergänge muss ein Mensch anhören.
- Ruhemodus nur über Unit-Tests geprüft (keine Lichtimpulse, Zeiten), nicht per Sichtprüfung.
- Lesbarkeit nur für den Typ Erinnerungsecho gemessen.
- ESLint nicht lauffähig: In der Abhängigkeitsinstallation der Hauptarbeitskopie fehlt `@babel/core` (wird von `eslint-plugin-react-hooks` verlangt). Vorbestehend, nicht durch diese Arbeit.
- Die Texte der Vision sind Platzhalter des Prototyps. Die Originaltexte der Kampagnenvision lagen nicht vor.

## Offen für die Abnahme und danach

1. Visuelle Abnahme durch den Besitzer, am besten mit Ton und im Vollbild (`?play`).
2. Bildrate bei sichtbarem Browser in Full HD messen (`?play&hud=1`, Taste P) und einmal auf einem PC oder Laptop mit integrierter Grafik.
3. Entscheidung zur Integration: Engine als Bühne im bestehenden `VisionPlayer`, Zustellungs-API und Rechte bleiben unverändert; `direction` als optionales Schemafeld; Bildbestand je Vision im Galerieabschnitt „Visionen“.
4. Für die Integration: Texturen nur für aktuelles und nächstes Bild laden (heute alle fünf, etwa 42 MB Grafikspeicher).

## Ausdrücklich nicht getan

- Kein Push, kein Pull Request, kein Deployment, keine Migration, keine Zugriffe auf Produktionsdaten.
- Keine Änderung an produktivem Code; nur `prototypes/vision-engine/`, diese Übergabe und eine Zeile in `.gitignore`.
- Die Originalbilder und Töne sind **nicht** im Repository. `prepare-assets.ps1` kopiert sie nur lokal nach `prototypes/vision-engine/local-assets/` (ignoriert).
- Keine neue Abhängigkeit.
