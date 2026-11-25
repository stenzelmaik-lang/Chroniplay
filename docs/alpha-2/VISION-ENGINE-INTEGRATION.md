# Vision Engine im Vision-Player und im Ersteller (Schritt 6)

- **Branch:** `claude/vision-engine-prototyp`
- **Basis:** `origin/main` `e7242f9` (#111 Profil, inzwischen live)
- **Datum:** 25.11.2026
- **Stand:** eingebaut und lokal geprüft. Nicht gemergt, nicht veröffentlicht. Der Deploy folgt erst nach ausdrücklicher Freigabe des Besitzers.
- Vorgeschichte und Gestaltung: [VISION-ENGINE-PROTOTYP.md](VISION-ENGINE-PROTOTYP.md)

## Was sich für Spieler und SL ändert

- **Spieler:** Jede Vision läuft mit der Vision Engine: WebGL2-Nebel, wolkige Bildkontur ohne sichtbare Kanten, Effektsprache je Visionstyp, freistehende Typografie, Ton auf demselben Zeitplan. Ohne WebGL2 gibt es eine einfache Canvas-Darstellung. Bedienung, Beschriftungen, Quittungen und Isolation des Tisches bleiben wie bisher („Weiter ›“, „Text vollständig anzeigen“, „Effekte ruhiger“, „Ton aus“, „Vision überspringen“, „Ich habe alles gesehen“, „Noch einmal“).
- **Bestehende Visionen** spielen ohne Änderung der Daten: Bilder und Textabschnitte werden wie bisher verteilt (`visionMoments`). Texte ohne Bild erscheinen als Wortmoment im Nebel.
- **SL, Schritt 6:**
  - Neue Visionen starten mit **Regie**: Ablauf der eigenen Bilder (Reihenfolge per Pfeil), Live-Bühne (stumm, ohne Zustellung), je Bild Brennpunkt und geschützter Kernbereich, Größe, Platz, Text, Nachhall-Wort, Mindesthaltezeit; dazu Eintauchen, Schlusssatz, Intensität und Farbfilter.
  - Bestehende Visionen werden **nicht automatisch** umgestellt. Sie zeigen „Regie einrichten“; die Umwandlung verteilt die vorhandenen Texte ohne Verlust auf Eintauchen, Bilder und Schlusssatz.
  - **Bilder getrennt:** Offen stehen nur die Bilder dieses Eintrags. Alle anderen Bilder des Galerieabschnitts liegen in der eingeklappten Galerie und kommen nur per „Bild verwenden“ hinein. Gilt auch für Beilagen von Botschaften.

## Daten

- `sceneWhisperSchema` hat das optionale Feld `direction` (Version 1, `domain/vision-direction.ts`). Bildeinstellungen hängen an der Datei-ID. Alte Einträge bleiben gültig. **Keine Migration**: Szenen sind JSON-Dokumente.
- Mit Regiespur schreibt der Editor die Texte zusätzlich als `fragments` (Eintauchen, Bildtexte, Schlusssatz), damit Volltext, Regie-Komponist und ältere Ansichten weiter funktionieren.
- Beim Auslösen kopiert der Server `direction` in den Zustellungslauf; die Spielerprojektion gibt sie nur bei Visionen weiter. Sie enthält keine internen Felder (Datei-IDs und Texte sind ohnehin Teil der Zustellung). Bilder und Ton lädt die Engine ausschließlich über die bestehende, empfängergeprüfte Asset-Route.
- Kompatibilitätsgrenze: Ältere App-Versionen mit striktem Schema lehnen Szenen mit `direction` ab. Ein blindes Zurückschalten auf alten Code nach dem Speichern solcher Szenen ist daher ungeeignet; Rücknahme dann nur zusammen mit dem Entfernen der Regiespuren.

## Geänderte und neue Dateien

| Datei | Änderung |
| --- | --- |
| `app/spielbereich/modules/vision-engine/*.js` | Engine (aus dem Prototyp verschoben, eine Quelle für App und Prototyp): Wortmomente ohne Bild, Beschriftung und Vorschauhinweis, Prüfattribute `data-preset`, `data-reduced`, `data-hint` |
| `app/spielbereich/modules/vision-engine/engine-vision.ts`, `vision-engine.module.css` | Übersetzung Ablauf → Engine, gekapselte Bühnenstile |
| `app/spielbereich/modules/spieltisch/delivery-players.tsx` | `VisionPlayer` nutzt die Engine; Props und Verhalten nach außen unverändert |
| `app/spielbereich/modules/vision-direction-editor.tsx` + `.module.css` | Regie im Editor mit Live-Bühne und Brennpunktwahl |
| `app/spielbereich/modules/prepared-whispers.tsx`, `prepared-whisper-staging.tsx` | Regie oder „Regie einrichten“, getrennte Bilder und Galerie, Textabschnitte nur ohne Regie |
| `domain/vision-direction.ts`, `domain/vision-direction-convert.ts` | Schema, Ablaufplan, abgeleitete Texte, Umwandlung |
| `domain/story-scene.ts`, `domain/personal-delivery.ts`, `server/live-deliveries.ts`, `spieltisch/delivery-stage.tsx` | `direction` im Schema, im Lauf, in der Projektion und in den Vorschauen |
| `tests/vision-direction.test.mjs`, `package.json` | neue Tests, in `test` und `test:deliveries` aufgenommen (zusammen mit den Engine-Tests des Prototyps) |
| `prototypes/vision-engine/*` | Prototyp lädt die Engine aus dem App-Ordner (`/engine/`) |

## Prüfungen (lokal, synthetische Konten, Port 8870)

| Prüfung | Ergebnis |
| --- | --- |
| `pnpm install --frozen-lockfile` (pnpm 11.25.0, eigene Installation im Worktree) | erfolgreich, keine neue Abhängigkeit |
| Typecheck (`tsc --noEmit --incremental false`) | 0 Fehler |
| Build (`node scripts/run-framework.mjs build`) | erfolgreich |
| ESLint auf allen geänderten und neuen Dateien | 0 Fehler, 0 Warnungen |
| `pnpm test`-Liste | 704 von 704 |
| Alle `tests/*.test.mjs` plus Engine-Tests | 815 von 815 |
| `tests/live-deliveries-integration.mjs` | 57 von 57 |
| Browser (Edge über die eingebaute Ansicht, 1440×900): Regie im Editor | neue Vision, fünf Bilder aus der Galerie übernommen, Texte und Nachhall gesetzt, Brennpunkt per Klick, Live-Bühne zeigt das gewählte Bild, Speichern hält `direction` und abgeleitete `fragments` fest |
| Browser: Spieler A | Vision erscheint als „Eine Vision“ mit `data-preset="echo"`, Eintauchen, Bilder aus dem Nebel, „Weiter ›“ mit Hinweis; „Vision überspringen“ → Schlusssatz und „Ich habe alles gesehen“ → Dialog weg, Tischebene wieder bedienbar |
| Browser: SL-Vorschau | „Vorschau einer Vision“ mit „Vorschau · nichts wird zugestellt“; „Effekte ruhiger“ setzt `data-reduced="true"` |
| Browser: bestehende Vision „Klassisch“ | unverändert (Textfeld, „Regie einrichten“), nur eigene Bilder offen, übrige in der Galerie |

## Befund außerhalb dieser Arbeit (nicht geändert)

`tests/live-deliveries-browser.mjs` (nicht in `pnpm test`, nicht in der CI) scheitert schon beim Öffnen des Editors: Der Test nutzt den Direktlink `?bereich=sitzung&scene=…&section=visions`, die aktuelle Oberfläche verwendet `szene=` und öffnet damit die Buchübersicht. Der Test bricht ab, bevor Visionsinhalte berührt werden. Die Schritte des Tests (Editor-Galerie, Spielervision, Isolation, Ruhemodus, Vorschau) habe ich stattdessen von Hand in der lokalen Instanz geprüft (siehe oben). Den Test an die neuen Direktlinks anzupassen ist ein eigener Auftrag.

## Prüfgrenzen

- Keine Prüfung auf Produktion, mit echten Konten, auf schwächerer Grafik oder auf Mobilgeräten (Zielplattform laut Besitzer: PC).
- Ton nicht angehört; die Engine spielt nur die Ton-Datei der Vision als Atmosphäre plus erzeugte Effektklänge. Eine zweite Klangebene (Herzschlag) gibt es in der App noch nicht.
- Der Regie-Komponist in der Live-Regie (spontane Visionen) hat noch keine Regie-Felder; spontane Visionen laufen automatisch verteilt.
- Die eingebettete Live-Bühne öffnet einen zweiten WebGL-Kontext neben einer laufenden Vollbild-Vorschau.

## Für den Deploy (nach Freigabe)

1. PR prüfen und nach `main` mergen.
2. Build von `main`, `wrangler versions upload` und `versions deploy` wie bei 2.5.3. **Keine Migration** nötig.
3. Release-Nachweis in `docs/releases/` (Live-Codecommit, Worker-Version, Deployment-ID, Zeitpunkt, keine Migration).
4. Nach dem Deploy Tisch und Regie einmal neu laden.

## Ausdrücklich nicht getan

- Kein Merge, kein Deployment, keine Migration, keine Zugriffe auf Produktionsdaten.
- Bestehende Visionen und Freigaben werden nicht automatisch geändert.
- Die fünf Originalbilder liegen nur in der lokalen Testinstanz und in `prototypes/vision-engine/local-assets/` (ignoriert), nicht im Repository.
