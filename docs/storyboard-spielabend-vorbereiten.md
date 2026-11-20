# Storyboard – Kommandozentrum → Spielabend vorbereiten (Runde 3 live seit 15.11.2026, Nachtrag Buch-Zuordnung)

Stand: 15.11.2026 · Branch `claude/storyboard-kommandozentrum-323cfc` · Basis `c4418db` (Merge PR #86).
Nicht committet, nicht gepusht, nicht deployt. Keine Migration, keine neuen Abhängigkeiten, keine neuen API-Routen.

## Runde 3: Rückmeldung der SL nach Sichtprüfung

- **Kopf aufgeräumt:** Kacheln EP-Abrechnung und Live-Regie entfernt (die EP-Abrechnung bleibt in der klassischen Ansicht). Eine Kopfleiste: Pfad Chronik › Buch › Abend › Szene, Speicherstatus, „Weiterarbeiten“, Schalter „Führung“. Die Führung ist darunter eine schlanke Leiste.
- **Buch:** Spielabende in Spielreihenfolge (`sortEvenings`: geplante Termine zuerst, sonst natürliche Titelfolge – Spielabend 1 vor 2 vor 10). Oben die Reihe **Vorbereitet** (alle nicht im Entwurf), darunter **In Vorbereitung** (Entwurf). Ideenablage bleibt.
- **Spielabend:** wieder das Storyboard aus Karten (wie Runde 1), angereichert: Nummer, Reifegrad, Titel, Schauplatz, kurzer Vorlesetext, **Vorhandene Inhalte** (8 kleine Marken, gefüllte hervorgehoben), **Mitwirkende** (Namen), **Spielmaterial** (Anzahl). Kopf mit Stand des Abends und „Für diesen Abend geplant“ bleibt. Umsortieren per Ziehen oder Pfeil, sofort gespeichert.
- **Szene:** Lese- und Bearbeitungsfläche nutzen die volle Breite (keine Zeichenbegrenzung mehr).
- **Galerie nur dort, wo Bilder hingehören:** Der Galerie-Knopf im Texteditor erscheint nur noch unter Interaktionen. NPCs werden weiterhin aus den NPC-Akten gewählt. In Erzählung, Atmosphäre, NPCs & Dialoge, Geheimnisse, Visionen-Text, Folgen & Proben und SL-Notizen gibt es keine Galerie mehr. Bereits eingebettete Bilder bleiben erhalten und werden angezeigt. „Weitere Formatierung“ bleibt auch ohne Galerie erreichbar (kleine Änderung in `rich-text.tsx`, wirkt auch im Visionen-Editor).
- **Interaktionen:** Liste **„Spielmaterial dieser Szene“** mit allen angelegten Bausteinen (Art, Titel, Datei bzw. verknüpfte Person, Vorschaubild bei Bildern) und Link zum Bearbeiten im eigenen Fenster. Kehrt man aus dem Material-Fenster zurück, lädt die Szene neu (nur wenn nichts ungespeichert ist) – neues Material erscheint sofort, die Version bleibt aktuell.
- **Visionen & Botschaften:** Einträge als Karten, geöffneter Eintrag als Arbeitsfläche; Empfänger als Schalter-Chips, Visionstyp/Tempo/Darstellung im Storyboard-Stil. Gleiche Komponente wie in der klassischen Ansicht – die Optik ändert sich dort mit (`prepared-whispers.module.css`, `prepared-whisper-staging.module.css`), die Funktion nicht.
- **Folgen & Proben:** Abzweigungen als Kartenraster.

## Nachtrag nach dem Release: Abend einem Buch zuordnen

- Im Kopf des Spielabends gibt es neben „Stand des Abends“ die Auswahl **„Buch oder Kampagne“** (alle Bücher plus „Ohne Buch“). Die Wahl speichert sofort die Buchverknüpfung des Abends (`assignEveningBook`: nur die wählbaren Bücher werden ersetzt, andere Verknüpfungen bleiben); Pfadleiste und Adresse folgen dem Abend ins Buch.
- Lokal geprüft: Abend ohne Buch → „Der Hunger bleibt“ zugeordnet, erscheint nach Neuladen im Buch unter „In Vorbereitung“; „Ohne Buch“ entfernt die Verknüpfung wieder; 375 px ohne seitliches Scrollen. Alle Unit-Tests 687/687. Lokaler Prüfspeicher danach gelöscht.
- Grenze: Ein Abend, dessen Szenen selbst einem Buch angehören, erscheint dort weiterhin, auch wenn „Ohne Buch“ gewählt ist (bestehende Zuordnung über Szenen bleibt unverändert).
- Noch nicht live: wartet auf Freigabe.

## Nachtrag 20.11.2026: HTML-Eingabe im Storyboard, verbesserter HTML-Import

- Alle acht Szenenbereiche bieten im Editor **Visuell · HTML-Quelltext · Vorschau** (wie die klassische Ansicht). HTML anderer KIs kann direkt eingefügt werden.
- Verbesserter Import (zentral in `domain/location-rich-text.ts`, wirkt überall, wo HTML eingefügt wird):
  - Code-Block-Markierungen (```` ```html ````) und ganze Seiten (`<html>/<head>/<body>`) werden ausgepackt; `<title>`, `<head>`, `<meta>`, `<link>` fallen weg.
  - Aus `style` werden übernommen: Textfarbe (auch `#abc`, `rgba()`, gängige Farbnamen), fett, kursiv, unterstrichen, durchgestrichen, Ausrichtung (`text-align`, `align`, `<center>`, auch von umschließenden `<div>` geerbt).
  - Mehr Elemente: `h5/h6` → Überschrift, `<mark>` → Hervorhebung, `<dt>/<dd>`, `<pre>`, `<figcaption>`, `<cite>/<q>` → kursiv.
  - Weiterhin entfernt (Sicherheit/Einheitlichkeit): Rahmen, Hintergründe, Schriftgrößen/-arten, Abstände, `<style>`-Blöcke, Skripte, Einbettungen, fremde Bilder.
- Editor: Unter dem Quelltext erscheint, was nicht übernommen wird (Stilangaben, unbekannte Klassen, `<style>`, Skripte, fremde Bilder). Knopf **„Vorlage für andere KI“** kopiert eine Anleitung, mit der eine andere KI passendes HTML schreibt. Quelltext in Festbreitenschrift.
- Lesefassung zeigt Listen mit Aufzählungszeichen.
- Prüfungen: `tests/rich-text-html-import.test.mjs` (5 Tests, in `pnpm test`); alle Unit-Tests 701/701; tsc und ESLint grün; Browser: KI-HTML mit Code-Block eingefügt, Hinweise und Vorlage-Knopf sichtbar, nach Neuladen zentriert/farbig/fett/Liste/Hervorhebung korrekt. Integrations- und Browser-Skripte (`*-integration.mjs`, `*-browser.mjs`) nicht ausgeführt. Lokaler Prüfspeicher gelöscht.
- Noch nicht live.

## Nachtrag 20.11.2026: Eingabefelder der Werkzeuge sichtbar

- Fehler: In der Storyboard-Szene hatten die Felder fremder Bausteine (Ambiente-Playlist, Standardfiguren u. a.) weder Rahmen noch Hintergrund und waren nur 20 px hoch – sie wirkten wie Text; „Titel hinzufügen“ war ohne Link grau. Ursache: Diese Bausteine verlassen sich auf die Feldgestaltung der klassischen Ansicht.
- Behebung: schwache (`:where`) Feld- und Knopfgestaltung für `.tools` im Storyboard; eigene Klassen der Bausteine haben weiter Vorrang.
- Lokal geprüft: Playlist-Titel per Link angelegt, nach Neuladen gespeichert und bearbeitbar; Standardfiguren-Felder sichtbar; alle Unit-Tests grün. Prüfspeicher gelöscht. Noch nicht live.

## Dateien

- `domain/storyboard.ts` – reine Hilfen (Reifegrad, Umsortieren, Buch-/Abendzuordnung, Führung, `sceneResources`, `sortEvenings`)
- `app/spielbereich/modules/storyboard.tsx`, `storyboard.module.css` – Oberfläche
- `app/spielbereich/modules/command-center.tsx` – Storyboard als Standard, klassische Ansicht per `?ansicht=klassisch`
- `app/spielbereich/modules/rich-text.tsx` – „Weitere Formatierung“ auch ohne Inline-Galerie
- `app/spielbereich/modules/prepared-whispers.module.css`, `prepared-whisper-staging.module.css` – Optik Visionen/Botschaften
- `tests/storyboard.test.mjs` (in `pnpm test`, 7 Tests), `tests/fixtures/storyboard-demo.mjs`
- `scripts/test-local.mjs` – Schalter `--storyboard` (Speicher `.local-test/storyboard`, Port 8866), `package.json` – `demo:storyboard`

## Prüfungen (beobachtet, Runde 3)

| Prüfung | Ergebnis |
|---|---|
| `tsc --noEmit` | bestanden |
| ESLint auf allen geänderten/neuen TS-Dateien | bestanden |
| Build | bestanden |
| Alle Unit-Tests `node --experimental-strip-types --test tests/*.test.mjs` | 686 bestanden, 0 fehlgeschlagen |
| 1440×900: Buch | Reihen „Vorbereitet“ (Abend 01) und „In Vorbereitung“ (Abend 02) |
| 1440×900: Abend | Karten mit Inhalten, Mitwirkenden, Material; Ideenablage |
| 1440×900: Szene | Seite 1385 px breit, Editor 1293 px; in der Erzählung kein Galerie-Knopf |
| Interaktionen | Szene der Testvorlage zeigt 8 Bausteine (Bild mit Vorschau, Audio, Handouts, Person, Proben) |
| Visionen | Test-Vision angelegt, Schalter geprüft, wieder gelöscht; gespeichert (0 Einträge) |
| 375×812 | Abend und Szene ohne horizontales Scrollen; Pfeil-Umsortieren nach Neuladen erhalten, danach zurückgestellt |

## Prüfgrenzen

- Natives Ziehen im Testbrowser nicht automatisierbar; Pfeile geprüft. Touch: nur Pfeile.
- Kein echtes Mobilgerät. `pnpm run test:integration` nicht ausgeführt.
- Rückkehr aus dem Material-Fenster (Neuladen bei Fokus) nicht mit einem echten zweiten Fenster durchgespielt.
- Die geänderte Optik der Visionen in der klassischen Ansicht nicht separat angesehen.

## Offen (für spätere Runden, mit der SL abzustimmen)


- Material und Interaktionen als verbundenes System (Material → Einsatz in der Szene), Überarbeitung des Material-Fensters.
- Geheimnisse und Folgen & Proben inhaltlich weiterentwickeln; NPC-Bereich modular erweitern.
- Datum des Abends, Szene archivieren/aus dem Abend entfernen nur klassisch.

Start: `pnpm run build` und danach `pnpm run demo:storyboard` → http://127.0.0.1:8866/anmelden, synthetisches Konto `command-gm@example.invalid`.
